const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {mock}=require('node:test');
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'kagopita-deleted-clock-'));
process.env.KAGOPITA_DATA_DIR=directory;
mock.timers.enable({apis:['Date','setTimeout'],now:Date.parse('2026-10-29T00:00:00Z')});
const {db,createChannel,now}=require('../database');
const {RETENTION_MS,startDeletedItemCleanup,scheduleDeletedItemCleanup,purgeExpiredDeletedItems}=require('../deleted-items');
try{
  db.prepare('INSERT INTO users(id,username,created_at) VALUES (?,?,?)').run('u','Owner',now());
  const channel=createChannel('Test','u');
  const add=(name,deletedAt)=>Number(db.prepare(`INSERT INTO shopping_items(channel_id,category,name,qty,added_by,created_at,deleted_at)
    VALUES (?,'Dairy',?,'1','Owner',?,?)`).run(channel,name,now(),deletedAt).lastInsertRowid);
  const active=add('Active',null),restored=add('Restore',now()),expired=add('Old',new Date(Date.now()-RETENTION_MS).toISOString());
  const events=[];const broadcast=event=>events.push(event);
  startDeletedItemCleanup(broadcast);
  assert.equal(db.prepare('SELECT id FROM shopping_items WHERE id=?').get(expired),undefined,'Startup removes overdue records');
  db.prepare('UPDATE shopping_items SET deleted_at=NULL WHERE id=?').run(restored);
  const fresh=add('New',now());scheduleDeletedItemCleanup(broadcast);
  mock.timers.tick(RETENTION_MS-1);
  assert.ok(db.prepare('SELECT id FROM shopping_items WHERE id=?').get(fresh),'Not removed early');
  mock.timers.tick(21);
  assert.equal(db.prepare('SELECT id FROM shopping_items WHERE id=?').get(fresh),undefined,'Server timer removes item without client requests');
  assert.ok(db.prepare('SELECT id FROM shopping_items WHERE id=?').get(active));
  assert.ok(db.prepare('SELECT id FROM shopping_items WHERE id=?').get(restored),'Restore cancels deletion');
  assert.ok(events.every(e=>e.type==='update'&&e.channelId===channel));
  assert.equal(purgeExpiredDeletedItems(broadcast),0,'Cleanup is idempotent');
  console.log('PASS: startup expiry; precise 24-hour scheduler without requests; no early deletion; active/restored records preserved; scoped live events.');
}finally{mock.timers.reset();db.close();fs.rmSync(directory,{recursive:true,force:true});}
