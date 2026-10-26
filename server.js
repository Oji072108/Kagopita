require('dotenv').config();

const express = require('express');
const crypto = require('crypto');
const path = require('path');
const { promisify } = require('util');
const nodemailer = require('nodemailer');
const { broadcast, subscribe } = require('./realtime');
const database = require('./database');
const { createChannel, db } = database;
const scrypt = promisify(crypto.scrypt);

const app = express();
const PORT = process.env.PORT || 3000;
const cookieName = 'kagopita_session';
const inviteAttempts = new Map();
const loginAttempts = new Map();
const verificationAttempts = new Map();
const verificationCodeAttempts = new Map();
const emailInviteAttempts = new Map();
const smtpPort = Number(process.env.SMTP_PORT || 465);
const mailTransporter = process.env.SMTP_USER && process.env.SMTP_PASS
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: smtpPort,
      secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : smtpPort === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS.replace(/\s/g, '') }
    })
  : null;
app.locals.broadcast = broadcast;

app.use(express.json({ limit: '700kb' }));
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  res.set('Referrer-Policy', 'no-referrer');
  next();
});

app.get('/vendor/qrcode.min.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'node_modules', 'qrcodejs', 'qrcode.min.js'));
});
app.use('/css', express.static(path.join(__dirname, 'public', 'css')));
app.use('/js', express.static(path.join(__dirname, 'public', 'js')));
app.use(express.static(path.join(__dirname, 'public')));

function readSessionToken(req) {
  const cookie = (req.headers.cookie || '')
    .split(';')
    .map(value => value.trim())
    .find(value => value.startsWith(`${cookieName}=`));
  return cookie?.slice(cookieName.length + 1);
}

function recordInvalidInviteAttempt(req) {
  const now = Date.now();
  const address = req.ip || req.socket.remoteAddress || 'unknown';
  let attempt = inviteAttempts.get(address);
  if (!attempt || now - attempt.startedAt >= 15 * 60 * 1000) {
    attempt = { startedAt: now, count: 0 };
    inviteAttempts.set(address, attempt);
  }
  if (attempt.count >= 10) {
    return true;
  }
  attempt.count += 1;
  if (inviteAttempts.size > 5000) {
    for (const [key, value] of inviteAttempts) {
      if (now - value.startedAt >= 15 * 60 * 1000) inviteAttempts.delete(key);
    }
  }
  return false;
}

function requestAddress(req) {
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function isLoginRateLimited(req) {
  const attempt = loginAttempts.get(requestAddress(req));
  if (!attempt) return false;
  if (Date.now() - attempt.startedAt >= 15 * 60 * 1000) {
    loginAttempts.delete(requestAddress(req));
    return false;
  }
  return attempt.count >= 10;
}

function recordFailedLogin(req) {
  const now = Date.now();
  const address = requestAddress(req);
  let attempt = loginAttempts.get(address);
  if (!attempt || now - attempt.startedAt >= 15 * 60 * 1000) {
    attempt = { startedAt: now, count: 0 };
    loginAttempts.set(address, attempt);
  }
  attempt.count += 1;
  if (loginAttempts.size > 5000) {
    for (const [key, value] of loginAttempts) {
      if (now - value.startedAt >= 15 * 60 * 1000) loginAttempts.delete(key);
    }
  }
}

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function isValidEmail(email) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPassword(password) {
  return typeof password === 'string' && password.length >= 8 && password.length <= 128;
}

function validateAvatarData(value) {
  if (typeof value !== 'string' || value.length > 550_000) return null;
  const match = value.match(/^data:image\/(jpeg|png|webp);base64,([a-z0-9+/]+={0,2})$/i);
  if (!match) return null;
  const image = Buffer.from(match[2], 'base64');
  if (!image.length || image.length > 400 * 1024) return null;
  const validSignature = match[1] === 'jpeg'
    ? image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff
    : match[1] === 'png'
      ? image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : image.toString('ascii', 0, 4) === 'RIFF' && image.toString('ascii', 8, 12) === 'WEBP';
  return validSignature ? value : null;
}

function emailInviteRateLimited(userId) {
  const attempt = emailInviteAttempts.get(userId);
  if (!attempt) return false;
  if (Date.now() - attempt.startedAt >= 15 * 60 * 1000) {
    emailInviteAttempts.delete(userId);
    return false;
  }
  return attempt.count >= 10;
}

function recordEmailInvite(userId) {
  let attempt = emailInviteAttempts.get(userId);
  if (!attempt || Date.now() - attempt.startedAt >= 15 * 60 * 1000) {
    attempt = { startedAt: Date.now(), count: 0 };
    emailInviteAttempts.set(userId, attempt);
  }
  attempt.count += 1;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

async function sendListInviteEmail(email, code, channelName, inviterName) {
  if (!mailTransporter) {
    const error = new Error('メール送信が設定されていません。管理者にお問い合わせください。');
    error.code = 'SMTP_NOT_CONFIGURED';
    throw error;
  }
  const publicUrl = (process.env.PUBLIC_URL || `http://localhost:${PORT}`).replace(/\/+$/, '');
  const inviteUrl = `${publicUrl}/#invite=${encodeURIComponent(code)}`;
  const safeUrl = escapeHtml(inviteUrl);
  const safeChannel = escapeHtml(channelName);
  const safeInviter = escapeHtml(inviterName);
  await mailTransporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: `【カゴピタ】「${channelName}」への招待`,
    text: `${safeInviter}さんから「${channelName}」の共有リストに招待されました。\n\n次のリンクから参加できます。招待リンクは1回のみ使用できます。\n${inviteUrl}\n\nこの招待に心当たりがない場合は、このメールを破棄してください。\n\nカゴピタ サポート`,
    html: `<!doctype html><html lang="ja"><body style="margin:0;padding:32px 16px;background:#f4f7f5;color:#26332a;font-family:Arial,'Hiragino Kaku Gothic ProN',Meiryo,sans-serif"><table role="presentation" style="width:100%;max-width:560px;margin:0 auto;border-collapse:collapse;background:#fff;border:1px solid #e5ebe6;border-radius:12px"><tr><td style="padding:32px"><p style="margin:0 0 8px;color:#388e3c;font-size:13px;font-weight:700">KAGOPITA</p><h1 style="margin:0 0 18px;font-size:22px">共有リストへのご招待</h1><p style="margin:0 0 20px;font-size:15px;line-height:1.8">${safeInviter}さんから「${safeChannel}」の共有リストに招待されました。</p><p style="margin:0 0 24px;font-size:13px;line-height:1.8;color:#657269">以下のボタンから参加できます。招待リンクは1回のみ使用できます。</p><p style="margin:0 0 24px;text-align:center"><a href="${safeUrl}" style="display:inline-block;padding:14px 24px;border-radius:8px;background:#388e3c;color:#fff;text-decoration:none;font-weight:700">共有リストに参加する</a></p><p style="margin:0;font-size:12px;line-height:1.8;color:#657269">この招待にお心当たりがない場合は、このメールを破棄してください。</p><p style="margin:24px 0 0;padding-top:16px;border-top:1px solid #e5ebe6;font-size:12px;color:#839087">カゴピタ サポート</p></td></tr></table></body></html>`
  });
}

function isVerificationRateLimited(req) {
  const address = requestAddress(req);
  const attempt = verificationAttempts.get(address);
  if (!attempt) return false;
  if (Date.now() - attempt.startedAt >= 15 * 60 * 1000) {
    verificationAttempts.delete(address);
    return false;
  }
  return attempt.count >= 5;
}

function recordVerificationRequest(req) {
  const address = requestAddress(req);
  let attempt = verificationAttempts.get(address);
  if (!attempt || Date.now() - attempt.startedAt >= 15 * 60 * 1000) {
    attempt = { startedAt: Date.now(), count: 0 };
    verificationAttempts.set(address, attempt);
  }
  attempt.count += 1;
}

function verificationCodeAttemptKey(req, email) {
  return `${requestAddress(req)}:${email}`;
}

function isVerificationCodeRateLimited(req, email) {
  const key = verificationCodeAttemptKey(req, email);
  const attempt = verificationCodeAttempts.get(key);
  if (!attempt) return false;
  if (Date.now() - attempt.startedAt >= 15 * 60 * 1000) {
    verificationCodeAttempts.delete(key);
    return false;
  }
  return attempt.count >= 10;
}

function recordVerificationCodeAttempt(req, email) {
  const key = verificationCodeAttemptKey(req, email);
  let attempt = verificationCodeAttempts.get(key);
  if (!attempt || Date.now() - attempt.startedAt >= 15 * 60 * 1000) {
    attempt = { startedAt: Date.now(), count: 0 };
    verificationCodeAttempts.set(key, attempt);
  }
  attempt.count += 1;
}

async function sendVerificationEmail(email, code) {
  if (!mailTransporter) {
    const error = new Error('メール送信が設定されていません。管理者にお問い合わせください。');
    error.code = 'SMTP_NOT_CONFIGURED';
    throw error;
  }
  await mailTransporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: '【カゴピタ】メールアドレス確認コードのお知らせ',
    text: `カゴピタをご利用いただき、ありがとうございます。\n\nメールアドレスの確認コードをお知らせいたします。\n\n確認コード：${code}\n\n確認コードの有効期限は発行から24時間です。アプリの確認画面に入力して、登録を完了してください。\n\nこの操作にお心当たりがない場合は、このメールを破棄してください。確認コードを他の方に共有しないでください。\n\nカゴピタ サポート`,
    html: `<!doctype html><html lang="ja"><body style="margin:0;padding:32px 16px;background:#f4f7f5;color:#26332a;font-family:Arial,'Hiragino Kaku Gothic ProN',Meiryo,sans-serif"><table role="presentation" style="width:100%;max-width:560px;margin:0 auto;border-collapse:collapse;background:#fff;border:1px solid #e5ebe6;border-radius:12px"><tr><td style="padding:32px"><p style="margin:0 0 8px;color:#388e3c;font-size:13px;font-weight:700">KAGOPITA</p><h1 style="margin:0 0 18px;font-size:22px">メールアドレスの確認</h1><p style="margin:0 0 20px;font-size:15px;line-height:1.8">カゴピタをご利用いただき、ありがとうございます。以下の確認コードをアプリに入力して、メールアドレスの登録を完了してください。</p><div style="margin:0 0 20px;padding:18px;background:#f4f7f5;border:1px solid #e5ebe6;border-radius:8px;text-align:center"><span style="font-size:30px;font-weight:700;letter-spacing:6px;color:#2e7d32">${code}</span></div><p style="margin:0 0 20px;font-size:13px;line-height:1.8;color:#657269">確認コードの有効期限は発行から24時間です。期限が切れた場合は、アプリから新しいコードを再送してください。</p><p style="margin:0;font-size:12px;line-height:1.8;color:#657269">この操作にお心当たりがない場合は、このメールを破棄してください。確認コードを他の方に共有しないでください。</p><p style="margin:24px 0 0;padding-top:16px;border-top:1px solid #e5ebe6;font-size:12px;color:#839087">カゴピタ サポート</p></td></tr></table></body></html>`
  });
}

function createVerificationToken(userId) {
  const token = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
  db.prepare('DELETE FROM email_verification_tokens WHERE user_id = ?').run(userId);
  db.prepare(`
    INSERT INTO email_verification_tokens (token_hash, user_id, expires_at) VALUES (?, ?, ?)
  `).run(database.sessionHash(token), userId, expiresAt);
  return token;
}

function createPasswordResetToken(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + 60 * 60 * 1000;
  db.prepare('DELETE FROM password_reset_tokens WHERE user_id = ?').run(userId);
  db.prepare(`INSERT INTO password_reset_tokens (token_hash, user_id, expires_at) VALUES (?, ?, ?)`)
    .run(database.sessionHash(token), userId, expiresAt);
  return token;
}

async function sendPasswordResetEmail(email, token) {
  if (!mailTransporter) {
    const error = new Error('SMTP is not configured.');
    error.code = 'SMTP_NOT_CONFIGURED';
    throw error;
  }
  const url = `${process.env.PUBLIC_URL || `http://localhost:${PORT}`}/?reset=${encodeURIComponent(token)}`;
  const subject = 'カゴピタ｜パスワード再設定のご案内';
  const text = `カゴピタをご利用いただきありがとうございます。\n\nパスワードを再設定するには、以下のリンクを開いてください。\n${url}\n\nこのリンクの有効期限は1時間です。心当たりがない場合は、このメールを削除してください。\n\nカゴピタ運営チーム`;
  const html = `<!doctype html><html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head><body style="margin:0;background:#f3f7f4;color:#26352b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans JP',Arial,sans-serif;line-height:1.7"><div style="padding:32px 16px"><div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #dfe9e1;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(36,72,43,.08)"><div style="padding:24px 28px;background:#4d8f3d;color:#fff"><div style="font-size:24px;font-weight:700;letter-spacing:.04em">カゴピタ</div><div style="font-size:12px;opacity:.9">みんなで使えるお買い物リスト</div></div><div style="padding:32px 28px"><h1 style="margin:0 0 20px;font-size:22px;line-height:1.4;color:#1f3024">パスワード再設定のご案内</h1><p style="margin:0 0 16px">カゴピタをご利用いただきありがとうございます。</p><p style="margin:0 0 24px">パスワードを再設定するには、下のボタンを押してください。</p><p style="margin:0 0 28px;text-align:center"><a href="${url}" style="display:inline-block;padding:14px 28px;border-radius:10px;background:#4caf50;color:#fff;text-decoration:none;font-weight:700">パスワードを再設定する</a></p><p style="margin:0;padding:16px;border-radius:10px;background:#f3f7f4;color:#5d6c62;font-size:13px">このリンクの有効期限は1時間です。期限を過ぎた場合は、もう一度再設定メールをリクエストしてください。</p><p style="margin:24px 0 0;color:#68766d;font-size:13px">このメールに心当たりがない場合は、操作せずに削除してください。</p></div><div style="padding:18px 28px;border-top:1px solid #edf1ee;color:#7b887f;font-size:12px">カゴピタ運営チーム</div></div></div></body></html>`;
  const professionalHtml = `<!doctype html><html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head><body style="margin:0;background:#171918;color:#e7f0e9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans JP',Arial,sans-serif;line-height:1.8"><div style="padding:28px 14px;background:#171918"><div style="max-width:620px;margin:0 auto;background:#202321;border:1px solid #303832;border-radius:4px;overflow:hidden"><div style="padding:34px 34px 22px"><div style="font-size:22px;font-weight:700;letter-spacing:.08em;color:#62b85b">KAGOPITA</div><h1 style="margin:22px 0 18px;font-size:30px;line-height:1.4;color:#e7f0e9">パスワードの再設定</h1><p style="margin:0 0 26px;font-size:17px;color:#d7e3d9">カゴピタをご利用いただき、ありがとうございます。<br>以下のボタンから新しいパスワードを設定してください。</p><p style="margin:0 0 28px;text-align:center"><a href="${url}" style="display:block;padding:16px 20px;border-radius:10px;background:#69bd61;color:#102214;text-decoration:none;font-size:17px;font-weight:700">パスワードを再設定する</a></p><p style="margin:0 0 22px;font-size:14px;color:#aebdb1">このリンクの有効期限は発行から1時間です。期限が切れた場合は、アプリからもう一度再設定メールを送信してください。</p><p style="margin:0;font-size:14px;color:#aebdb1">この操作に心当たりがない場合は、このメールを破棄してください。リンクを他の人に共有しないでください。</p><div style="margin-top:30px;padding-top:20px;border-top:1px solid #394139;font-size:14px;color:#9cac9f">カゴピタ サポート</div></div></div></div></body></html>`;
  return mailTransporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject,
    text,
    html: professionalHtml
  });
  await mailTransporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: 'カゴピタ パスワード再設定',
    text: `パスワードを再設定するには、次のリンクを開いてください。\n\n${url}\n\nこのリンクは1時間有効です。`,
    html: `<p>パスワードを再設定するには、次のリンクを開いてください。</p><p><a href="${url}">${url}</a></p><p>このリンクは1時間有効です。</p>`
  });
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return { salt: salt.toString('hex'), hash: Buffer.from(hash).toString('hex') };
}

async function verifyPassword(password, saltHex, hashHex) {
  const expected = Buffer.from(hashHex, 'hex');
  if (expected.length !== 64) return false;
  const actual = Buffer.from(await scrypt(password, Buffer.from(saltHex, 'hex'), 64));
  return crypto.timingSafeEqual(actual, expected);
}

function setSessionCookie(res, token, expiresAt) {
  res.cookie(cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    expires: new Date(expiresAt)
  });
}

function logActivity(channelId, user, action, item = '') {
  db.prepare(`
    INSERT INTO activity_log (channel_id, user_id, username, action, item, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(channelId, user?.id || null, user?.username || 'システム', action, item, database.now());
  db.prepare(`
    DELETE FROM activity_log
    WHERE channel_id = ? AND id NOT IN (
      SELECT id FROM activity_log WHERE channel_id = ? ORDER BY id DESC LIMIT 100
    )
  `).run(channelId, channelId);
  broadcast({ type: 'update', channelId });
}

function getChannelRole(channelId, userId) {
  return db.prepare(`
    SELECT role FROM channel_members WHERE channel_id = ? AND user_id = ?
  `).get(channelId, userId)?.role;
}

function attachChannel(req, res, next) {
  const channel = db.prepare('SELECT id, name FROM channels WHERE id = ?')
    .get(req.params.channelId);
  const role = channel && getChannelRole(channel.id, req.user.id);
  if (!channel || !role) {
    return res.status(403).json({ error: 'You are not a member of this list.' });
  }
  req.channel = channel;
  req.channelRole = role;
  next();
}

function requireChannelAdmin(req, res, next) {
  if (req.channelRole !== 'admin') {
    return res.status(403).json({ error: 'Only this list’s admin can do that.' });
  }
  next();
}

app.post('/api/session', (req, res) => {
  const invite = database.getInvite(req.body?.invite);
  const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
  if (!invite) {
    if (recordInvalidInviteAttempt(req)) {
      return res.status(429).json({ error: '招待コードの入力回数が上限に達しました。15分後にもう一度お試しください。' });
    }
    return res.status(401).json({ error: 'This invite link is invalid or has already been used.' });
  }
  if (!username || username.length > 30) {
    return res.status(400).json({ error: '名前は1〜30文字で入力してください。' });
  }

  const existingUser = database.getSession(readSessionToken(req));
  const user = existingUser || { id: require('crypto').randomUUID(), username };
  let session = null;
  const join = () => database.transaction(() => {
    if (!existingUser) {
      db.prepare('INSERT INTO users (id, username, created_at) VALUES (?, ?, ?)')
        .run(user.id, username, database.now());
      session = database.createSession(user.id);
    }

    let channelId = invite.channel_id;
    if (invite.is_bootstrap) {
      channelId = require('crypto').randomUUID();
      const timestamp = database.now();
      db.prepare('INSERT INTO channels (id, name, created_at) VALUES (?, ?, ?)')
        .run(channelId, '家族の買い物', timestamp);
      db.prepare("INSERT INTO channel_members (channel_id, user_id, role, joined_at) VALUES (?, ?, 'admin', ?)")
        .run(channelId, user.id, timestamp);
      db.prepare(`
        INSERT INTO activity_log (channel_id, user_id, username, action, item, created_at)
        VALUES (?, ?, ?, 'created', '', ?)
      `).run(channelId, user.id, user.username, timestamp);
      db.prepare('DELETE FROM invites WHERE code = ?').run(invite.code);
      db.prepare("INSERT OR IGNORE INTO app_meta (key, value) VALUES ('bootstrap_invite_initialized', '1')")
        .run();
    } else {
      db.prepare('INSERT OR IGNORE INTO channel_members (channel_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)')
        .run(channelId, user.id, 'member', database.now());
      db.prepare('DELETE FROM invites WHERE code = ?').run(invite.code);
    }

    logActivity(channelId, user, 'joined');
    return channelId;
  });
  const channelId = join();
  if (session) setSessionCookie(res, session.token, session.expiresAt);

  res.json({
    message: 'Joined the list.',
    user: { id: user.id, username: user.username },
    channelId,
    role: getChannelRole(channelId, user.id)
  });
});

app.post('/api/account', (req, res) => {
  const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
  if (!username || username.length > 30) {
    return res.status(400).json({ error: '名前は1〜30文字で入力してください。' });
  }
  const userId = require('crypto').randomUUID();
  const createAccount = () => database.transaction(() => {
    db.prepare('INSERT INTO users (id, username, created_at) VALUES (?, ?, ?)')
      .run(userId, username, database.now());
    return database.createSession(userId);
  });
  const session = createAccount();
  setSessionCookie(res, session.token, session.expiresAt);
  res.status(201).json({ user: { id: userId, username } });
});

app.post('/api/register', async (req, res, next) => {
  const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;
  if (!username || username.length > 30) {
    return res.status(400).json({ error: '名前は1〜30文字で入力してください。' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: '有効なメールアドレスを入力してください。' });
  }
  if (!isValidPassword(password)) {
    return res.status(400).json({ error: 'パスワードは8〜128文字で設定してください。' });
  }
  if (!mailTransporter) {
    return res.status(503).json({ error: 'メール送信が設定されていません。管理者にお問い合わせください。' });
  }

  const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existingUser) return res.status(409).json({ error: 'このメールアドレスは登録済みです。' });

  const userId = crypto.randomUUID();
  let token;
  try {
    const { salt, hash } = await hashPassword(password);
    database.transaction(() => {
      db.prepare(`
        INSERT INTO users (id, username, email, password_salt, password_hash, email_verified, created_at)
        VALUES (?, ?, ?, ?, ?, 0, ?)
      `).run(userId, username, email, salt, hash, database.now());
      token = createVerificationToken(userId);
    });
    await sendVerificationEmail(email, token);
    res.status(201).json({ pendingVerification: true, email });
  } catch (error) {
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    if ((error.errcode & 0xff) === 19) {
      return res.status(409).json({ error: 'このメールアドレスは登録済みです。' });
    }
    console.error('Could not send account verification email.', error);
    res.status(502).json({ error: '確認メールを送信できませんでした。メール設定を確認して、もう一度お試しください。' });
  }
});

app.post('/api/verify-email', (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
  if (!isValidEmail(email) || !/^\d{6}$/.test(code)) {
    return res.status(400).json({ error: 'メールアドレスと6桁の確認コードを入力してください。' });
  }
  if (isVerificationCodeRateLimited(req, email)) {
    return res.status(429).json({ error: '確認コードの入力回数が上限に達しました。15分後にもう一度お試しください。' });
  }
  recordVerificationCodeAttempt(req, email);

  const tokenHash = database.sessionHash(code);
  const verification = db.prepare(`
    SELECT tokens.user_id, tokens.expires_at
    FROM email_verification_tokens AS tokens
    JOIN users ON users.id = tokens.user_id
    WHERE tokens.token_hash = ? AND users.email = ? AND users.email_verified = 0
  `).get(tokenHash, email);
  if (!verification || verification.expires_at <= Date.now()) {
    if (verification) {
      db.prepare('DELETE FROM email_verification_tokens WHERE token_hash = ?').run(tokenHash);
    }
    return res.status(400).json({ error: '確認コードが正しくないか、有効期限が切れています。' });
  }

  const session = database.transaction(() => {
    db.prepare('UPDATE users SET email_verified = 1 WHERE id = ?').run(verification.user_id);
    db.prepare('DELETE FROM email_verification_tokens WHERE user_id = ?').run(verification.user_id);
    return database.createSession(verification.user_id);
  });
  verificationCodeAttempts.delete(verificationCodeAttemptKey(req, email));
  setSessionCookie(res, session.token, session.expiresAt);
  res.json({ verified: true });
});

app.get('/api/verify-email', (req, res) => {
  const token = typeof req.query.token === 'string' ? req.query.token : '';
  if (!/^[a-f0-9]{64}$/i.test(token)) {
    return res.redirect('/?verification=invalid');
  }
  const verification = db.prepare(`
    SELECT user_id, expires_at FROM email_verification_tokens WHERE token_hash = ?
  `).get(database.sessionHash(token));
  if (!verification || verification.expires_at <= Date.now()) {
    if (verification) {
      db.prepare('DELETE FROM email_verification_tokens WHERE token_hash = ?')
        .run(database.sessionHash(token));
    }
    return res.redirect('/?verification=invalid');
  }

  const session = database.transaction(() => {
    db.prepare('UPDATE users SET email_verified = 1 WHERE id = ?').run(verification.user_id);
    db.prepare('DELETE FROM email_verification_tokens WHERE user_id = ?').run(verification.user_id);
    return database.createSession(verification.user_id);
  });
  setSessionCookie(res, session.token, session.expiresAt);
  res.redirect('/?verified=1');
});

app.post('/api/resend-verification', async (req, res, next) => {
  if (isVerificationRateLimited(req)) {
    return res.status(429).json({ error: '再送回数の上限に達しました。15分後にもう一度お試しください。' });
  }
  recordVerificationRequest(req);
  const email = normalizeEmail(req.body?.email);
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: '有効なメールアドレスを入力してください。' });
  }
  const response = { message: '未確認のアカウントがある場合、確認メールを送信します。' };
  const user = db.prepare('SELECT id FROM users WHERE email = ? AND email_verified = 0').get(email);
  if (!user) return res.json(response);
  if (!mailTransporter) {
    return res.status(503).json({ error: 'メール送信が設定されていません。管理者にお問い合わせください。' });
  }

  try {
    const token = database.transaction(() => createVerificationToken(user.id));
    await sendVerificationEmail(email, token);
    res.json(response);
  } catch (error) {
    console.error('Could not resend account verification email.', error);
    res.status(502).json({ error: '確認メールを送信できませんでした。時間をおいて再度お試しください。' });
  }
});

app.post('/api/login', async (req, res, next) => {
  if (isLoginRateLimited(req)) {
    return res.status(429).json({ error: 'ログイン試行回数の上限に達しました。15分後にもう一度お試しください。' });
  }
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;
  if (!isValidEmail(email) || typeof password !== 'string' || password.length > 128) {
    recordFailedLogin(req);
    return res.status(401).json({ error: 'メールアドレスまたはパスワードが正しくありません。' });
  }

  try {
    const user = db.prepare(`
      SELECT id, username, email, password_salt, password_hash, email_verified
      FROM users WHERE email = ?
    `).get(email);
    const valid = user?.password_salt && user.password_hash &&
      await verifyPassword(password, user.password_salt, user.password_hash);
    if (!valid) {
      recordFailedLogin(req);
      return res.status(401).json({ error: 'メールアドレスまたはパスワードが正しくありません。' });
    }
    if (!user.email_verified) {
      return res.status(403).json({ error: 'メールアドレスの確認が必要です。確認メールを再送してください。' });
    }

    loginAttempts.delete(requestAddress(req));
    const session = database.createSession(user.id);
    setSessionCookie(res, session.token, session.expiresAt);
    res.json({ user: { id: user.id, username: user.username, email: user.email } });
  } catch (error) {
    next(error);
  }
});

app.post('/api/logout', (req, res) => {
  const token = readSessionToken(req);
  if (token) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(database.sessionHash(token));
  }
  res.clearCookie(cookieName, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/'
  });
  res.json({ message: 'Signed out.' });
});

app.post('/api/password-reset/request', async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const response = { message: 'パスワード再設定メールを送信しました。' };
  if (!isValidEmail(email)) return res.status(400).json({ error: '有効なメールアドレスを入力してください。' });
  const user = db.prepare('SELECT id FROM users WHERE email = ? AND email_verified = 1').get(email);
  if (!user) return res.status(404).json({ error: 'このメールアドレスのアカウントが見つかりません。' });
  if (!mailTransporter) return res.status(503).json({ error: 'メール送信が設定されていません。' });
  try {
    const token = database.transaction(() => createPasswordResetToken(user.id));
    await sendPasswordResetEmail(email, token);
    res.json(response);
  } catch (error) {
    console.error('Could not send password reset email.', error);
    res.status(502).json({ error: 'パスワード再設定メールを送信できませんでした。' });
  }
});

app.post('/api/password-reset/complete', async (req, res) => {
  const token = typeof req.body?.token === 'string' ? req.body.token : '';
  const password = req.body?.password;
  if (!/^[a-f0-9]{64}$/i.test(token) || !isValidPassword(password)) {
    return res.status(400).json({ error: '有効な再設定リンクと8文字以上のパスワードが必要です。' });
  }
  const tokenHash = database.sessionHash(token);
  const reset = db.prepare('SELECT user_id, expires_at FROM password_reset_tokens WHERE token_hash = ?').get(tokenHash);
  if (!reset || reset.expires_at <= Date.now()) return res.status(400).json({ error: '再設定リンクが無効または期限切れです。' });
  const { salt, hash } = await hashPassword(password);
  const session = database.transaction(() => {
    db.prepare('UPDATE users SET password_salt = ?, password_hash = ? WHERE id = ?').run(salt, hash, reset.user_id);
    db.prepare('DELETE FROM password_reset_tokens WHERE user_id = ?').run(reset.user_id);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(reset.user_id);
    return database.createSession(reset.user_id);
  });
  setSessionCookie(res, session.token, session.expiresAt);
  res.json({ message: 'パスワードを更新しました。', loggedIn: true });
});

app.use('/api', (req, res, next) => {
  if (req.path === '/session' && req.method === 'POST') return next();
  const user = database.getSession(readSessionToken(req));
  if (!user) {
    return res.status(401).json({ error: '招待リンクを開くか、もう一度ログインしてください。' });
  }
  req.user = user;
  next();
});

app.post('/api/account/credentials', async (req, res, next) => {
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: '有効なメールアドレスを入力してください。' });
  }
  if (!isValidPassword(password)) {
    return res.status(400).json({ error: 'パスワードは8〜128文字で設定してください。' });
  }
  if (!mailTransporter) {
    return res.status(503).json({ error: 'メール送信が設定されていません。管理者にお問い合わせください。' });
  }
  if (req.user.email) {
    return res.status(409).json({ error: 'このアカウントにはメールアドレスが登録済みです。' });
  }
  const existingUser = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?')
    .get(email, req.user.id);
  if (existingUser) return res.status(409).json({ error: 'このメールアドレスは登録済みです。' });

  let token;
  try {
    const { salt, hash } = await hashPassword(password);
    database.transaction(() => {
      db.prepare(`
        UPDATE users
        SET email = ?, password_salt = ?, password_hash = ?, email_verified = 0
        WHERE id = ?
      `).run(email, salt, hash, req.user.id);
      token = createVerificationToken(req.user.id);
    });
    await sendVerificationEmail(email, token);
    res.json({ email, emailVerified: false });
  } catch (error) {
    database.transaction(() => {
      db.prepare('DELETE FROM email_verification_tokens WHERE user_id = ?').run(req.user.id);
      db.prepare(`
        UPDATE users SET email = NULL, password_salt = NULL, password_hash = NULL,
          email_verified = 0 WHERE id = ?
      `).run(req.user.id);
    });
    if ((error.errcode & 0xff) === 19) {
      return res.status(409).json({ error: 'このメールアドレスは登録済みです。' });
    }
    console.error('Could not send account verification email.', error);
    res.status(502).json({ error: '確認メールを送信できませんでした。資格情報は保存されていません。' });
  }
});

app.patch('/api/account/password', async (req, res) => {
  const currentPassword = req.body?.currentPassword;
  const newPassword = req.body?.newPassword;
  const user = db.prepare('SELECT password_salt, password_hash FROM users WHERE id = ?').get(req.user.id);
  if (!user?.password_hash || !(await verifyPassword(currentPassword || '', user.password_salt, user.password_hash))) {
    return res.status(401).json({ error: '現在のパスワードが正しくありません。' });
  }
  if (!isValidPassword(newPassword)) return res.status(400).json({ error: '新しいパスワードは8文字以上で入力してください。' });
  const { salt, hash } = await hashPassword(newPassword);
  db.prepare('UPDATE users SET password_salt = ?, password_hash = ? WHERE id = ?').run(salt, hash, req.user.id);
  db.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?').run(req.user.id, database.sessionHash(readSessionToken(req) || ''));
  res.json({ message: 'パスワードを変更しました。' });
});

app.patch('/api/account/email', async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;
  if (!isValidEmail(email)) return res.status(400).json({ error: '有効なメールアドレスを入力してください。' });
  if (!isValidPassword(password)) return res.status(400).json({ error: 'パスワードは8文字以上で入力してください。' });
  const user = db.prepare('SELECT password_salt, password_hash FROM users WHERE id = ?').get(req.user.id);
  if (!user?.password_hash || !(await verifyPassword(password, user.password_salt, user.password_hash))) {
    return res.status(401).json({ error: 'パスワードが正しくありません。' });
  }
  if (db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, req.user.id)) {
    return res.status(409).json({ error: 'このメールアドレスは既に登録されています。' });
  }
  if (!mailTransporter) return res.status(503).json({ error: 'メール送信が設定されていません。' });
  const token = database.transaction(() => {
    db.prepare('UPDATE users SET email = ?, email_verified = 0 WHERE id = ?').run(email, req.user.id);
    return createVerificationToken(req.user.id);
  });
  try {
    await sendVerificationEmail(email, token);
    res.json({ email, emailVerified: false });
  } catch (error) {
    res.status(502).json({ error: '確認メールを送信できませんでした。' });
  }
});

app.delete('/api/account', (req, res) => {
  const token = readSessionToken(req);
  database.transaction(() => {
    db.prepare('DELETE FROM users WHERE id = ?').run(req.user.id);
    if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(database.sessionHash(token));
  });
  res.clearCookie(cookieName, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/' });
  res.json({ message: 'アカウントを削除しました。' });
});

app.get('/api/me', (req, res) => {
  const channels = db.prepare(`
    SELECT channels.id, channels.name, channel_members.role
    FROM channel_members JOIN channels ON channels.id = channel_members.channel_id
    WHERE channel_members.user_id = ?
    ORDER BY channel_members.joined_at
  `).all(req.user.id);
  const avatar = db.prepare('SELECT avatar_data FROM users WHERE id = ?').get(req.user.id)?.avatar_data || null;
  res.json({ user: { ...req.user, avatar }, channels });
});

app.post('/api/profile', (req, res) => {
  const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
  if (!username || username.length > 30) {
    return res.status(400).json({ error: '名前は1〜30文字で入力してください。' });
  }
  const avatar = req.body?.avatar === null ? null : validateAvatarData(req.body?.avatar);
  if (req.body?.avatar !== undefined && !req.user.emailVerified) {
    return res.status(403).json({ error: 'プロフィール画像を変更するには、メールアドレスの確認が必要です。' });
  }
  if (req.body?.avatar !== undefined && req.body?.avatar !== null && !avatar) {
    return res.status(400).json({ error: 'プロフィール画像はJPG、PNG、WebP形式で400KB以内にしてください。' });
  }
  const previous = req.user.username;
  if (req.body?.avatar !== undefined) {
    db.prepare('UPDATE users SET username = ?, avatar_data = ? WHERE id = ?').run(username, avatar, req.user.id);
  } else {
    db.prepare('UPDATE users SET username = ? WHERE id = ?').run(username, req.user.id);
  }
  const channelIds = db.prepare('SELECT channel_id FROM channel_members WHERE user_id = ?')
    .all(req.user.id);
  for (const { channel_id: channelId } of channelIds) {
    logActivity(channelId, { ...req.user, username }, 'renamed', `${previous} → ${username}`);
  }
  res.json({ username, avatar });
});

app.post('/api/invites/accept', (req, res) => {
  const invite = database.getInvite(req.body?.invite);
  if (!invite || invite.is_bootstrap || !invite.channel_id) {
    if (recordInvalidInviteAttempt(req)) {
      return res.status(429).json({ error: '招待コードの入力回数が上限に達しました。15分後にもう一度お試しください。' });
    }
    return res.status(401).json({ error: 'この招待は無効か、すでに使用されています。' });
  }
  db.prepare('INSERT OR IGNORE INTO channel_members (channel_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)')
    .run(invite.channel_id, req.user.id, 'member', database.now());
  db.prepare('DELETE FROM invites WHERE code = ?').run(invite.code);
  logActivity(invite.channel_id, req.user, 'joined');
  res.json({ channelId: invite.channel_id });
});

app.post('/api/channels', (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  if (!name || name.length > 60) {
    return res.status(400).json({ error: 'リスト名は1〜60文字で入力してください。' });
  }
  const channelId = createChannel(name, req.user.id);
  broadcast({ type: 'channels', recipientId: req.user.id });
  res.status(201).json({ id: channelId, name, role: 'admin' });
});

app.post('/api/channels/:channelId/invites', attachChannel, requireChannelAdmin, (req, res) => {
  let code;
  do {
    code = database.generateInviteCode();
  } while (database.getInvite(code));
  db.prepare('INSERT INTO invites (code, channel_id, is_bootstrap, created_at) VALUES (?, ?, 0, ?)')
    .run(code, req.channel.id, database.now());
  res.set('Cache-Control', 'no-store');
  res.json({ inviteCode: code });
});

app.post('/api/channels/:channelId/email-invites', attachChannel, requireChannelAdmin, async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  if (!isValidEmail(email)) return res.status(400).json({ error: '有効なメールアドレスを入力してください。' });
  if (emailInviteRateLimited(req.user.id)) return res.status(429).json({ error: '招待メールの送信回数が上限に達しました。しばらくしてからお試しください。' });
  let code;
  do { code = database.generateInviteCode(); } while (database.getInvite(code));
  db.prepare('INSERT INTO invites (code, channel_id, is_bootstrap, created_at) VALUES (?, ?, 0, ?)')
    .run(code, req.channel.id, database.now());
  recordEmailInvite(req.user.id);
  try {
    await sendListInviteEmail(email, code, req.channel.name, req.user.username);
    res.json({ sent: true });
  } catch (error) {
    db.prepare('DELETE FROM invites WHERE code = ?').run(code);
    if (error.code === 'SMTP_NOT_CONFIGURED') return res.status(503).json({ error: error.message });
    console.error('Could not send list invite email.', error);
    res.status(502).json({ error: '招待メールを送信できませんでした。メール設定を確認してください。' });
  }
});

app.get('/api/channels/:channelId/members', attachChannel, (req, res) => {
  const members = db.prepare(`
    SELECT users.id, users.username, users.avatar_data AS avatar, channel_members.role
    FROM channel_members JOIN users ON users.id = channel_members.user_id
    WHERE channel_members.channel_id = ? ORDER BY channel_members.joined_at
  `).all(req.channel.id);
  res.json({ members });
});

function removeChannelMember(channelId, userId, actor, action) {
  const target = db.prepare('SELECT username FROM users WHERE id = ?').get(userId);
  if (!target) return false;
  const membership = db.prepare(`
    SELECT role FROM channel_members WHERE channel_id = ? AND user_id = ?
  `).get(channelId, userId);
  if (!membership) return false;

  const remove = () => database.transaction(() => {
    db.prepare('DELETE FROM channel_members WHERE channel_id = ? AND user_id = ?')
      .run(channelId, userId);

    if (membership.role === 'admin') {
      const nextAdmin = db.prepare(`
        SELECT user_id FROM channel_members WHERE channel_id = ? ORDER BY joined_at LIMIT 1
      `).get(channelId);
      if (nextAdmin) {
        db.prepare("UPDATE channel_members SET role = 'admin' WHERE channel_id = ? AND user_id = ?")
          .run(channelId, nextAdmin.user_id);
      } else {
        db.prepare('DELETE FROM channels WHERE id = ?').run(channelId);
      }
    }

    const remaining = db.prepare('SELECT COUNT(*) AS count FROM channel_members WHERE channel_id = ?')
      .get(channelId).count;
    if (remaining) logActivity(channelId, actor, action, target.username);
    return remaining;
  });

  remove();
  broadcast({ type: 'membership-removed', channelId, userId, recipientId: userId });
  broadcast({ type: 'update', channelId });
  broadcast({ type: 'channels', recipientId: userId });
  return true;
}

app.delete('/api/channels/:channelId/members/:userId', attachChannel, requireChannelAdmin, (req, res) => {
  if (req.params.userId === req.user.id) {
    return res.status(400).json({ error: 'Use Leave list to remove yourself.' });
  }
  if (!removeChannelMember(req.channel.id, req.params.userId, req.user, 'kicked')) {
    return res.status(404).json({ error: 'Member not found.' });
  }
  res.json({ message: 'Member removed from this list.' });
});

app.delete('/api/channels/:channelId/membership', attachChannel, (req, res) => {
  removeChannelMember(req.channel.id, req.user.id, req.user, 'left');
  res.json({ message: 'You left this list.' });
});

app.post('/api/channels/:channelId/complete', attachChannel, requireChannelAdmin, (req, res) => {
  const channelId = req.channel.id;
  const recipientIds = db.prepare('SELECT user_id FROM channel_members WHERE channel_id = ?')
    .all(channelId).map(row => row.user_id);
  db.prepare('DELETE FROM channels WHERE id = ?').run(channelId);
  broadcast({ type: 'channel-completed', channelId, recipientIds });
  res.json({ message: '買い物を完了しました。リストを削除しました。' });
});

app.get('/api/events', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive'
  });
  res.flushHeaders();
  res.write('retry: 3000\n\n');
  const removeClient = subscribe(res, req.user.id);
  const heartbeat = setInterval(() => res.write(': keep-alive\n\n'), 25000);
  req.on('close', () => {
    clearInterval(heartbeat);
    removeClient();
  });
});

app.use('/api/channels/:channelId', attachChannel, require('./routes/items'));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  console.error(error);
  if (error.errcode === 13 || /database or disk is full/i.test(error.message || '')) {
    return res.status(507).json({
      error: 'サーバーの保存領域が不足しています。空き容量を確保してから、もう一度お試しください。'
    });
  }
  res.status(500).json({ error: 'サーバー内部でエラーが発生しました。' });
});

app.listen(PORT, () => {
  const publicUrl = (process.env.PUBLIC_URL || `http://localhost:${PORT}`).replace(/\/+$/, '');
  console.log(`Server running at ${publicUrl}`);
  const bootstrapInvite = database.getInvite(database.bootstrapCode);
  if (bootstrapInvite?.is_bootstrap) {
    console.log(`Bootstrap invite link (first user creates the first list): ${publicUrl}/#invite=${database.bootstrapCode}`);
  } else {
    console.log('Bootstrap invite has already been used.');
  }
});
