const assert = require('node:assert/strict');
const {suggest, categories} = require('../public/js/category');
for (const [name, category] of [
 ['牛乳','乳製品・チーズ'], ['チーズ','乳製品・チーズ'], ['ヨーグルト','乳製品・チーズ'],
 ['トマト','野菜・果物'], ['にんじん','野菜・果物'], ['豚肉','精肉・鮮魚'], ['鮭','精肉・鮮魚'],
 ['豆腐','卵・豆腐・納豆'], ['納豆','卵・豆腐・納豆'], ['卵','卵・豆腐・納豆'],
 ['冷凍ブロッコリー','冷凍食品'], ['冷凍餃子','冷凍食品'], ['アイスクリーム','冷凍食品'],
 ['豆乳','飲料'], ['ミルクティー','飲料'], ['トマトジュース','飲料'], ['オーツミルク','飲料'],
 ['醤油','調味料・乾物'], ['米','調味料・乾物'], ['小麦粉','調味料・乾物'],
 ['チーズパン','お菓子・パン'], ['チョコ牛乳','お菓子・パン'], ['牛乳石鹸','日用品'],
 ['ＭＩＬＫ','乳製品・チーズ'], ['  ﾁｰｽﾞ  ','乳製品・チーズ'], ['',''], ['謎の商品','']
]) {
 assert.equal(suggest(name) || '', category, name);
 if (category) assert.ok(categories.includes(category));
}
console.log('PASS: category inference, packaging/product precedence, normalization, unknown names');
