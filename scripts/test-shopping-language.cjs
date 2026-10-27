const assert=require('node:assert/strict');
const words=require('../public/js/shopping-language');
const qty=require('../public/js/quantity');
const category=require('../public/js/category');
for(const name of ['牛乳','milk','Milk','우유','牛奶','leche']) {
 assert.equal(category.suggest(name),'乳製品・チーズ',name);
 assert.equal(qty.format(name,'２'),'2本',name);
 assert.equal(words.translate(name,'en').toLowerCase(),'milk');
 assert.equal(words.translate(name,'ko'),'우유');
 assert.equal(words.translate(name,'zh'),'牛奶');
 assert.equal(words.translate(name,'es'),'leche');
}
for(const [names,unit,aisle] of [
 [['carrots','당근','胡萝卜','zanahorias'],'本','野菜・果物'],
 [['tofu','두부','豆腐'],'丁','卵・豆腐・納豆'],
 [['chopsticks','젓가락','筷子','palillos'],'膳',null],
 [['detergent','세제','洗涤剂','detergente'],'個','日用品'],
 [['tissues','티슈','纸巾','pañuelos'],'個','日用品'],
 [['soy milk','두유','豆奶','leche de soja'],'本','飲料']
]) for(const name of names){assert.equal(qty.suggest(name),unit,name);assert.equal(category.suggest(name),aisle,name)}
assert.equal(qty.suggest('milk box'),'箱');
assert.equal(category.suggest('frozen chicken'),'冷凍食品');
assert.equal(category.suggest('milk chocolate'),'お菓子・パン');
for(const [language,expected] of [['ja','2本'],['en','2 bottles'],['ko','2병'],['zh','2瓶'],['es','2 botellas']]) assert.equal(qty.display('milk','2本',language),expected);
assert.equal(qty.display('carrot','1本','en'),'1 piece');
assert.equal(qty.display('milk','2 bottles','ja'),'2本');
assert.equal(qty.display('milk','2 boxes','en'),'2 boxes');
assert.equal(qty.display('tomato','2 pieces','es'),'2 unidades');
for(const lang of words.languages) for(const value of ['500g','2kg','半分','1/2','BrandXYZ']) assert.equal(qty.display('milk',value,lang),value);
assert.equal(words.translate('BrandXYZ 牛乳 1L','en'),'BrandXYZ milk 1L');
assert.equal(words.translate('BrandXYZ milk 1L','ja'),'BrandXYZ 牛乳 1L');
assert.equal(words.translate('applejuicebrand','ja'),'applejuicebrand');
assert.equal(words.translate('salted caramel','ja'),'salted caramel');
assert.equal(words.translate('<script>alert(1)</script>','en'),'<script>alert(1)</script>');
console.log('PASS: multilingual detection, translation, packaging priority, localized counters and untouched brands/free-form quantities');
