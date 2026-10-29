const { db, transaction } = require('./database');

const RETENTION_MS = 24 * 60 * 60 * 1000;
let cleanupTimer;

function purgeExpiredDeletedItems(broadcast = () => {}) {
  const cutoff = new Date(Date.now() - RETENTION_MS).toISOString();
  const removed = transaction(() => db.prepare(`DELETE FROM shopping_items
    WHERE deleted_at IS NOT NULL AND julianday(deleted_at) <= julianday(?)
    RETURNING channel_id`).all(cutoff));
  for (const channelId of new Set(removed.map(item => item.channel_id))) {
    broadcast({type:'update', channelId});
  }
  return removed.length;
}

// One server timer for the next expiry, rather than client polling. Rebuilt on restart.
function scheduleDeletedItemCleanup(broadcast) {
  clearTimeout(cleanupTimer);
  const next = db.prepare(`SELECT MIN(julianday(deleted_at)) AS deadline
    FROM shopping_items WHERE deleted_at IS NOT NULL`).get().deadline;
  if (next === null) return;
  const deadline = (next - 2440587.5) * 86400000 + RETENTION_MS;
  cleanupTimer = setTimeout(() => {
    try {
      purgeExpiredDeletedItems(broadcast);
      scheduleDeletedItemCleanup(broadcast);
    } catch (error) {
      console.error('Deleted item cleanup failed.', error);
      cleanupTimer = setTimeout(() => startDeletedItemCleanup(broadcast), 60000);
      cleanupTimer.unref();
    }
  }, Math.min(2147483647, Math.max(10, Math.ceil(deadline - Date.now()))));
  cleanupTimer.unref();
}

function startDeletedItemCleanup(broadcast) {
  purgeExpiredDeletedItems(broadcast);
  scheduleDeletedItemCleanup(broadcast);
}

module.exports = { RETENTION_MS, purgeExpiredDeletedItems, scheduleDeletedItemCleanup, startDeletedItemCleanup };
