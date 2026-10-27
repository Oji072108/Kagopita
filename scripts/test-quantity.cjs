const assert = require('node:assert/strict');
const {suggest, format} = require('../public/js/quantity.js');
for (const [name, unit] of [['トマト','個'],['にんじん','本'],['牛乳','本'],['箸','膳'],['割り箸','膳'],['参加者','人'],['丸鶏','羽'],['鶏肉','個'],['豚肉','個'],['キャベツ','玉'],['豆腐','丁'],['ノート','冊'],['靴下','足'],['卵パック','パック'],['牛乳1箱','箱'],['マスク','枚'],['ほうれん草','束'],['知らない商品','個']]) {
  assert.equal(suggest(name), unit, name);
  assert.equal(format(name, '2'), '2' + unit, name);
}
assert.equal(format('トマト', '３'), '3個');
assert.equal(format('牛乳', '.5', 'L'), '.5L');
assert.equal(format('トマト', '2', '袋'), '2袋');
assert.equal(format('トマト', '500g'), '500g');
assert.equal(format('牛乳', '２パック'), '２パック');
assert.equal(format('パン', '半分'), '半分');
assert.equal(format('トマト', ''), '1個');
console.log('PASS: 18 item counters, packaging priority, unknown fallback, full-width digits, decimals, overrides, free-form preservation');
