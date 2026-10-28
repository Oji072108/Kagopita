const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const text = require('../public/js/notification-text');
const entry = {actor_name:'Alex', action:'added', item:'トマト (10個)'};
const expected = {ja:'Alexが追加しました：トマト (10個)',en:'Alex added: tomato (10 pieces)',ko:'Alex님이 추가했습니다: 토마토 (10개)',zh:'Alex添加了：番茄 (10个)',es:'Alex añadió: tomate (10 unidades)'};
for (const [language, body] of Object.entries(expected)) {
  assert.equal(text.format(entry,language).body,body);
  for (const action of ['added','edited','deleted','completed','uncompleted','restored','recurring','unexpected']) {
    const value = text.format({...entry,action},language);
    assert.ok(value.title && value.body.includes(body.slice(body.indexOf('('))));
    assert.ok(!value.body.includes('undefined'));
    assert.ok(!value.title.includes('カゴピタ'));
  }
  assert.ok(text.format(null,language).body);
}
assert.equal(text.format({...entry,item:'MyBrand (Limited) (500g)'},'en').body,'Alex added: MyBrand (Limited) (500g)');
assert.equal(text.format({...entry,item:'soy milk (1本)'},'en').body,'Alex added: soy milk (1 bottle)');
assert.equal(text.format({...entry,item:'卵 (1個)'},'en').body,'Alex added: eggs (1 piece)');
assert.equal(text.format({...entry,actor_name:'$& {item}'},'en').body,'$& {item} added: tomato (10 pieces)');
assert.equal(text.language('invalid'),'ja');
const context = {window:{}};
for(const name of ['shopping-language','quantity','notification-text']) vm.runInNewContext(fs.readFileSync(require.resolve('../public/js/'+name+'.js'),'utf8'),context);
for(const language of Object.keys(expected)) assert.equal(context.window.KagopitaNotificationText.format(entry,language).body,text.format(entry,language).body,'Browser and server messages agree');
console.log('PASS: five languages, all seven actions, fallback, plurals, original brands/weights, safe actor interpolation, and browser/server parity.');
