const { db, now } = require('./database');

// Durable, per-member inbox. Never notify the actor or users outside the list.
function notifyItemChange(channelId, actor, action, item, broadcast = () => {}) {
  const recipients = db.prepare('SELECT user_id FROM channel_members WHERE channel_id = ? AND user_id != ?')
    .all(channelId, actor?.id || '');
  const insert = db.prepare(`INSERT INTO notifications (user_id, channel_id, actor_name, action, item, created_at)
    VALUES (?, ?, ?, ?, ?, ?)`);
  for (const { user_id: userId } of recipients) {
    insert.run(userId, channelId, actor?.username || 'カゴピタ', action, item, now());
    db.prepare(`DELETE FROM notifications WHERE user_id = ? AND id NOT IN
      (SELECT id FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 100)`).run(userId, userId);
    broadcast({ type: 'notifications', recipientId: userId });
  }
}
module.exports = { notifyItemChange };
