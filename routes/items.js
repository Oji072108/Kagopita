const express = require('express');
const { db, now } = require('../database');
const { nextDue, renewDueItems } = require('../recurring');
const { notifyItemChange } = require('../notifications');

const router = express.Router();
router.use((req, res, next) => {
  if (req.method !== 'GET' && req.channel.archived_at) {
    return res.status(409).json({ error: 'アーカイブを解除してから変更してください。' });
  }
  if (req.method !== 'GET' && req.channelRole === 'member' &&
      !(req.method === 'PATCH' && /^\/items\/[1-9]\d*\/toggle\/?$/.test(req.path))) {
    return res.status(403).json({ error: 'Members can only check or uncheck items.' });
  }
  next();
});

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
  notifyItemChange(req.channel.id, req.user, action, item, req.app.locals.broadcast);
  req.app.locals.broadcast({ type: 'update', channelId: req.channel.id });
}

router.get('/shopping-list', (req, res) => {
  renewDueItems(req.app.locals.broadcast);
  const rows = db.prepare(`
    SELECT shopping_items.id, category, name, qty, completed, added_by, assigned_to, notes, price, recurrence, next_due_at,
      (SELECT username FROM users WHERE id = shopping_items.assigned_to) AS assigned_name,
      EXISTS (
        SELECT 1 FROM favorite_items
        WHERE favorite_items.channel_id = shopping_items.channel_id
          AND favorite_items.category = shopping_items.category
          AND favorite_items.name = shopping_items.name
      ) AS is_favorite
    FROM shopping_items WHERE shopping_items.channel_id = ? AND deleted_at IS NULL ORDER BY shopping_items.id
  `).all(req.channel.id);
  const categoryMap = new Map();
  for (const row of rows) {
    if (!categoryMap.has(row.category)) categoryMap.set(row.category, []);
    categoryMap.get(row.category).push({
      id: row.id,
      name: row.name,
      qty: row.qty,
      notes: row.notes, price: row.price, recurrence: row.recurrence, nextDueAt: row.next_due_at,
      completed: Boolean(row.completed),
      addedBy: row.added_by,
      assignedTo: row.assigned_to,
      assignedName: row.assigned_name,
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
    deletedItems: db.prepare(`SELECT id, name, qty, category, notes, price, recurrence, deleted_at AS deletedAt
      FROM shopping_items WHERE channel_id = ? AND deleted_at IS NOT NULL ORDER BY deleted_at DESC, id DESC`).all(req.channel.id),
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
    SELECT category, name, qty FROM shopping_items WHERE id = ? AND channel_id = ? AND deleted_at IS NULL
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
    SELECT category, name FROM shopping_items WHERE id = ? AND channel_id = ? AND deleted_at IS NULL
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

function validateItem(req) {
  const { name, category, qty, assignedTo = null } = req.body || {};
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 100 ||
      typeof category !== 'string' || !category.trim() || category.trim().length > 60 ||
      typeof qty !== 'string' || !qty.trim() || qty.trim().length > 50) {
    return { error: '商品名（100文字以内）、カテゴリ（60文字以内）、数量（50文字以内）を入力してください。' };
  }
  if (assignedTo !== null && (typeof assignedTo !== 'string' || !db.prepare(
    'SELECT 1 FROM channel_members WHERE channel_id = ? AND user_id = ?'
  ).get(req.channel.id, assignedTo))) return { error: '担当者はこのリストのメンバーから選択してください。' };
  const existing = req.params.id ? db.prepare('SELECT * FROM shopping_items WHERE id = ? AND channel_id = ?').get(Number(req.params.id), req.channel.id) : null;
  const { notes = existing?.notes || '', price = existing?.price ?? null, recurrence = existing?.recurrence || 'none' } = req.body;
  if (typeof notes !== 'string' || notes.length > 1000) return { error: 'メモは1000文字以内で入力してください。' };
  if (price !== null && (!Number.isSafeInteger(price) || price < 0 || price > 99999999)) return { error: '価格は0〜99999999円の整数で入力してください。' };
  if (!['none', 'daily', 'weekly', 'monthly'].includes(recurrence)) return { error: '繰り返しの間隔が無効です。' };
  return { name: name.trim(), category: category.trim(), qty: qty.trim(), assignedTo, notes: notes.trim(), price, recurrence };

}

router.put('/items/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ error: '商品IDが無効です。' });
  if (!db.prepare('SELECT id FROM shopping_items WHERE id = ? AND channel_id = ? AND deleted_at IS NULL').get(id, req.channel.id)) {
    return res.status(404).json({ error: '商品が見つかりません。' });
  }
  const item = validateItem(req);
  if (item.error) return res.status(400).json(item);
  const previous = db.prepare('SELECT completed, recurrence, next_due_at FROM shopping_items WHERE id = ?').get(id);
  const due = item.recurrence === 'none' ? null : previous.completed
    ? (item.recurrence === previous.recurrence ? previous.next_due_at || nextDue(item.recurrence) : nextDue(item.recurrence)) : null;
  db.prepare(`UPDATE shopping_items SET name = ?, category = ?, qty = ?, assigned_to = ?, notes = ?, price = ?, recurrence = ?, next_due_at = ?
    WHERE id = ? AND channel_id = ? AND deleted_at IS NULL`)
    .run(item.name, item.category, item.qty, item.assignedTo, item.notes, item.price, item.recurrence, due, id, req.channel.id);
  logActivity(req, 'edited', `${item.name} (${item.qty})`);
  res.json({ message: '商品を更新しました。' });
});

router.post('/items', (req, res) => {
  const values = validateItem(req);
  if (values.error) return res.status(400).json(values);
  const { name, category, qty: quantity, assignedTo, notes, price, recurrence } = values;
  const result = db.prepare(`
    INSERT INTO shopping_items (channel_id, category, name, qty, completed, added_by, created_at, assigned_to, notes, price, recurrence)
    VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)
  `).run(req.channel.id, category, name, quantity, req.user.username, now(), assignedTo, notes, price, recurrence);
  const item = {
    id: Number(result.lastInsertRowid),
    name: name.trim(),
    qty: quantity, notes, price, recurrence,
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
    SELECT id, name, completed, recurrence FROM shopping_items WHERE id = ? AND channel_id = ? AND deleted_at IS NULL
  `).get(id, req.channel.id);
  if (!item) return res.status(404).json({ error: 'Item not found.' });

  const completed = item.completed ? 0 : 1;
  db.prepare('UPDATE shopping_items SET completed = ?, next_due_at = ? WHERE id = ? AND channel_id = ? AND deleted_at IS NULL')
    .run(completed, completed ? nextDue(item.recurrence) : null, id, req.channel.id);
  logActivity(req, completed ? 'completed' : 'uncompleted', item.name);
  res.json({ message: 'Status updated successfully.' });
});

router.delete('/items/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid item id.' });
  }
  const item = db.prepare('SELECT name FROM shopping_items WHERE id = ? AND channel_id = ? AND deleted_at IS NULL')
    .get(id, req.channel.id);
  if (!item) return res.status(404).json({ error: 'Item not found.' });
  db.prepare('UPDATE shopping_items SET deleted_at = ? WHERE id = ? AND channel_id = ? AND deleted_at IS NULL')
    .run(now(), id, req.channel.id);
  logActivity(req, 'deleted', item.name);
  res.json({ message: 'Item deleted.' });
});

router.post('/items/:id/restore', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ error: '商品IDが無効です。' });
  const item = db.prepare('SELECT name FROM shopping_items WHERE id = ? AND channel_id = ? AND deleted_at IS NOT NULL').get(id, req.channel.id);
  if (!item) return res.status(404).json({ error: '削除済みの商品が見つかりません。' });
  db.prepare('UPDATE shopping_items SET deleted_at = NULL, completed = 0, next_due_at = NULL WHERE id = ? AND channel_id = ?').run(id, req.channel.id);
  logActivity(req, 'restored', item.name);
  res.json({ message: '商品を復元しました。' });
});

module.exports = router;
