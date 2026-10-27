/* Offline aisle suggestions. Specific prepared products precede their ingredients. */
(function (root) {
  const vocabulary = typeof module !== 'undefined' && module.exports
    ? require('./shopping-language.js') : root.KagopitaShoppingLanguage;
  const categories = ['野菜・果物', '精肉・鮮魚', '乳製品・チーズ', '卵・豆腐・納豆', '冷凍食品', '飲料', '調味料・乾物', 'お菓子・パン', '日用品', 'その他'];
  const rules = [
    ['日用品', /洗剤|柔軟剤|シャンプー|リンス|石鹸|せっけん|歯ブラシ|歯磨き|ティッシュ|トイレット|ラップ|アルミホイル|ゴミ袋|ごみ袋|スポンジ|マスク|おむつ|電池|掃除|消臭|キッチンペーパー|ハンドソープ/],
    ['冷凍食品', /冷凍|アイスクリーム|アイスキャンディ|氷$|frozen|ice cream/],
    ['お菓子・パン', /パン|ケーキ|クッキー|ビスケット|チョコ|ポテトチップ|スナック|せんべい|煎餅|プリン|ゼリー|ドーナツ|カステラ|飴|キャンディ|bread|cake|cookies/],
    ['飲料', /豆乳|アーモンドミルク|オーツミルク|ミルクティー|カフェオレ|ジュース|コーヒー|珈琲|紅茶|緑茶|麦茶|烏龍茶|ウーロン茶|お茶|炭酸|コーラ|サイダー|ビール|ワイン|日本酒|焼酎|飲料|天然水|ミネラルウォーター|^(?:水|茶)$|juice|coffee|tea|beer|wine|water|soy milk|oat milk/],
    ['調味料・乾物', /醤油|しょうゆ|味噌|みそ|みりん|砂糖|塩|胡椒|こしょう|ケチャップ|マヨネーズ|ドレッシング|ソース|だし|出汁|酢|油|小麦粉|片栗粉|パン粉|米|パスタ|スパゲ|うどん|そば|蕎麦|ラーメン|海苔|わかめ|昆布|缶詰|カレー|シチュー|rice|pasta|flour|sauce/],
    ['乳製品・チーズ', /牛乳|ミルク|チーズ|ヨーグルト|バター|生クリーム|マーガリン|練乳|乳製品|milk|cheese|yogurt|yoghurt|butter|cream/],
    ['卵・豆腐・納豆', /卵|玉子|たまご|タマゴ|豆腐|とうふ|トウフ|納豆|なっとう|油揚げ|厚揚げ|こんにゃく|しらたき|egg|tofu|natto/],
    ['精肉・鮮魚', /牛肉|豚肉|鶏肉|とり肉|ひき肉|挽肉|ささみ|手羽|ベーコン|ハム|ソーセージ|ウインナー|鮭|サーモン|まぐろ|マグロ|鯖|さば|サバ|鯵|あじ|アジ|鰯|いわし|イワシ|刺身|魚|えび|エビ|海老|いか|イカ|たこ|タコ|あさり|アサリ|しじみ|ホタテ|帆立|肉|beef|pork|chicken|salmon|fish|shrimp|bacon|sausage/],
    ['野菜・果物', /トマト|とまと|にんじん|人参|ニンジン|玉ねぎ|玉葱|たまねぎ|タマネギ|じゃがいも|ジャガイモ|キャベツ|レタス|白菜|はくさい|大根|だいこん|きゅうり|キュウリ|胡瓜|なす|ナス|茄子|ねぎ|ネギ|葱|ほうれん草|小松菜|こまつな|ブロッコリー|ピーマン|パプリカ|かぼちゃ|カボチャ|ごぼう|ゴボウ|もやし|きのこ|しめじ|しいたけ|えのき|にんにく|生姜|しょうが|アスパラ|とうもろこし|りんご|リンゴ|林檎|みかん|ミカン|バナナ|いちご|イチゴ|苺|ぶどう|ブドウ|葡萄|桃|もも|梨|なし|レモン|オレンジ|キウイ|アボカド|野菜|果物|tomato|carrot|onion|potato|lettuce|apple|banana|orange/]
  ];
  function suggest(name) {
    const normalized = (vocabulary?.canonical(name) || String(name || '')).normalize('NFKC').trim().toLowerCase();
    return rules.find(([, pattern]) => pattern.test(normalized))?.[0] || null;
  }
  const api = { categories, suggest };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.KagopitaCategory = api;
})(typeof window !== 'undefined' ? window : globalThis);
