const { db, now, transaction } = require('./database');

// Reuse the same item after completion, rather than accumulating duplicate rows.
function nextDue(recurrence, from = new Date()) {
  if (recurrence === 'none') return null;
  const date = new Date(from);
  if (recurrence === 'monthly') {
    const day = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + 1);
    const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
    date.setUTCDate(Math.min(day, end));
  } else date.setUTCDate(date.getUTCDate() + (recurrence === 'weekly' ? 7 : 1));
  return date.toISOString();
}

function renewDueItems(broadcast = () => {}) {
  const timestamp = now();
  const rows = transaction(() => {
    const due = db.prepare(`SELECT shopping_items.id, channel_id, shopping_items.name FROM shopping_items
      JOIN channels ON channels.id = shopping_items.channel_id
      WHERE recurrence != 'none' AND completed = 1 AND deleted_at IS NULL
      AND archived_at IS NULL AND next_due_at <= ?`).all(timestamp);
    for (const item of due) {
      db.prepare('UPDATE shopping_items SET completed = 0, next_due_at = NULL WHERE id = ?').run(item.id);
      db.prepare(`INSERT INTO activity_log (channel_id, username, action, item, created_at)
        VALUES (?, 'カゴピタ', 'recurring', ?, ?)`).run(item.channel_id, item.name, timestamp);
    }
    return due;
  });
  for (const channelId of new Set(rows.map(row => row.channel_id))) broadcast({ type: 'update', channelId });
  return rows.length;
}

module.exports = { nextDue, renewDueItems };
