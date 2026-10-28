const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const dataDirectory = process.env.KAGOPITA_DATA_DIR || path.join(__dirname, 'data');
fs.mkdirSync(dataDirectory, { recursive: true });

const db = new DatabaseSync(path.join(dataDirectory, 'kagopita.sqlite'));
db.exec(`
  PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA busy_timeout = 5000;
  PRAGMA wal_autocheckpoint = 1000;

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    email TEXT,
    password_salt TEXT,
    password_hash TEXT,
    email_verified INTEGER NOT NULL DEFAULT 0,
    avatar_data TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS email_verification_tokens (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS password_reset_tokens (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS channels (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS channel_members (
    channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'member')),
    joined_at TEXT NOT NULL,
    PRIMARY KEY (channel_id, user_id)
  );
  CREATE TABLE IF NOT EXISTS invites (
    code TEXT PRIMARY KEY COLLATE NOCASE,
    channel_id TEXT REFERENCES channels(id) ON DELETE CASCADE,
    is_bootstrap INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS one_bootstrap_invite
    ON invites(is_bootstrap) WHERE is_bootstrap = 1;
  CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
  CREATE INDEX IF NOT EXISTS channel_members_user_joined
    ON channel_members(user_id, joined_at);
  CREATE INDEX IF NOT EXISTS invites_channel ON invites(channel_id);
  CREATE TABLE IF NOT EXISTS shopping_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    qty TEXT NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0,
    added_by TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS favorite_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    qty TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE (channel_id, category, name)
  );
  CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    user_id TEXT,
    username TEXT NOT NULL,
    action TEXT NOT NULL,
    item TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS shopping_items_channel_id ON shopping_items(channel_id, id);
  CREATE INDEX IF NOT EXISTS activity_log_channel_id ON activity_log(channel_id, id);
  CREATE TABLE IF NOT EXISTS app_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

const itemColumns = new Set(db.prepare('PRAGMA table_info(shopping_items)').all().map(column => column.name));
for (const [name, definition] of Object.entries({
  notes: "TEXT NOT NULL DEFAULT ''", price: 'INTEGER', deleted_at: 'TEXT',
  recurrence: "TEXT NOT NULL DEFAULT 'none'", next_due_at: 'TEXT'
})) {
  if (!itemColumns.has(name)) db.exec(`ALTER TABLE shopping_items ADD COLUMN ${name} ${definition}`);
}
if (!db.prepare('PRAGMA table_info(channels)').all().some(column => column.name === 'archived_at')) {
  db.exec('ALTER TABLE channels ADD COLUMN archived_at TEXT');
}
if (!itemColumns.has('assigned_to')) {
  db.exec('ALTER TABLE shopping_items ADD COLUMN assigned_to TEXT REFERENCES users(id) ON DELETE SET NULL');
}

const userColumns = new Set(db.prepare('PRAGMA table_info(users)').all().map(column => column.name));
if (!userColumns.has('email')) db.exec('ALTER TABLE users ADD COLUMN email TEXT');
if (!userColumns.has('password_salt')) db.exec('ALTER TABLE users ADD COLUMN password_salt TEXT');
if (!userColumns.has('password_hash')) db.exec('ALTER TABLE users ADD COLUMN password_hash TEXT');
if (!userColumns.has('email_verified')) {
  db.exec('ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0');
}
if (!userColumns.has('avatar_data')) db.exec('ALTER TABLE users ADD COLUMN avatar_data TEXT');
for (const column of ['terms_accepted_version', 'terms_accepted_at', 'terms_seen_version']) {
  if (!userColumns.has(column)) db.exec(`ALTER TABLE users ADD COLUMN ${column} TEXT`);
}
db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique
  ON users(email COLLATE NOCASE) WHERE email IS NOT NULL;
  CREATE INDEX IF NOT EXISTS email_verification_user ON email_verification_tokens(user_id);
  CREATE INDEX IF NOT EXISTS email_verification_expiry ON email_verification_tokens(expires_at);
  CREATE INDEX IF NOT EXISTS password_reset_user ON password_reset_tokens(user_id);
  CREATE INDEX IF NOT EXISTS password_reset_expiry ON password_reset_tokens(expires_at);
`);

const now = () => new Date().toISOString();
function transaction(callback) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = callback();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // SQLite can automatically roll back a transaction after a storage error.
    }
    throw error;
  }
}

const sessionHash = token => crypto.createHash('sha256').update(token).digest('hex');

function generateInviteCode() {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 8 }, () => alphabet[crypto.randomInt(alphabet.length)]).join('');
}

function insertBootstrapInvite(code) {
  db.prepare(`
    INSERT OR IGNORE INTO invites (code, channel_id, is_bootstrap, created_at)
    VALUES (?, NULL, 1, ?)
  `).run(code, now());
}

function migrateLegacyState(bootstrapCode) {
  const imported = db.prepare("SELECT value FROM app_meta WHERE key = 'legacy_json_imported'").get();
  if (!imported) {
    const legacyPath = path.join(dataDirectory, 'family-state.json');
    if (fs.existsSync(legacyPath)) {
      const legacy = JSON.parse(fs.readFileSync(legacyPath, 'utf8'));
      if (Array.isArray(legacy.members) && legacy.members.length &&
          Array.isArray(legacy.categories) && Array.isArray(legacy.sessions)) {
        transaction(() => {
          const channelId = crypto.randomUUID();
          const adminId = legacy.adminId || legacy.members.find(member => member.role === 'admin')?.id ||
            legacy.members[0].id;
          db.prepare('INSERT INTO channels (id, name, created_at) VALUES (?, ?, ?)')
            .run(channelId, '家族の買い物', now());

          for (const member of legacy.members) {
            db.prepare('INSERT OR IGNORE INTO users (id, username, created_at) VALUES (?, ?, ?)')
              .run(member.id, member.username, now());
            db.prepare(`
              INSERT OR IGNORE INTO channel_members (channel_id, user_id, role, joined_at)
              VALUES (?, ?, ?, ?)
            `).run(channelId, member.id, member.id === adminId ? 'admin' : 'member', now());
          }

          const insertItem = db.prepare(`
            INSERT INTO shopping_items (channel_id, category, name, qty, completed, added_by, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `);
          for (const category of legacy.categories) {
            for (const item of category.items || []) {
              insertItem.run(channelId, category.name, item.name, item.qty || '1個',
                item.completed ? 1 : 0, item.addedBy || '', now());
            }
          }

          const insertActivity = db.prepare(`
            INSERT INTO activity_log (channel_id, user_id, username, action, item, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
          `);
          for (const activity of legacy.activityLog || []) {
            const user = legacy.members.find(member => member.username === activity.name);
            insertActivity.run(channelId, user?.id || null, activity.name, activity.action,
              activity.item || '', activity.createdAt || now());
          }

          const insertSession = db.prepare(`
            INSERT OR IGNORE INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)
          `);
          for (const [token, userId, expiresAt] of legacy.sessions) {
            if (expiresAt > Date.now()) insertSession.run(sessionHash(token), userId, expiresAt);
          }

          for (const invite of legacy.pendingInvites || []) {
            if (/^[a-z0-9]{8}$/i.test(invite) &&
                invite.toLowerCase() !== bootstrapCode.toLowerCase()) {
              db.prepare(`
                INSERT OR IGNORE INTO invites (code, channel_id, is_bootstrap, created_at)
                VALUES (?, ?, 0, ?)
              `).run(invite, channelId, now());
            }
          }

          db.prepare("INSERT INTO app_meta (key, value) VALUES ('legacy_json_imported', '1')")
            .run();
        });
      }
    }
  }

  const bootstrapInitialized = db.prepare(
    "SELECT value FROM app_meta WHERE key = 'bootstrap_invite_initialized'"
  ).get();
  if (!bootstrapInitialized) {
    insertBootstrapInvite(bootstrapCode);
    db.prepare("INSERT INTO app_meta (key, value) VALUES ('bootstrap_invite_initialized', '1')")
      .run();
  }
}

const configuredCode = process.env.FAMILY_SHARE_TOKEN;
if (configuredCode && !/^[a-z0-9]{8}$/i.test(configuredCode)) {
  throw new Error('FAMILY_SHARE_TOKEN must be exactly 8 alphanumeric characters.');
}

const codePath = path.join(dataDirectory, 'share-token');
let bootstrapCode = configuredCode;
if (!bootstrapCode && fs.existsSync(codePath)) {
  bootstrapCode = fs.readFileSync(codePath, 'utf8').trim();
}
if (!bootstrapCode || !/^[a-z0-9]{8}$/i.test(bootstrapCode)) {
  bootstrapCode = generateInviteCode();
}
if (!configuredCode) fs.writeFileSync(codePath, bootstrapCode, { mode: 0o600 });

migrateLegacyState(bootstrapCode);

// Rebuild the constrained legacy role column without losing memberships.
if (!db.prepare("SELECT sql FROM sqlite_master WHERE name = 'channel_members'").get().sql.includes("'owner', 'admin'")) {
  transaction(() => {
    db.exec(`
      CREATE TABLE channel_members_roles (
        channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'editor', 'member')),
        joined_at TEXT NOT NULL,
        PRIMARY KEY (channel_id, user_id)
      );
      INSERT INTO channel_members_roles SELECT channel_id, user_id,
        CASE role WHEN 'owner' THEN 'owner' WHEN 'admin' THEN 'owner' WHEN 'editor' THEN 'editor' WHEN 'member' THEN 'editor' ELSE 'member' END, joined_at FROM channel_members;
      DROP TABLE channel_members;
      ALTER TABLE channel_members_roles RENAME TO channel_members;
      CREATE INDEX channel_members_user_joined ON channel_members(user_id, joined_at);
    `);
  });
}
// The creator is permanent; delegated administrators never replace them.
if (!db.prepare('PRAGMA table_info(channels)').all().some(column => column.name === 'creator_id')) {
  transaction(() => {
    db.exec('ALTER TABLE channels ADD COLUMN creator_id TEXT');
    db.exec(`UPDATE channels SET creator_id = COALESCE(
      (SELECT a.user_id FROM activity_log a JOIN channel_members m ON m.channel_id = a.channel_id AND m.user_id = a.user_id
        WHERE a.channel_id = channels.id AND a.action = 'created' ORDER BY a.id LIMIT 1),
      (SELECT user_id FROM channel_members WHERE channel_id = channels.id AND role = 'owner' LIMIT 1));
      UPDATE channel_members SET role = 'admin' WHERE role = 'owner' AND user_id != (SELECT creator_id FROM channels WHERE id = channel_id);
      UPDATE channel_members SET role = 'owner' WHERE user_id = (SELECT creator_id FROM channels WHERE id = channel_id);`);
  });
}
db.exec(`CREATE TRIGGER IF NOT EXISTS channel_creator_on_owner AFTER INSERT ON channel_members
  WHEN NEW.role = 'owner' BEGIN
    UPDATE channels SET creator_id = NEW.user_id WHERE id = NEW.channel_id AND creator_id IS NULL;
  END;`);
db.exec(`
  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    actor_name TEXT NOT NULL,
    action TEXT NOT NULL,
    item TEXT NOT NULL,
    created_at TEXT NOT NULL,
    read_at TEXT
  );
  CREATE INDEX IF NOT EXISTS notifications_user_id ON notifications(user_id, id);
`);


function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .run(sessionHash(token), userId, expiresAt);
  return { token, expiresAt };
}

function getSession(token) {
  if (!token) return null;
  const row = db.prepare(`
    SELECT users.id, users.username, users.email, users.email_verified, sessions.expires_at
    FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ?
  `).get(sessionHash(token));
  if (!row) return null;
  if (row.expires_at <= Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sessionHash(token));
    return null;
  }
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    emailVerified: Boolean(row.email_verified)
  };
}

function getInvite(code) {
  if (typeof code !== 'string') return null;
  return db.prepare('SELECT code, channel_id, is_bootstrap FROM invites WHERE code = ?')
    .get(code);
}

function createChannel(name, userId) {
  const channelId = crypto.randomUUID();
  const timestamp = now();
  const create = () => transaction(() => {
    db.prepare('INSERT INTO channels (id, name, created_at) VALUES (?, ?, ?)')
      .run(channelId, name, timestamp);
    db.prepare(`
      INSERT INTO channel_members (channel_id, user_id, role, joined_at)
      VALUES (?, ?, 'owner', ?)
    `).run(channelId, userId, timestamp);
    db.prepare(`
      INSERT INTO activity_log (channel_id, user_id, username, action, item, created_at)
      VALUES (?, ?, (SELECT username FROM users WHERE id = ?), 'created', '', ?)
    `).run(channelId, userId, userId, timestamp);
  });
  create();
  return channelId;
}

module.exports = {
  db,
  bootstrapCode,
  createChannel,
  createSession,
  generateInviteCode,
  getInvite,
  getSession,
  now,
  sessionHash,
  transaction
};
