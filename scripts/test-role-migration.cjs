const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const {DatabaseSync} = require('node:sqlite');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'kagopita-role-migration-'));
const filename = path.join(directory, 'kagopita.sqlite');
function migrate() {
  const result = spawnSync(process.execPath, ['-e', "require('./database')"], {cwd:path.join(__dirname,'..'), env:{...process.env,KAGOPITA_DATA_DIR:directory},stdio:'pipe'});
  assert.equal(result.status, 0, result.stderr.toString());
}
try {
  migrate();
  let db = new DatabaseSync(filename);
  db.exec(`DROP TRIGGER channel_creator_on_owner;
    DROP TABLE channel_members;
    ALTER TABLE channels DROP COLUMN creator_id;
    CREATE TABLE channel_members (
      channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK(role IN ('owner','editor','viewer')),
      joined_at TEXT NOT NULL, PRIMARY KEY(channel_id,user_id));
    CREATE INDEX channel_members_user_joined ON channel_members(user_id,joined_at);
    INSERT INTO users(id,username,created_at) VALUES ('creator','Creator','2020'),('delegate','Delegate','2020'),('reader','Reader','2020');
    INSERT INTO channels(id,name,created_at) VALUES ('existing','Existing','2020');
    INSERT INTO channel_members VALUES ('existing','creator','editor','2020'),('existing','delegate','owner','2020'),('existing','reader','viewer','2020');
    INSERT INTO activity_log(channel_id,user_id,username,action,item,created_at) VALUES ('existing','creator','Creator','created','','2020');
    INSERT INTO notifications(user_id,channel_id,actor_name,action,item,created_at) VALUES ('reader','existing','Creator','added','Preserved','2020');`);
  db.close();
  migrate();
  db = new DatabaseSync(filename);
  const roles = () => db.prepare('SELECT user_id,role FROM channel_members WHERE channel_id = ? ORDER BY user_id').all('existing').map(r=>[r.user_id,r.role]);
  assert.deepEqual(roles(), [['creator','owner'],['delegate','admin'],['reader','member']]);
  assert.equal(db.prepare('SELECT creator_id FROM channels WHERE id = ?').get('existing').creator_id,'creator');
  assert.equal(db.prepare('SELECT item FROM notifications WHERE channel_id = ?').get('existing').item,'Preserved');
  db.close(); migrate(); db = new DatabaseSync(filename);
  assert.deepEqual(roles(), [['creator','owner'],['delegate','admin'],['reader','member']]);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
  assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
  db.close();
  console.log('PASS: previous owner/editor/viewer schema migration preserves notifications and membership, recovers recorded creator, converts delegate to administrator and viewer to member; restart idempotence and SQLite integrity.');
} finally { fs.rmSync(directory,{recursive:true,force:true}); }
