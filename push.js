/* Standard encrypted Web Push; sessions own devices, and SQLite owns the retry queue. */
const fs = require('node:fs');
const path = require('node:path');
const webpush = require('web-push');
const { db } = require('./database');
const notificationText = require('./public/js/notification-text');
const dataDir = process.env.KAGOPITA_DATA_DIR || path.join(__dirname, 'data');
const keyPath = path.join(dataDir, 'web-push-vapid.json');
let keys;
try { keys = JSON.parse(fs.readFileSync(keyPath, 'utf8')); }
catch (error) {
  if (error.code !== 'ENOENT') throw error;
  keys = webpush.generateVAPIDKeys();
  fs.writeFileSync(keyPath, JSON.stringify(keys), { mode: 0o600, flag: 'wx' });
}
webpush.setVapidDetails('https://kagopita.com', keys.publicKey, keys.privateKey);
db.exec(`
  CREATE TABLE IF NOT EXISTS push_devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    session_hash TEXT NOT NULL REFERENCES sessions(token_hash) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS push_devices_user ON push_devices(user_id);
  CREATE TABLE IF NOT EXISTS push_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id INTEGER NOT NULL REFERENCES push_devices(id) ON DELETE CASCADE,
    notification_id INTEGER REFERENCES notifications(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    next_at INTEGER NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    UNIQUE(device_id, notification_id)
  );
`);
// Additive migration keeps existing device registrations and queued work intact.
if (!db.prepare('PRAGMA table_info(push_devices)').all().some(column => column.name === 'language'))
  db.exec("ALTER TABLE push_devices ADD COLUMN language TEXT NOT NULL DEFAULT 'ja'");
function validSubscription(value) {
  if (!value || typeof value.endpoint !== 'string' || value.endpoint.length > 2048) return false;
  let url;
  try { url = new URL(value.endpoint); } catch { return false; }
  const host = url.hostname;
  const allowed = host === 'fcm.googleapis.com' || host === 'web.push.apple.com' ||
    host === 'updates.push.services.mozilla.com' || host.endsWith('.push.services.mozilla.com') ||
    host.endsWith('.notify.windows.com');
  if (!allowed || url.protocol !== 'https:' || url.port || url.username || url.password || url.hash) return false;
  const p256dh = value.keys?.p256dh, auth = value.keys?.auth;
  if (typeof p256dh !== 'string' || typeof auth !== 'string' ||
      !/^[A-Za-z0-9_-]{87}$/.test(p256dh) || !/^[A-Za-z0-9_-]{22}$/.test(auth)) return false;
  const key = Buffer.from(p256dh, 'base64url');
  if (key.length !== 65 || key[0] !== 4 || Buffer.from(auth, 'base64url').length !== 16) return false;
  try { require('node:crypto').ECDH.convertKey(key, 'prime256v1'); } catch { return false; }
  return true;
}
function enqueue(notificationId, userId) {
  const time = Date.now();
  db.prepare(`INSERT OR IGNORE INTO push_queue (device_id, notification_id, created_at, next_at)
    SELECT d.id, ?, ?, ? FROM push_devices d JOIN sessions s ON s.token_hash = d.session_hash
    WHERE d.user_id = ? AND s.user_id = d.user_id AND s.expires_at > ?`).run(notificationId, time, time, userId, time);
}
let running = false;
async function flush() {
  if (running) return;
  running = true;
  try {
    const time = Date.now();
    db.prepare('DELETE FROM push_devices WHERE session_hash IN (SELECT token_hash FROM sessions WHERE expires_at <= ?)').run(time);
    db.prepare('DELETE FROM push_queue WHERE created_at < ?').run(time - 24 * 60 * 60 * 1000);
    const jobs = db.prepare(`SELECT q.*, d.endpoint, d.p256dh, d.auth, d.user_id, d.session_hash, d.language
      FROM push_queue q JOIN push_devices d ON d.id = q.device_id
      JOIN sessions s ON s.token_hash = d.session_hash AND s.user_id = d.user_id
      WHERE q.next_at <= ? AND s.expires_at > ? ORDER BY q.id LIMIT 20`).all(time, time);
    for (const job of jobs) {
      const live = db.prepare(`SELECT d.id FROM push_devices d JOIN sessions s ON s.token_hash = d.session_hash
        WHERE d.id = ? AND d.session_hash = ? AND d.user_id = ? AND s.user_id = d.user_id AND s.expires_at > ?`)
        .get(job.device_id, job.session_hash, job.user_id, Date.now());
      if (!live) continue;
      // Recheck membership immediately before sending. Never deliver to a former member.
      const entry = job.notification_id && db.prepare(`SELECT n.* FROM notifications n
        JOIN channel_members m ON m.channel_id = n.channel_id AND m.user_id = n.user_id
        WHERE n.id = ? AND n.user_id = ?`).get(job.notification_id, job.user_id);
      if (job.notification_id && !entry) { db.prepare('DELETE FROM push_queue WHERE id = ?').run(job.id); continue; }
      const payload = JSON.stringify({
        ...notificationText.format(entry || null, job.language),
        tag: 'kagopita-' + (job.notification_id || 'test-' + job.id)
      });
      try {
        await webpush.sendNotification({ endpoint: job.endpoint, keys: { p256dh: job.p256dh, auth: job.auth } },
          payload, { TTL: 3600, urgency: 'normal', timeout: 8000 });
        db.prepare('DELETE FROM push_queue WHERE id = ?').run(job.id);
      } catch (error) {
        if ([404, 410].includes(error.statusCode)) db.prepare('DELETE FROM push_devices WHERE id = ?').run(job.device_id);
        else if ((error.statusCode >= 400 && error.statusCode < 500 && ![408, 429].includes(error.statusCode)) || job.attempts >= 5)
          db.prepare('DELETE FROM push_queue WHERE id = ?').run(job.id);
        else db.prepare('UPDATE push_queue SET attempts = attempts + 1, next_at = ? WHERE id = ?')
          .run(Date.now() + Math.min(3600000, 30000 * 2 ** job.attempts), job.id);
        // Do not log subscription endpoints, credentials, or payloads.
        console.warn('Web Push delivery failed:', Number(error.statusCode) || 'network');
      }
    }
  } finally { running = false; }
}
function routes(sessionToken) {
  const router = require('express').Router();
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    const origin = req.headers.origin;
    if (req.method !== 'GET' && origin && origin !== new URL(process.env.PUBLIC_URL || 'http://' + req.get('host')).origin)
      return res.status(403).json({ error: 'Invalid origin.' });
    req.pushSession = require('./database').sessionHash(sessionToken(req) || '');
    next();
  });
  router.get('/config', (req, res) => res.json({ publicKey: keys.publicKey }));
  router.post('/status', (req, res) => {
    const found = typeof req.body?.endpoint === 'string' && db.prepare(
      'SELECT id FROM push_devices WHERE endpoint = ? AND user_id = ? AND session_hash = ?'
    ).get(req.body.endpoint, req.user.id, req.pushSession);
    if (found && req.body.language !== undefined)
      db.prepare('UPDATE push_devices SET language = ? WHERE id = ?').run(notificationText.language(req.body.language), found.id);
    res.json({ enabled: Boolean(found) });
  });
  router.post('/subscriptions', (req, res) => {
    const value = req.body?.subscription;
    if (!validSubscription(value)) return res.status(400).json({ error: 'Invalid push subscription.' });
    const existing = db.prepare('SELECT * FROM push_devices WHERE endpoint = ?').get(value.endpoint);
    if (existing && (existing.p256dh !== value.keys.p256dh || existing.auth !== value.keys.auth))
      return res.status(409).json({ error: '端末の通知登録を解除して、再度お試しください。' });
    if ((!existing || existing.user_id !== req.user.id) && db.prepare('SELECT COUNT(*) AS n FROM push_devices WHERE user_id = ?').get(req.user.id).n >= 30)
      return res.status(429).json({ error: '登録できる端末数の上限です。' });
    // Drop former-account jobs before explicitly transferring a browser subscription.
    if (existing && (existing.user_id !== req.user.id || existing.session_hash !== req.pushSession))
      db.prepare('DELETE FROM push_devices WHERE id = ?').run(existing.id);
    db.prepare(`INSERT INTO push_devices (endpoint, p256dh, auth, session_hash, user_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(endpoint) DO NOTHING`).run(value.endpoint, value.keys.p256dh, value.keys.auth, req.pushSession, req.user.id, Date.now());
    db.prepare('UPDATE push_devices SET language = ? WHERE endpoint = ? AND user_id = ? AND session_hash = ?')
      .run(notificationText.language(req.body.language), value.endpoint, req.user.id, req.pushSession);
    res.status(201).json({ enabled: true });
  });
  router.delete('/subscriptions', (req, res) => {
    if (typeof req.body?.endpoint !== 'string') return res.status(400).json({ error: 'Invalid endpoint.' });
    db.prepare('DELETE FROM push_devices WHERE endpoint = ? AND user_id = ? AND session_hash = ?')
      .run(req.body.endpoint, req.user.id, req.pushSession);
    res.json({ enabled: false });
  });
  router.post('/test', (req, res) => {
    const device = typeof req.body?.endpoint === 'string' && db.prepare(
      'SELECT id FROM push_devices WHERE endpoint = ? AND user_id = ? AND session_hash = ?'
    ).get(req.body.endpoint, req.user.id, req.pushSession);
    if (!device) return res.status(404).json({ error: 'この端末の通知を有効にしてください。' });
    const recent = db.prepare('SELECT MAX(created_at) AS time FROM push_queue WHERE device_id = ? AND notification_id IS NULL').get(device.id);
    const previous = testTimes.get(device.id) || recent.time || 0;
    if (Date.now() - previous < 60000) return res.status(429).json({ error: '1分後にもう一度お試しください。' });
    const time = Date.now(); testTimes.set(device.id, time);
    if (testTimes.size > 1000) for (const [id, at] of testTimes) if (time - at >= 60000) testTimes.delete(id);
    db.prepare('INSERT INTO push_queue (device_id, created_at, next_at) VALUES (?, ?, ?)').run(device.id, time, time);
    res.status(202).json({ queued: true });
  });
  return router;
}
const testTimes = new Map();
let timer;
function start() {
  if (!timer) { timer = setInterval(() => flush().catch(() => console.error('Web Push queue processing failed.')), 2000); timer.unref(); }
}
module.exports = { enqueue, flush, start, routes, validSubscription, publicKey: keys.publicKey };
