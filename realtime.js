const clients = new Set();
const clientsByUser = new Map();
const { db } = require('./database');

function subscribe(response, userId) {
  let userClients = clientsByUser.get(userId);
  if (userClients?.size >= 5) return null;
  if (!userClients) {
    userClients = new Set();
    clientsByUser.set(userId, userClients);
  }
  const client = { response, userId, userClients };
  clients.add(client);
  userClients.add(client);
  let active = true;
  client.unsubscribe = () => {
    if (!active) return;
    active = false;
    clients.delete(client);
    userClients.delete(client);
    if (userClients.size === 0) clientsByUser.delete(userId);
  };
  return client.unsubscribe;
}

function broadcast(event = { type: 'update' }) {
  const channelRecipients = event.channelId && !event.recipientIds
    ? new Set(db.prepare('SELECT user_id FROM channel_members WHERE channel_id = ?')
      .all(event.channelId).map(row => row.user_id))
    : null;
  const recipientIds = event.recipientIds ? new Set(event.recipientIds) : channelRecipients;

  for (const client of clients) {
    if (client.response.destroyed || client.response.writableEnded) {
      client.unsubscribe();
      continue;
    }

    if (event.recipientId && event.recipientId !== client.userId) continue;
    if (recipientIds && !recipientIds.has(client.userId)) continue;
    if (client.response.writableLength > 1024 * 1024) {
      client.unsubscribe();
      client.response.end();
      continue;
    }

    client.response.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
  }
}

function disconnectUser(userId) {
  const userClients = clientsByUser.get(userId);
  if (!userClients) return;
  for (const client of [...userClients]) {
    client.unsubscribe();
    client.response.end();
  }
}

module.exports = { subscribe, broadcast, disconnectUser };
