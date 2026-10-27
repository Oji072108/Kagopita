/* Local shopping vocabulary: no shared data is sent to a translation service.
 * Unrecognized words/brands are preserved; original saved text is never rewritten. */
(function(root) {
  const languages = ['ja','en','ko','zh','es'];
  // Pipe-separated aliases in any language identify the same shopping concept.
  const rows = `牛乳|ミルク;milk;우유;牛奶;leche
豆乳;soy milk;두유;豆奶;leche de soja
オーツミルク;oat milk;귀리 우유;燕麦奶;leche de avena
アーモンドミルク;almond milk;아몬드 우유;杏仁奶;leche de almendras
チーズ;cheese;치즈;奶酪|芝士;queso
スライスチーズ;sliced cheese;슬라이스 치즈;奶酪片;queso en lonchas
ヨーグルト;yogurt|yoghurt;요거트|요구르트;酸奶;yogur
バター;butter;버터;黄油;mantequilla
生クリーム;cream;생크림;奶油;nata
卵|玉子|たまご|タマゴ;eggs|egg;계란|달걀;鸡蛋;huevos|huevo
豆腐|とうふ|トウフ;tofu;두부;豆腐;tofu
納豆|なっとう;natto;낫토;纳豆;natto
トマト|とまと;tomato|tomatoes;토마토;番茄|西红柿;tomate|tomates
にんじん|人参|ニンジン;carrot|carrots;당근;胡萝卜;zanahoria|zanahorias
玉ねぎ|玉葱|たまねぎ|タマネギ;onion|onions;양파;洋葱;cebolla|cebollas
じゃがいも|ジャガイモ;potato|potatoes;감자;土豆|马铃薯;patata|patatas|papa|papas
キャベツ;cabbage;양배추;卷心菜;repollo
レタス;lettuce;상추|양상추;生菜;lechuga
白菜|はくさい;Chinese cabbage;배추;大白菜;col china
きゅうり|胡瓜|キュウリ;cucumber|cucumbers;오이;黄瓜;pepino|pepinos
大根|だいこん|ダイコン;daikon|radish;무;白萝卜;rábano
なす|茄子|ナス;eggplant|aubergine;가지;茄子;berenjena
ねぎ|ネギ|葱;spring onion|green onion;대파;葱;cebolleta
ほうれん草|ホウレンソウ;spinach;시금치;菠菜;espinacas
小松菜|こまつな;komatsuna;고마츠나;小松菜;komatsuna
ブロッコリー;broccoli;브로콜리;西兰花;brócoli
ピーマン;green pepper;피망;青椒;pimiento verde
パプリカ;bell pepper;파프리카;甜椒;pimiento
かぼちゃ|カボチャ;pumpkin;단호박|호박;南瓜;calabaza
もやし;bean sprouts;숙주나물;豆芽;brotes de soja
きのこ;mushrooms|mushroom;버섯;蘑菇;champiñones
にんにく;garlic;마늘;大蒜;ajo
生姜|しょうが;ginger;생강;姜;jengibre
とうもろこし|トウモロコシ;corn;옥수수;玉米;maíz
りんご|林檎|リンゴ;apple|apples;사과;苹果;manzana|manzanas
みかん|ミカン;mandarin|mandarins;귤;橘子;mandarina
バナナ;banana|bananas;바나나;香蕉;plátano|plátanos|banana|bananas
いちご|苺|イチゴ;strawberry|strawberries;딸기;草莓;fresa|fresas
ぶどう|葡萄|ブドウ;grapes|grape;포도;葡萄;uvas|uva
桃|もも;peach|peaches;복숭아;桃子;melocotón
レモン;lemon|lemons;레몬;柠檬;limón
オレンジ;orange|oranges;오렌지;橙子;naranja|naranjas
アボカド;avocado|avocados;아보카도;牛油果;aguacate
牛肉;beef;소고기;牛肉;carne de res|ternera
豚肉;pork;돼지고기;猪肉;cerdo
鶏肉|とり肉;chicken;닭고기;鸡肉;pollo
ひき肉|挽肉;ground meat|minced meat;다진 고기;肉末;carne picada
ベーコン;bacon;베이컨;培根;beicon
ハム;ham;햄;火腿;jamón
ソーセージ;sausage|sausages;소시지;香肠;salchicha|salchichas
鮭|サーモン;salmon;연어;三文鱼|鲑鱼;salmón
まぐろ|マグロ;tuna;참치;金枪鱼;atún
鯖|さば|サバ;mackerel;고등어;鲭鱼;caballa
魚|さかな;fish;생선;鱼;pescado
えび|エビ|海老;shrimp|prawns;새우;虾;gambas
いか|イカ;squid;오징어;鱿鱼;calamar
たこ|タコ;octopus;문어;章鱼;pulpo
お米|米|コメ;rice;쌀;大米;arroz
パスタ;pasta;파스타;意大利面;pasta
うどん;udon;우동;乌冬面;udon
そば|蕎麦;soba;소바;荞麦面;soba
ラーメン;ramen;라면;拉面;ramen
パン;bread;빵;面包;pan
食パン;sliced bread;식빵;吐司;pan de molde
小麦粉;flour;밀가루;面粉;harina
砂糖;sugar;설탕;糖;azúcar
塩;salt;소금;盐;sal
胡椒|こしょう;pepper;후추;胡椒;pimienta
醤油|しょうゆ;soy sauce;간장;酱油;salsa de soja
味噌|みそ;miso;미소;味噌;miso
油;cooking oil;식용유;食用油;aceite
酢;vinegar;식초;醋;vinagre
ケチャップ;ketchup;케첩;番茄酱;kétchup
マヨネーズ;mayonnaise;마요네즈;蛋黄酱;mayonesa
海苔|のり;nori;김;海苔;nori
水;water;물;水;agua
コーヒー|珈琲;coffee;커피;咖啡;café
紅茶;black tea;홍차;红茶;té negro
緑茶;green tea;녹차;绿茶;té verde
お茶;tea;차;茶;té
ジュース;juice;주스;果汁;zumo|jugo
ビール;beer;맥주;啤酒;cerveza
ワイン;wine;와인;葡萄酒;vino
アイスクリーム;ice cream;아이스크림;冰淇淋;helado
冷凍;frozen;냉동;冷冻;congelado
クッキー;cookies|cookie;쿠키;饼干;galletas
チョコレート|チョコ;chocolate;초콜릿;巧克力;chocolate
ケーキ;cake;케이크;蛋糕;pastel
洗剤;detergent;세제;洗涤剂;detergente
柔軟剤;fabric softener;섬유유연제;柔顺剂;suavizante
シャンプー;shampoo;샴푸;洗发水;champú
リンス;conditioner;린스;护发素;acondicionador
石鹸|せっけん;soap;비누;肥皂;jabón
歯ブラシ;toothbrush;칫솔;牙刷;cepillo de dientes
歯磨き粉;toothpaste;치약;牙膏;pasta de dientes
ティッシュ;tissues|tissue;티슈;纸巾;pañuelos
トイレットペーパー;toilet paper;화장지;卫生纸;papel higiénico
キッチンペーパー;paper towels;키친타월;厨房纸;papel de cocina
ゴミ袋|ごみ袋;trash bags|garbage bags;쓰레기봉투;垃圾袋;bolsas de basura
スポンジ;sponge;스펀지;海绵;esponja
おむつ;diapers|nappies;기저귀;尿布;pañales
電池;batteries|battery;건전지;电池;pilas
マスク;mask|masks;마스크;口罩;mascarilla
箸|割り箸|わりばし;chopsticks;젓가락;筷子;palillos
靴下|くつした;socks;양말;袜子;calcetines
ノート;notebook;공책;笔记本;cuaderno
タオル;towel;수건;毛巾;toalla
袋;bag|bags;봉지;袋;bolsa|bolsas
箱;box|boxes;상자;盒; caja|cajas
パック;pack|packs;팩;包;paquete|paquetes
缶;can|cans;캔;罐;lata|latas
セット;set|sets;세트;套;juego|juegos
キログラム|キロ;kg;kg;千克;kg
リットル;litre|liter;리터;升;litro
乳製品;dairy;유제품;乳制品;lácteos`.split('\n').map(line=>line.split(';').map(cell=>cell.trim().split('|')));
  const aliases = new Map();
  const key = s => String(s || '').normalize('NFKC').toLowerCase();
  for(const row of rows) for(const terms of row) for(const term of terms) if(!aliases.has(key(term))) aliases.set(key(term), row);
  const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [...aliases.keys()].sort((a,b)=>b.length-a.length).map(term =>
    /[a-záéíóúñ]/i.test(term) ? `(?<![\\p{L}])${escape(term)}(?![\\p{L}])` : escape(term));
  const pattern = new RegExp(patterns.join('|'),'giu');
  function translate(text, language='ja') {
    const index = languages.indexOf(language); if(index<0) return String(text || '');
    return String(text || '').replace(pattern, match => {
      const row = aliases.get(key(match));
      // Preserve a person's spelling/aliases when already in their language.
      return row[index].some(term=>key(term)===key(match)) ? match : row[index][0];
    });
  }
  const api={translate, canonical:text=>translate(String(text||'').normalize('NFKC'),'ja'), languages};
  if(typeof module!=='undefined' && module.exports) module.exports=api;
  else root.KagopitaShoppingLanguage=api;
})(typeof window!=='undefined'?window:globalThis);
