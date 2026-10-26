const clients = new Set();
const { db } = require('./database');

function subscribe(response, userId) {
  const client = { response, userId };
  clients.add(client);
  return () => clients.delete(client);
}

function broadcast(event = { type: 'update' }) {
  const channelRecipients = event.channelId && !event.recipientIds
    ? new Set(db.prepare('SELECT user_id FROM channel_members WHERE channel_id = ?')
      .all(event.channelId).map(row => row.user_id))
    : null;
  const recipientIds = event.recipientIds ? new Set(event.recipientIds) : channelRecipients;

  for (const client of clients) {
    if (client.response.destroyed || client.response.writableEnded) {
      clients.delete(client);
      continue;
    }

    if (event.recipientId && event.recipientId !== client.userId) continue;
    if (recipientIds && !recipientIds.has(client.userId)) continue;
    if (client.response.writableLength > 1024 * 1024) {
      clients.delete(client);
      client.response.end();
      continue;
    }

    client.response.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
  }
}

module.exports = { subscribe, broadcast };
