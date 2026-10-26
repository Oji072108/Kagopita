const express = require('express');
const { db, now } = require('../database');

const router = express.Router();

function logActivity(req, action, item = '') {
  db.prepare(`
    INSERT INTO activity_log (channel_id, user_id, username, action, item, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(req.channel.id, req.user.id, req.user.username, action, item, now());
  db.prepare(`
    DELETE FROM activity_log
    WHERE channel_id = ? AND id NOT IN (
      SELECT id FROM activity_log WHERE channel_id = ? ORDER BY id DESC LIMIT 100
    )
  `).run(req.channel.id, req.channel.id);
  req.app.locals.broadcast({ type: 'update', channelId: req.channel.id });
}

router.get('/shopping-list', (req, res) => {
  const rows = db.prepare(`
    SELECT shopping_items.id, category, name, qty, completed, added_by,
      EXISTS (
        SELECT 1 FROM favorite_items
        WHERE favorite_items.channel_id = shopping_items.channel_id
          AND favorite_items.category = shopping_items.category
          AND favorite_items.name = shopping_items.name
      ) AS is_favorite
    FROM shopping_items WHERE shopping_items.channel_id = ? ORDER BY shopping_items.id
  `).all(req.channel.id);
  const categoryMap = new Map();
  for (const row of rows) {
    if (!categoryMap.has(row.category)) categoryMap.set(row.category, []);
    categoryMap.get(row.category).push({
      id: row.id,
      name: row.name,
      qty: row.qty,
      completed: Boolean(row.completed),
      addedBy: row.added_by,
      isFavorite: Boolean(row.is_favorite)
    });
  }
  const categories = [...categoryMap].map(([name, items]) => ({ name, items }));
  const activityLog = db.prepare(`
    SELECT username AS name, action, item, created_at AS createdAt
    FROM activity_log WHERE channel_id = ? ORDER BY id DESC LIMIT 100
  `).all(req.channel.id).reverse();
  const items = rows;
  res.json({
    categories,
    total: items.length,
    completed: items.filter(item => item.completed).length,
    familyFeed: activityLog
  });
});

router.get('/favorites', (req, res) => {
  const favorites = db.prepare(`
    SELECT id, category, name, qty FROM favorite_items
    WHERE channel_id = ? ORDER BY name COLLATE NOCASE, id
  `).all(req.channel.id);
  res.json({ favorites });
});

router.put('/items/:id/favorite', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid item id.' });
  }
  const item = db.prepare(`
    SELECT category, name, qty FROM shopping_items WHERE id = ? AND channel_id = ?
  `).get(id, req.channel.id);
  if (!item) return res.status(404).json({ error: 'Item not found.' });

  db.prepare(`
    INSERT INTO favorite_items (channel_id, category, name, qty, created_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (channel_id, category, name) DO UPDATE SET
      qty = excluded.qty
  `).run(req.channel.id, item.category, item.name, item.qty, now());
  req.app.locals.broadcast({ type: 'update', channelId: req.channel.id });
  res.json({ isFavorite: true });
});

router.delete('/items/:id/favorite', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid item id.' });
  }
  const item = db.prepare(`
    SELECT category, name FROM shopping_items WHERE id = ? AND channel_id = ?
  `).get(id, req.channel.id);
  if (!item) return res.status(404).json({ error: 'Item not found.' });

  db.prepare(`
    DELETE FROM favorite_items
    WHERE channel_id = ? AND category = ? AND name = ?
  `).run(req.channel.id, item.category, item.name);
  req.app.locals.broadcast({ type: 'update', channelId: req.channel.id });
  res.json({ isFavorite: false });
});

router.post('/favorites/:id/add', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid favorite id.' });
  }
  const favorite = db.prepare(`
    SELECT category, name, qty FROM favorite_items
    WHERE id = ? AND channel_id = ?
  `).get(id, req.channel.id);
  if (!favorite) return res.status(404).json({ error: 'Favorite item not found.' });

  db.prepare(`
    INSERT INTO shopping_items (channel_id, category, name, qty, completed, added_by, created_at)
    VALUES (?, ?, ?, ?, 0, ?, ?)
  `).run(req.channel.id, favorite.category, favorite.name, favorite.qty, req.user.username, now());
  logActivity(req, 'added', `${favorite.name} (${favorite.qty})`);
  res.status(201).json({ message: 'Favorite item added.' });
});

router.delete('/favorites/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid favorite id.' });
  }
  const result = db.prepare('DELETE FROM favorite_items WHERE id = ? AND channel_id = ?')
    .run(id, req.channel.id);
  if (!result.changes) return res.status(404).json({ error: 'Favorite item not found.' });
  req.app.locals.broadcast({ type: 'update', channelId: req.channel.id });
  res.json({ message: 'Favorite item removed.' });
});

router.post('/items', (req, res) => {
  const { name, category, qty } = req.body || {};
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 100 ||
      typeof category !== 'string' || !category.trim() || category.trim().length > 60) {
    return res.status(400).json({ error: 'Name and Category are required.' });
  }
  const quantity = typeof qty === 'string' && qty.trim() ? qty.trim().slice(0, 50) : '1個';
  const result = db.prepare(`
    INSERT INTO shopping_items (channel_id, category, name, qty, completed, added_by, created_at)
    VALUES (?, ?, ?, ?, 0, ?, ?)
  `).run(req.channel.id, category.trim(), name.trim(), quantity, req.user.username, now());
  const item = {
    id: Number(result.lastInsertRowid),
    name: name.trim(),
    qty: quantity,
    completed: false,
    addedBy: req.user.username
  };
  logActivity(req, 'added', `${item.name} (${quantity})`);
  res.status(201).json({ message: 'Item added successfully', item });
});

router.patch('/items/:id/toggle', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid item id.' });
  }
  const item = db.prepare(`
    SELECT id, name, completed FROM shopping_items WHERE id = ? AND channel_id = ?
  `).get(id, req.channel.id);
  if (!item) return res.status(404).json({ error: 'Item not found.' });

  const completed = item.completed ? 0 : 1;
  db.prepare('UPDATE shopping_items SET completed = ? WHERE id = ? AND channel_id = ?')
    .run(completed, id, req.channel.id);
  logActivity(req, completed ? 'completed' : 'uncompleted', item.name);
  res.json({ message: 'Status updated successfully.' });
});

router.delete('/items/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid item id.' });
  }
  const item = db.prepare('SELECT name FROM shopping_items WHERE id = ? AND channel_id = ?')
    .get(id, req.channel.id);
  if (!item) return res.status(404).json({ error: 'Item not found.' });
  db.prepare('DELETE FROM shopping_items WHERE id = ? AND channel_id = ?')
    .run(id, req.channel.id);
  logActivity(req, 'deleted', item.name);
  res.json({ message: 'Item deleted.' });
});

module.exports = router;
