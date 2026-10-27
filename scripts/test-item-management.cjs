const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { mkdtempSync, rmSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
(async () => {
  const listener = net.createServer();
  await new Promise(resolve => listener.listen(0, '127.0.0.1', resolve));
  const port = listener.address().port;
  await new Promise(resolve => listener.close(resolve));
  const directory = mkdtempSync(path.join(os.tmpdir(), 'kagopita-items-'));
  const child = spawn(process.execPath, ['server.js'], { cwd: path.join(__dirname, '..'), env: { ...process.env, PORT: String(port), KAGOPITA_DATA_DIR: directory, NODE_ENV: 'test' }, stdio: 'ignore' });
  const base = `http://127.0.0.1:${port}`;
  try {
    for (let attempt = 0; attempt < 100; attempt++) {
      try { if ((await fetch(base)).ok) break; } catch {}
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    async function request(cookie, url, method = 'GET', body, expected = 200) {
      const response = await fetch(base + url, { method, headers: { Cookie: cookie || '', 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
      assert.equal(response.status, expected, `${method} ${url}: ${await response.clone().text()}`);
      return { data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
    }
    const a = await request('', '/api/account', 'POST', { username: 'テスト管理者' }, 201);
    const b = await request('', '/api/account', 'POST', { username: 'テスト担当者' }, 201);
    const outsider = await request('', '/api/account', 'POST', { username: '別のリスト' }, 201);
    const { data: channel } = await request(a.cookie, '/api/channels', 'POST', { name: '検証リスト' }, 201);
    const root = `/api/channels/${channel.id}`;
    const { data: invite } = await request(a.cookie, root + '/invites', 'POST', {});
    await request(b.cookie, '/api/invites/accept', 'POST', { invite: invite.inviteCode });
    const values = { name: '牛乳', category: '乳製品', qty: '2本', assignedTo: b.data.user.id };
    const { data: created } = await request(a.cookie, root + '/items', 'POST', values, 201);
    const itemUrl = root + `/items/${created.item.id}`;
    const list = async () => (await request(a.cookie, root + '/shopping-list')).data;
    let data = await list();
    assert.equal(data.categories[0].items[0].assignedName, 'テスト担当者');
    await request(b.cookie, itemUrl + '/toggle', 'PATCH');
    await request(b.cookie, itemUrl, 'PUT', { ...values, name: '豆乳', category: '飲料', qty: '3本' });
    data = await list();
    assert.equal(data.categories[0].name, '飲料');
    assert.equal(data.categories[0].items[0].name, '豆乳');
    assert.equal(data.categories[0].items[0].qty, '3本');
    assert.equal(data.categories[0].items[0].completed, true);
    assert.equal(data.familyFeed.at(-1).action, 'edited');
    await request(a.cookie, itemUrl, 'PUT', { ...values, assignedTo: outsider.data.user.id }, 400);
    await request(a.cookie, itemUrl, 'PUT', { ...values, name: ' ' }, 400);
    const { data: otherChannel } = await request(a.cookie, '/api/channels', 'POST', { name: '別リスト' }, 201);
    await request(a.cookie, `/api/channels/${otherChannel.id}/items/${created.item.id}`, 'PUT', values, 404);
    const denied = await fetch(base + itemUrl, { method: 'PUT', headers: { Cookie: outsider.cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
    assert.ok([403, 404].includes(denied.status));
    await request(a.cookie, root + `/members/${b.data.user.id}`, 'DELETE');
    assert.equal((await list()).categories[0].items[0].assignedTo, null);
    await request(a.cookie, itemUrl, 'PUT', { ...values, assignedTo: null });
    assert.equal((await list()).categories[0].items[0].assignedTo, null);
    console.log('PASS: creation, member editing, persistence, completion preservation, activity, invalid data, cross-list isolation, assignment validation, removal cleanup, unassignment');
  } finally {
    child.kill('SIGTERM');
    await new Promise(resolve => child.once('exit', resolve));
    rmSync(directory, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
