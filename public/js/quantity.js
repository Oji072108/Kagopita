/* Offline shopping-counter suggestions. Explicit units always win over guesses. */
(function (root) {
  const vocabulary = typeof module !== 'undefined' && module.exports
    ? require('./shopping-language.js') : root.KagopitaShoppingLanguage;
  const rules = [
    ['パック', /パック|ﾊﾟｯｸ/], ['セット', /セット/], ['袋', /袋|ふくろ/], ['箱', /箱|ケース/], ['缶', /缶|かんづめ|缶詰/],
    ['膳', /箸|わりばし|^(?:お)?はし$/],
    ['人', /人数|参加者|大人|子供|子ども|こども/],
    ['羽', /^(?:生きた)?(?:鶏|にわとり|ニワトリ|うさぎ|ウサギ)$|丸鶏/],
    ['匹', /^(?:魚|さかな|金魚|きんぎょ|犬|いぬ|猫|ねこ)$/],
    ['頭', /^(?:牛|うし|豚|ぶた|馬|うま)$/],
    ['本', /にんじん|人参|ニンジン|きゅうり|胡瓜|キュウリ|大根|だいこん|ダイコン|ねぎ|ネギ|葱|ごぼう|ゴボウ|茄子|なす|ナス|バナナ|アスパラ|とうもろこし|トウモロコシ|牛乳|豆乳|ジュース|ペットボトル|ワイン|シャンプー|リンス|歯ブラシ|鉛筆|ペン/],
    ['枚', /食パン|スライスチーズ|ハム|海苔|のり|マスク|タオル|皿|おさら|切手|紙|チケット/],
    ['玉', /キャベツ|レタス|白菜|はくさい|ハクサイ|うどん|そば|蕎麦|ラーメン/],
    ['束', /ほうれん草|ホウレンソウ|小松菜|こまつな|ニラ|にら|花束/],
    ['丁', /豆腐|とうふ|トウフ/], ['粒', /錠剤|サプリ/],
    ['冊', /ノート|雑誌|漫画|マンガ|本$/], ['足', /靴下|くつした|靴|くつ|スリッパ/],
    ['着', /シャツ|ズボン|コート|ジャケット/], ['台', /自転車|掃除機|冷蔵庫|洗濯機/],
    ['個', /トマト|とまと|玉ねぎ|玉葱|たまねぎ|タマネギ|じゃがいも|ジャガイモ|りんご|リンゴ|林檎|みかん|ミカン|卵|たまご|タマゴ|桃|もも|レモン|おにぎり|パン/]
  ];
  function suggest(name) {
    const normalized = (vocabulary?.canonical(name) || String(name || '')).normalize('NFKC').trim();
    return rules.find(([, pattern]) => pattern.test(normalized))?.[0] || '個';
  }
  function format(name, quantity, unit = 'auto') {
    const value = String(quantity ?? '').normalize('NFKC').trim() || '1';
    // Free-form quantities (500g, 半分, 2袋, etc.) remain exactly as entered.
    if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(value)) return String(quantity).trim();
    return value + (unit === 'auto' ? suggest(name) : unit);
  }
  const units = {
    '個': ['piece','개','个','unidad'], '本': ['piece','개','个','unidad'],
    'パック': ['pack','팩','包','paquete'], '袋': ['bag','봉지','袋','bolsa'],
    '箱': ['box','상자','盒','caja'], '缶': ['can','캔','罐','lata'],
    'セット': ['set','세트','套','juego'], '膳': ['pair','벌','双','par'],
    '人': ['person','명','人','persona'], '羽': ['bird','마리','只','ave'],
    '匹': ['animal','마리','只','animal'], '頭': ['animal','마리','头','animal'],
    '枚': ['sheet','장','张','lámina'], '玉': ['head','통','个','unidad'],
    '束': ['bunch','단','把','manojo'], '丁': ['block','모','块','bloque'],
    '粒': ['pill','알','粒','pastilla'], '冊': ['book','권','本','libro'],
    '足': ['pair','켤레','双','par'], '着': ['garment','벌','件','prenda'],
    '台': ['unit','대','台','unidad']
  };
  function display(name, quantity, language = 'ja') {
    const raw = String(quantity ?? '').trim();
    // Only known counters are localized; weights and free-form quantities survive.
    const match = raw.normalize('NFKC').match(/^(\d+(?:\.\d+)?|\.\d+)\s*(個|本|パック|袋|箱|缶|セット|膳|人|羽|匹|頭|枚|玉|束|丁|粒|冊|足|着|台|pieces?|bottles?|packs?|bags?|box(?:es)?|cans?)$/i);
    if (!match) return raw;
    const englishUnits = {piece:'個',bottle:'本',pack:'パック',bag:'袋',box:'箱',can:'缶'};
    const unit = englishUnits[match[2].toLowerCase().replace(/^boxes$/, 'box').replace(/s$/, '')] || (match[2].toLowerCase()==='boxes'?'箱':match[2]);
    if (language === 'ja') return match[1] + unit;
    const index = ['en','ko','zh','es'].indexOf(language);
    if (index < 0 || !units[unit]) return raw;
    const canonical = vocabulary?.canonical(name) || name;
    let translated = units[unit][index];
    if (unit === '本' && /牛乳|豆乳|ミルク|ジュース|ワイン|シャンプー|リンス|水|ビール/.test(canonical)) {
      translated = ['bottle','병','瓶','botella'][index];
    }
    if (unit === '玉' && /うどん|そば|ラーメン/.test(canonical)) translated = ['portion','인분','份','porción'][index];
    if (unit === '枚' && /ハム|チーズ|パン/.test(canonical)) translated = ['slice','장','片','loncha'][index];
    if (Number(match[1]) !== 1 && ['en','es'].includes(language)) {
      const plurals = {box:'boxes',person:'people',unidad:'unidades',par:'pares',porción:'porciones'};
      translated = plurals[translated] || translated + 's';
    }
    return match[1] + (['ko','zh'].includes(language) ? '' : ' ') + translated;
  }
  const counters = { suggest, format, display };
  if (typeof module !== 'undefined' && module.exports) module.exports = counters;
  else root.KagopitaQuantity = counters;
})(typeof window !== 'undefined' ? window : globalThis);
