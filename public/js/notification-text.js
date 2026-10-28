/* Shared browser/server notification text. Original shopping records are never rewritten. */
(function(root) {
  const node = typeof module !== 'undefined' && module.exports;
  const vocabulary = node ? require('./shopping-language.js') : root.KagopitaShoppingLanguage;
  const quantity = node ? require('./quantity.js') : root.KagopitaQuantity;
  const languages = ['ja', 'en', 'ko', 'zh', 'es'];
  const copy = {
    ja: {actor:'誰か', added:['商品が追加されました','{actor}が追加しました：{item}'], edited:['商品が編集されました','{actor}が編集しました：{item}'], deleted:['商品が削除されました','{actor}が削除しました：{item}'], completed:['商品がチェックされました','{actor}がチェックしました：{item}'], uncompleted:['商品のチェックが解除されました','{actor}がチェックを解除しました：{item}'], restored:['商品が復元されました','{actor}が復元しました：{item}'], recurring:['繰り返し商品が再開されました','再び買う商品：{item}'], updated:['リストが更新されました','{actor}が更新しました：{item}'], test:['テスト通知','プッシュ通知を受信できました。']},
    en: {actor:'Someone', added:['Item added','{actor} added: {item}'], edited:['Item edited','{actor} edited: {item}'], deleted:['Item removed','{actor} removed: {item}'], completed:['Item checked off','{actor} checked off: {item}'], uncompleted:['Item unchecked','{actor} unchecked: {item}'], restored:['Item restored','{actor} restored: {item}'], recurring:['Recurring item ready','Time to buy again: {item}'], updated:['List updated','{actor} updated: {item}'], test:['Test notification','Push notifications are working.']},
    ko: {actor:'누군가', added:['상품 추가','{actor}님이 추가했습니다: {item}'], edited:['상품 수정','{actor}님이 수정했습니다: {item}'], deleted:['상품 삭제','{actor}님이 삭제했습니다: {item}'], completed:['상품 체크','{actor}님이 체크했습니다: {item}'], uncompleted:['상품 체크 해제','{actor}님이 체크를 해제했습니다: {item}'], restored:['상품 복원','{actor}님이 복원했습니다: {item}'], recurring:['반복 상품 재개','다시 구매할 상품: {item}'], updated:['목록 업데이트','{actor}님이 업데이트했습니다: {item}'], test:['테스트 알림','푸시 알림을 받았습니다.']},
    zh: {actor:'有人', added:['已添加商品','{actor}添加了：{item}'], edited:['已编辑商品','{actor}编辑了：{item}'], deleted:['已删除商品','{actor}删除了：{item}'], completed:['已勾选商品','{actor}勾选了：{item}'], uncompleted:['已取消勾选商品','{actor}取消勾选了：{item}'], restored:['已恢复商品','{actor}恢复了：{item}'], recurring:['重复商品已恢复','该再次购买了：{item}'], updated:['清单已更新','{actor}更新了：{item}'], test:['测试通知','已收到推送通知。']},
    es: {actor:'Alguien', added:['Producto añadido','{actor} añadió: {item}'], edited:['Producto editado','{actor} editó: {item}'], deleted:['Producto eliminado','{actor} eliminó: {item}'], completed:['Producto marcado','{actor} marcó: {item}'], uncompleted:['Producto desmarcado','{actor} desmarcó: {item}'], restored:['Producto restaurado','{actor} restauró: {item}'], recurring:['Producto recurrente listo','Es hora de volver a comprar: {item}'], updated:['Lista actualizada','{actor} actualizó: {item}'], test:['Notificación de prueba','Las notificaciones push funcionan.']}
  };
  const language = value => languages.includes(value) ? value : 'ja';
  const clean = value => String(value || '').replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, ' ').trim();
  function format(entry, locale) {
    const lang = language(locale), t = copy[lang];
    if (!entry) return {title:t.test[0], body:t.test[1]};
    const raw = clean(entry.item);
    const match = raw.match(/^(.*) \(([^()]*)\)$/u);
    const name = match ? match[1] : raw;
    const item = vocabulary.translate(name, lang) + (match ? ` (${quantity.display(name, match[2], lang)})` : '');
    const action = t[entry.action] || t.updated;
    const values = {actor:clean(entry.actor_name || entry.actorName) || t.actor, item};
    return {title:action[0], body:action[1].replace(/\{(actor|item)\}/g, (_, key) => values[key])};
  }
  const api = {format, language};
  if (node) module.exports = api; else root.KagopitaNotificationText = api;
})(typeof window !== 'undefined' ? window : globalThis);
