let localizationReady = false;
let currentTab = 'list';
let currentUser = null;
let currentChannelId = null;
let currentMemberRole = null;
let channels = [];
let favoritesRequestId = 0;
const canEditItems = () => ['owner', 'admin', 'editor'].includes(currentMemberRole);
const memberRoleLabel = role => ({owner: '作成者（オーナー）', admin: '管理者', editor: '編集者', member: 'メンバー'})[role] || 'メンバー';

const $ = id => document.getElementById(id);
const shoppingLanguage = () => localStorage.getItem('kagopita-language') || 'ja';
const localItemName = name => KagopitaShoppingLanguage.translate(name, shoppingLanguage());
// Mark canonical source text explicitly; DOM translation is per viewer only.
function shoppingName(element, source) {
  element.dataset.shoppingName = source;
  element.dataset.i18nIgnore = 'true';
  element.textContent = localItemName(source);
  if (element.textContent !== source) element.title = source;
}
function shoppingQuantity(element, name, quantity, prefix = '', suffix = '') {
  Object.assign(element.dataset, {shoppingQuantity: quantity, shoppingItem: name, shoppingPrefix: prefix, shoppingSuffix: suffix, i18nIgnore: 'true'});
  element.textContent = prefix + KagopitaQuantity.display(name, quantity, shoppingLanguage()) + suffix;
}

const translations = {
  ja: { profileTitle: '表示名を変更', accountSettingsTitle: 'アカウント', profileNameLabel: '表示名', profileAvatarLabel: 'プロフィール画像', photoAdd: '写真を追加', photoHint: 'JPG、PNG、WebP / 400KB以内', choose: '選択', close: '閉じる', save: '保存する', leave: 'このリストから退出', logout: 'ログアウト', language: '表示言語', languageSub: 'Language', navList: 'リスト', navAdd: '追加・共有', navMembers: 'メンバー', navAccount: 'アカウント', navComplete: '完了', doneEyebrow: '買い物完了', doneTitle: '買い忘れなし！', doneText: 'この共有リストと履歴を削除し、メンバー全員をこのリストから退出させます。他のリストやアカウントには影響しません。', doneDelete: 'このリストを完了して削除', doneBack: 'リストに戻る' },
  en: { email: 'Email address', password: 'Password (8+ characters)', create: 'Create account', profileTitle: 'Edit profile', accountSettingsTitle: 'Account', profileNameLabel: 'Display name', profileAvatarLabel: 'Profile picture', photoAdd: 'Add a photo', photoHint: 'JPG, PNG, WebP / up to 400KB', choose: 'Choose', close: 'Close', save: 'Save', leave: 'Leave this list', logout: 'Log out', language: 'Display language', languageSub: '言語', navList: 'Lists', navAdd: 'Add · Share', navMembers: 'Members', navAccount: 'Account', navComplete: 'Done', doneEyebrow: 'Shopping complete', doneTitle: 'Nothing forgotten!', doneText: 'This removes the shared list and its activity log and removes every member from it. Other lists and accounts are not affected.', doneDelete: 'Complete and delete this list', doneBack: 'Back to list' },
  ko: { profileTitle: '프로필 편집', accountSettingsTitle: '계정', profileNameLabel: '표시 이름', profileAvatarLabel: '프로필 사진', photoAdd: '사진 추가', photoHint: 'JPG, PNG, WebP / 400KB 이하', choose: '선택', close: '닫기', save: '저장', leave: '이 목록에서 나가기', logout: '로그아웃', email: '이메일 주소', password: '비밀번호 (8자 이상)', create: '계정 만들기', language: '표시 언어', languageSub: 'Language', navList: '목록', navAdd: '추가 · 공유', navMembers: '멤버', navAccount: '계정', navComplete: '완료', doneEyebrow: '쇼핑 완료', doneTitle: '빠뜨린 것이 없어요!', doneText: '공유 목록과 기록을 삭제하고 모든 멤버를 목록에서 내보냅니다. 다른 목록과 계정에는 영향을 주지 않습니다.', doneDelete: '목록 완료 후 삭제', doneBack: '목록으로 돌아가기' },
  zh: { email: '电子邮件地址', password: '密码（至少8个字符）', create: '创建账户', profileTitle: '编辑资料', accountSettingsTitle: '账户', profileNameLabel: '显示名称', profileAvatarLabel: '头像', save: '保存', leave: '退出此清单', logout: '退出登录', language: '显示语言', languageSub: 'Language', navList: '清单', navAdd: '添加 · 分享', navMembers: '成员', navAccount: '账户', navComplete: '完成', doneEyebrow: '购物完成', doneTitle: '没有遗漏！', doneText: '这将删除共享清单和活动记录，并移除所有成员。不会影响其他清单或账户。', doneDelete: '完成并删除清单', doneBack: '返回清单' },
  es: { email: 'Correo electrónico', password: 'Contraseña (8+ caracteres)', create: 'Crear cuenta', profileTitle: 'Editar perfil', accountSettingsTitle: 'Cuenta', profileNameLabel: 'Nombre visible', profileAvatarLabel: 'Foto de perfil', save: 'Guardar', leave: 'Salir de esta lista', logout: 'Cerrar sesión', language: 'Idioma de visualización', languageSub: 'Language', navList: 'Listas', navAdd: 'Añadir · Compartir', navMembers: 'Miembros', navAccount: 'Cuenta', navComplete: 'Listo', doneEyebrow: 'Compra completada', doneTitle: '¡No falta nada!', doneText: 'Esto elimina la lista compartida y su historial y retira a todos los miembros. Las demás listas y cuentas no se verán afectadas.', doneDelete: 'Completar y eliminar lista', doneBack: 'Volver a la lista' }
};
const uiTranslations = {
  en: {
    'リストを共有': 'Share list', '共有リスト': 'Shared lists', '参加中のリストを表示したり、切り替えたりできます。': 'View and switch between lists you have joined.', '参加中のリストを見る': 'View joined lists', 'お気に入り': 'Favorites', 'お気に入りはまだありません。': 'No favorites yet.', '新しい項目を追加': 'Add a new item', '商品名': 'Item name', '売り場・カテゴリ': 'Store · category', '数量': 'Quantity', 'リストに追加する': 'Add to list', '現在の進捗状況': 'Current progress', '買いものリスト': 'Shopping list', 'チェック完了': 'Checked off', 'リストは空です。商品を追加しましょう！': 'Your list is empty. Add something to get started!', '項目を追加する': 'Add item', '買い物を完了する': 'Complete shopping', '履歴': 'Activity', 'メンバー': 'Members', '管理者': 'Admin', '参加者': 'Member', 'リストに戻る': 'Back to list', '野菜・果物': 'Vegetables · fruit', '精肉・鮮魚': 'Meat · seafood', '日用品': 'Daily goods', '例：トマト、牛乳、洗剤': 'E.g. tomatoes, milk, detergent', '追加': 'Add', '削除': 'Delete', '閉じる': 'Close', '退出させる': 'Remove'
  },
  ko: {
    'リストを共有': '목록 공유', '共有リスト': '공유 목록', '参加中のリストを表示したり、切り替えたりできます。': '참여 중인 목록을 보고 전환할 수 있습니다.', '参加中のリストを見る': '참여 중인 목록 보기', 'お気に入り': '즐겨찾기', 'お気に入りはまだありません。': '즐겨찾기가 아직 없습니다.', '新しい項目を追加': '새 항목 추가', '商品名': '상품명', '売り場・カテゴリ': '판매처 · 카테고리', '数量': '수량', 'リストに追加する': '목록에 추가', '現在の進捗状況': '현재 진행 상황', '買いものリスト': '쇼핑 목록', 'チェック完了': '체크 완료', 'リストは空です。商品を追加しましょう！': '목록이 비어 있습니다. 항목을 추가해 보세요!', '項目を追加する': '항목 추가', '買い物を完了する': '쇼핑 완료', '履歴': '활동 기록', 'メンバー': '멤버', '管理者': '관리자', '参加者': '참여자', 'リストに戻る': '목록으로 돌아가기', '野菜・果物': '채소 · 과일', '精肉・鮮魚': '정육 · 수산물', '日用品': '생활용품', '例：トマト、牛乳、洗剤': '예: 토마토, 우유, 세제', '追加': '추가', '削除': '삭제', '閉じる': '닫기', '退出させる': '내보내기'
  },
  zh: {
    'リストを共有': '分享清单', '共有リスト': '共享清单', '参加中のリストを表示したり、切り替えたりできます。': '查看并切换已加入的清单。', '参加中のリストを見る': '查看已加入的清单', 'お気に入り': '收藏夹', 'お気に入りはまだありません。': '还没有收藏。', '新しい項目を追加': '添加新项目', '商品名': '商品名称', '売り場・カテゴリ': '商店 · 分类', '数量': '数量', 'リストに追加する': '添加到清单', '現在の進捗状況': '当前进度', '買いものリスト': '购物清单', 'チェック完了': '已完成', 'リストは空です。商品を追加しましょう！': '列表为空，请添加内容！', '項目を追加する': '添加项目', '買い物を完了する': '完成购物', '履歴': '活动记录', 'メンバー': '成员', '管理者': '管理员', '参加者': '成员', 'リストに戻る': '返回清单', '野菜・果物': '蔬菜 · 水果', '精肉・鮮魚': '肉类 · 海鲜', '日用品': '日用品', '例：トマト、牛乳、洗剤': '例如：番茄、牛奶、洗衣液', '追加': '添加', '削除': '删除', '閉じる': '关闭', '退出させる': '移除'
  },
  es: {
    'リストを共有': 'Compartir lista', '共有リスト': 'Listas compartidas', '参加中のリストを表示したり、切り替えたりできます。': 'Consulta y cambia entre tus listas.', '参加中のリストを見る': 'Ver listas compartidas', 'お気に入り': 'Favoritos', 'お気に入りはまだありません。': 'Aún no hay favoritos.', '新しい項目を追加': 'Añadir artículo', '商品名': 'Nombre del artículo', '売り場・カテゴリ': 'Tienda · categoría', '数量': 'Cantidad', 'リストに追加する': 'Añadir a la lista', '現在の進捗状況': 'Progreso actual', '買いものリスト': 'Lista de compras', 'チェック完了': 'Completado', 'リストは空です。商品を追加しましょう！': 'La lista está vacía. ¡Añade algo!', '項目を追加する': 'Añadir artículo', '買い物を完了する': 'Completar compra', '履歴': 'Actividad', 'メンバー': 'Miembros', '管理者': 'Administrador', '参加者': 'Miembro', 'リストに戻る': 'Volver a la lista', '野菜・果物': 'Verduras · fruta', '精肉・鮮魚': 'Carne · marisco', '日用品': 'Artículos diarios', '例：トマト、牛乳、洗剤': 'Ej.: tomates, leche, detergente', '追加': 'Añadir', '削除': 'Eliminar', '閉じる': 'Cerrar', '退出させる': 'Quitar'
  }
};
Object.assign(uiTranslations.en, {
  '共有リストがありません': 'No shared lists', '新しいリストを作成するか、招待コードを入力して参加してください。': 'Create a new list or join one with an invite code.', 'リストを作成・参加': 'Create or join a list', '招待コード': 'Invite code', 'ゲスト': 'Guest', 'アカウント': 'Account', '自分の表示名': 'Your display name', 'ゲストで始める': 'Start as guest', 'メールでアカウントを作成': 'Create an account with email', 'ログイン': 'Sign in', '表示名': 'Display name', 'メールアドレス': 'Email address', 'パスワード（8文字以上）': 'Password (8+ characters)', 'アカウントを作成': 'Create account', '戻る': 'Back', '今日のお買い物を管理しましょう。': 'Manage your shopping for today.', '買い物完了': 'Shopping complete', '買い忘れなし！': 'Nothing left to buy!', 'リンクをコピー': 'Copy link', '送信': 'Send', 'キャンセル': 'Cancel', '保存する': 'Save', '表示言語': 'Language', '退出する': 'Leave', '参加中のリスト': 'Joined lists', '新しいリスト名': 'New list name', 'リストを作成': 'Create list', '招待番号で参加': 'Join with invite code', '追加・共有': 'Add · share', '完了': 'Done', 'お菓子・パン': 'Snacks · bread', 'リストから退出しますか？': 'Leave this list?', '退出すると、このリストが参加中のリストから削除されます。管理者の場合、残っているメンバーに管理者権限が移ります。': 'Leaving removes this list from your joined lists. If you are the admin, another member will become admin.', '確認して登録を完了': 'Verify and finish registration', 'コードを再送信': 'Resend code', '例：週末の買い出し': 'E.g. weekend shopping', '招待番号（半角英数字8文字）': 'Invite code (8 letters/numbers)', '招待番号を入力': 'Enter invite code'
});
Object.assign(uiTranslations.ko, {
  '共有リストがありません': '공유 목록이 없습니다', '新しいリストを作成するか、招待コードを入力して参加してください。': '새 목록을 만들거나 초대 코드로 참여하세요.', 'リストを作成・参加': '목록 만들기 · 참여', '招待コード': '초대 코드', 'ゲスト': '게스트', 'アカウント': '계정', '自分の表示名': '표시 이름', 'ゲストで始める': '게스트로 시작', 'メールでアカウントを作成': '이메일로 계정 만들기', 'ログイン': '로그인', '表示名': '표시 이름', 'メールアドレス': '이메일 주소', 'パスワード（8文字以上）': '비밀번호(8자 이상)', 'アカウントを作成': '계정 만들기', '戻る': '뒤로', '今日のお買い物を管理しましょう。': '오늘의 쇼핑을 관리하세요.', '買い物完了': '쇼핑 완료', '買い忘れなし！': '빠뜨린 물건이 없습니다!', 'リンクをコピー': '링크 복사', '送信': '보내기', 'キャンセル': '취소', '保存する': '저장', '表示言語': '표시 언어', '退出する': '나가기', '参加中のリスト': '참여 중인 목록', '新しいリスト名': '새 목록 이름', 'リストを作成': '목록 만들기', '招待番号で参加': '초대 코드로 참여', '追加・共有': '추가 · 공유', '完了': '완료', 'お菓子・パン': '간식 · 빵', 'リストから退出しますか？': '이 목록에서 나가시겠습니까?', '退出すると、このリストが参加中のリストから削除されます。管理者の場合、残っているメンバーに管理者権限が移ります。': '나가면 참여 중인 목록에서 삭제됩니다. 관리자라면 다른 멤버에게 관리자 권한이 이전됩니다.', '確認して登録を完了': '확인하고 가입 완료', 'コードを再送信': '코드 다시 보내기', '例：週末の買い出し': '예: 주말 장보기', '招待番号（半角英数字8文字）': '초대 코드(영문/숫자 8자)', '招待番号を入力': '초대 코드 입력'
});
Object.assign(uiTranslations.zh, {
  '共有リストがありません': '没有共享清单', '新しいリストを作成するか、招待コードを入力して参加してください。': '创建新清单，或输入邀请码加入。', 'リストを作成・参加': '创建或加入清单', '招待コード': '邀请码', 'ゲスト': '访客', 'アカウント': '账户', '自分の表示名': '你的显示名称', 'ゲストで始める': '以访客身份开始', 'メールでアカウントを作成': '使用邮箱创建账户', 'ログイン': '登录', '表示名': '显示名称', 'メールアドレス': '邮箱地址', 'パスワード（8文字以上）': '密码（至少8个字符）', 'アカウントを作成': '创建账户', '戻る': '返回', '今日のお買い物を管理しましょう。': '管理今天的购物。', '買い物完了': '购物完成', '買い忘れなし！': '没有遗漏要买的东西！', 'リンクをコピー': '复制链接', '送信': '发送', 'キャンセル': '取消', '保存する': '保存', '表示言語': '显示语言', '退出する': '退出', '参加中のリスト': '已加入的清单', '新しいリスト名': '新清单名称', 'リストを作成': '创建清单', '招待番号で参加': '使用邀请码加入', '追加・共有': '添加 · 分享', '完了': '完成', 'お菓子・パン': '零食 · 面包', 'リストから退出しますか？': '要退出此清单吗？', '退出すると、このリストが参加中のリストから削除されます。管理者の場合、残っているメンバーに管理者権限が移ります。': '退出后，此清单会从已加入列表中移除。若你是管理员，管理员权限会转给其他成员。', '確認して登録を完了': '验证并完成注册', 'コードを再送信': '重新发送验证码', '例：週末の買い出し': '例如：周末采购', '招待番号（半角英数字8文字）': '邀请码（8位字母/数字）', '招待番号を入力': '输入邀请码'
});
Object.assign(uiTranslations.es, {
  '共有リストがありません': 'No hay listas compartidas', '新しいリストを作成するか、招待コードを入力して参加してください。': 'Crea una lista o únete con un código de invitación.', 'リストを作成・参加': 'Crear o unirse a una lista', '招待コード': 'Código de invitación', 'ゲスト': 'Invitado', 'アカウント': 'Cuenta', '自分の表示名': 'Tu nombre visible', 'ゲストで始める': 'Empezar como invitado', 'メールでアカウントを作成': 'Crear cuenta con correo', 'ログイン': 'Iniciar sesión', '表示名': 'Nombre visible', 'メールアドレス': 'Correo electrónico', 'パスワード（8文字以上）': 'Contraseña (8 caracteres o más)', 'アカウントを作成': 'Crear cuenta', '戻る': 'Volver', '今日のお買い物を管理しましょう。': 'Gestiona tus compras de hoy.', '買い物完了': 'Compra completada', '買い忘れなし！': '¡No queda nada por comprar!', 'リンクをコピー': 'Copiar enlace', '送信': 'Enviar', 'キャンセル': 'Cancelar', '保存する': 'Guardar', '表示言語': 'Idioma', '退出する': 'Salir', '参加中のリスト': 'Listas compartidas', '新しいリスト名': 'Nombre de la nueva lista', 'リストを作成': 'Crear lista', '招待番号で参加': 'Unirse con código', '追加・共有': 'Añadir · compartir', '完了': 'Completado', 'お菓子・パン': 'Snacks · pan', 'リストから退出しますか？': '¿Salir de esta lista?', '退出すると、このリストが参加中のリストから削除されます。管理者の場合、残っているメンバーに管理者権限が移ります。': 'Al salir, esta lista se elimina de tus listas compartidas. Si eres administrador, otro miembro recibirá ese permiso.', '確認して登録を完了': 'Verificar y terminar registro', 'コードを再送信': 'Reenviar código', '例：週末の買い出し': 'Ej.: compras del fin de semana', '招待番号（半角英数字8文字）': 'Código (8 letras/números)', '招待番号を入力': 'Introduce el código'
});
const feedTranslations = {
  en: { created: 'created the list', joined: 'joined the shared list', added: item => `added “${item}”`, completed: item => `marked “${item}” complete`, uncompleted: item => `marked “${item}” incomplete`, deleted: item => `deleted “${item}”`, kicked: item => `removed “${item}” from the list`, left: item => `left “${item}”`, renamed: item => `changed the name (${item})`, updated: 'updated the list' },
  ko: { created: '목록을 만들었습니다', joined: '공유 목록에 참여했습니다', added: item => `「${item}」을(를) 추가했습니다`, completed: item => `「${item}」을(를) 완료했습니다`, uncompleted: item => `「${item}」을(를) 미완료로 되돌렸습니다`, deleted: item => `「${item}」을(를) 삭제했습니다`, kicked: item => `「${item}」을(를) 목록에서 내보냈습니다`, left: item => `「${item}」에서 나갔습니다`, renamed: item => `이름을 변경했습니다 (${item})`, updated: '목록을 업데이트했습니다' },
  zh: { created: '创建了清单', joined: '加入了共享清单', added: item => `添加了“${item}”`, completed: item => `将“${item}”标记为完成`, uncompleted: item => `将“${item}”恢复为未完成`, deleted: item => `删除了“${item}”`, kicked: item => `将“${item}”移出清单`, left: item => `退出了“${item}”`, renamed: item => `更改了名称（${item}）`, updated: '更新了清单' },
  es: { created: 'creó la lista', joined: 'se unió a la lista compartida', added: item => `añadió “${item}”`, completed: item => `marcó “${item}” como completado`, uncompleted: item => `marcó “${item}” como pendiente`, deleted: item => `eliminó “${item}”`, kicked: item => `quitó “${item}” de la lista`, left: item => `salió de “${item}”`, renamed: item => `cambió el nombre (${item})`, updated: 'actualizó la lista' }
};
Object.assign(uiTranslations.en, { 'アカウントをお持ちですか？': 'Have an account?', 'ログイン': 'Log in' });
Object.assign(uiTranslations.ko, { 'アカウントをお持ちですか？': '계정이 있으신가요?', 'ログイン': '로그인' });
Object.assign(uiTranslations.zh, { 'アカウントをお持ちですか？': '已有账户？', 'ログイン': '登录' });
Object.assign(uiTranslations.es, { 'アカウントをお持ちですか？': '¿Ya tienes una cuenta?', 'ログイン': 'Iniciar sesión' });
feedTranslations.en.edited = item => `edited “${item}”`;
feedTranslations.ko.edited = item => `「${item}」을(를) 수정했습니다`;
feedTranslations.zh.edited = item => `编辑了“${item}”`;
feedTranslations.es.edited = item => `editó “${item}”`;
for (const [locale, labels] of Object.entries({
  en: ['restored', 'made recurring item pending again', 'archived the list', 'unarchived the list'],
  ko: ['복원했습니다', '반복 상품을 미구매로 되돌렸습니다', '목록을 보관했습니다', '보관을 해제했습니다'],
  zh: ['恢复了', '将重复商品恢复为未购买', '归档了清单', '取消归档了清单'],
  es: ['restauró', 'volvió a marcar pendiente el artículo recurrente', 'archivó la lista', 'desarchivó la lista']
})) {
  feedTranslations[locale].restored = item => `${labels[0]} “${item}”`;
  feedTranslations[locale].recurring = item => `${labels[1]} “${item}”`;
  feedTranslations[locale].archived = labels[2]; feedTranslations[locale].unarchived = labels[3];
}
for (const [language, label] of Object.entries({en: 'changed a member’s role', ko: '멤버 권한을 변경했습니다', zh: '更改了成员权限', es: 'cambió el rol de un miembro'})) feedTranslations[language]['role-changed'] = label;
for (const row of window.kagopitaLocaleRows) {
  ['en','ko','zh','es'].forEach((language, index) => { uiTranslations[language][row[0]] = row[index + 1]; });
}
function translatePageText(language) {
  window.KagopitaI18n.translate(document.body, language, uiTranslations[language] || {});
}
function applyLanguage(language) {
  const t = translations[language] || translations.ja;
  translatePageText(language);
  document.documentElement.lang = language;
  $('profileTitle').textContent = t.accountSettingsTitle;
  $('accountSettingsTitle').textContent = (uiTranslations[language] || {})['ログイン設定'] || 'ログイン設定';
  document.querySelector('label[for="profileName"]').textContent = t.profileNameLabel;
  document.querySelector('label[for="profileAvatar"]').textContent = t.profileAvatarLabel;
  const emailLabel = document.querySelector('label[for="accountEmail"]');
  const passwordLabel = document.querySelector('label[for="accountPassword"]');
  const createButton = document.querySelector('#credentialsForm [type="submit"]');
  if (emailLabel && t.email) emailLabel.textContent = t.email;
  if (passwordLabel && t.password) passwordLabel.textContent = t.password;
  if (createButton && t.create) createButton.textContent = t.create;
  const photoCopy = document.querySelector('.avatar-picker-copy strong');
  const photoHint = document.querySelector('.avatar-picker-copy small');
  const chooseButton = document.querySelector('.avatar-picker-button');
  if (photoCopy) photoCopy.textContent = t.photoAdd || (uiTranslations[language] || {})['写真を追加'] || '写真を追加';
  if (photoHint) photoHint.textContent = t.photoHint || (uiTranslations[language] || {})['JPG、PNG、WebP / 400KB以内'] || 'JPG、PNG、WebP / 400KB以内';
  if (chooseButton) chooseButton.textContent = t.choose || (uiTranslations[language] || {})['選択'] || '選択';
  $('closeProfileDialog').setAttribute('aria-label', t.close || translations.en.close);
  $('profileSaveButton').textContent = t.save;
  $('leaveGroup').textContent = t.leave;
  $('logoutButton').textContent = t.logout;
  document.querySelector('.language-setting-copy strong').textContent = t.language;
  document.querySelector('.language-setting-copy small').textContent = 'Language';
  const complete = document.querySelector('#view-complete');
  if (complete) {
    complete.querySelector('.eyebrow').textContent = t.doneEyebrow;
    complete.querySelector('h2').textContent = t.doneTitle;
    complete.querySelector('p').textContent = t.doneText;
    complete.querySelectorAll('button')[0].lastChild.textContent = ` ${t.doneDelete}`;
  }
  $('nav-list').querySelector('span').textContent = t.navList;
  $('nav-add').querySelector('span').textContent = (uiTranslations[language] || {})['追加'] || '追加';
  localStorage.setItem('kagopita-language', language);
  if (localizationReady && shoppingData) {
    renderShoppingList(shoppingData); renderDeletedItems(shoppingData.deletedItems || []);
  }
  document.querySelectorAll('[data-member-role]').forEach(element => { element.textContent = translateFeature(memberRoleLabel(element.dataset.memberRole)); });
  document.querySelectorAll('.member-role-select option').forEach(option => { option.textContent = translateFeature(memberRoleLabel(option.value)); });
  window.KagopitaNotifications?.render();
  window.KagopitaPush?.render();
  window.KagopitaPush?.syncLanguage();
  if (localizationReady) { renderJoinedChannels(); updateQuantityPreview('input'); updateQuantityPreview('edit'); }
  if (currentUser) updateAccountStatus(language);
  const trigger = $('languageSelect');
  if (trigger) {
    trigger.childNodes[0].textContent = ({ ja: '日本語', en: 'English', ko: '한국어', zh: '简体中文', es: 'Español' }[language] || '日本語') + ' ';
    document.querySelectorAll('#languageOptions [data-language]').forEach(option => option.setAttribute('aria-selected', String(option.dataset.language === language)));
  }
}
const savedLanguage = localStorage.getItem('kagopita-language') || 'ja';
document.documentElement.lang = savedLanguage;
applyLanguage(savedLanguage);

async function api(url, options = {}) {
  return window.KagopitaActions.request(async signal => {
    let response;
    try {
      response = await fetch(url, { ...options, signal });
    } catch (error) {
      if (error instanceof TypeError) {
        throw new Error('サーバーに接続できません。サーバーが起動しているか、表示中のURLとポートをご確認ください。');
      }
      throw error;
    }

    signal.throwIfAborted();
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      signal.throwIfAborted();
      if (response.status === 401 && currentUser) {
        resetSignedOutState();
        $('noChannels').classList.remove('hidden');
        $('noChannelsTitle').textContent = translateFeature('ログイン');
        $('noChannelsMessage').textContent = data.error || '';
        $('noChannelsCreateButton').classList.add('hidden');
        showWelcomeMode('login');
      }
      const error = new Error(data.error || (response.status === 401
        ? '利用状態を確認できません。画面を更新するか、招待リンクから参加し直してください。'
        : `通信に失敗しました（応答番号：${response.status}）。`));
      error.status = response.status;
      if (data.code === 'TERMS_ACCEPTANCE_REQUIRED') await window.KagopitaTerms?.refresh();
      throw error;
    }
    const data = await response.json();
    signal.throwIfAborted();
    return data;
  }, { signal: options.signal });
}

async function acceptInviteFromUrl() {
  const invite = new URLSearchParams(window.location.hash.slice(1)).get('invite');
  if (!invite) return null;

  const dialog = $('joinDialog');
  const form = $('joinForm');
  const message = $('joinMessage');
  $('joinName').value = currentUser?.username || '';
  message.textContent = '';
  dialog.showModal();

  return new Promise(resolve => {
    const finish = channelId => {
      form.removeEventListener('submit', submit);
      $('cancelJoin').removeEventListener('click', cancel);
      if (dialog.open) dialog.close();
      resolve(channelId);
    };
    const cancel = () => {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
      finish(false);
    };
    const submit = async event => {
      event.preventDefault();
      if (form.dataset.termsSubmitting === 'true' || !window.KagopitaTerms.requireAcceptance('invite')) return;
      const button = form.querySelector('[type="submit"]');
      form.dataset.termsSubmitting = 'true';
      button.disabled = true;
      message.textContent = '';
      try {
        const result = await api('/api/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ invite, username: $('joinName').value.trim(), ...window.KagopitaTerms.acceptance('invite') })
        });
        window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
        finish(result.channelId);
      } catch (error) {
        message.textContent = error.message;
      } finally {
        delete form.dataset.termsSubmitting;
        window.KagopitaTerms.sync();
      }
    };
    form.addEventListener('submit', submit);
    $('cancelJoin').addEventListener('click', cancel);
joinDialog.addEventListener('click', event => {
  if (event.target === joinDialog) joinDialog.close();
});
  });
}

function channelUrl(endpoint) {
  return `/api/channels/${encodeURIComponent(currentChannelId)}${endpoint}`;
}

function updateChannelControls() {
  if (!currentUser) closeNavigationMenu();
  document.querySelector('.bottom-nav').classList.toggle('hidden', !currentUser);
  $('nav-list').disabled = !currentChannelId;
  $('nav-list').classList.toggle('hidden', !currentChannelId);
  document.querySelector('.bottom-nav-links').classList.toggle('without-list', !currentChannelId);
  $('nav-add').disabled = !currentChannelId || !canEditItems() || currentTab === 'add';
  $('nav-add').classList.toggle('hidden', !currentChannelId);
  document.querySelectorAll('[onclick="switchTab(\'add\')"]').forEach(button => { button.disabled = !canEditItems() || (button.id === 'nav-add' && currentTab === 'add'); });
  $('deletedItemsDetails').classList.toggle('hidden', !canEditItems());
  if (!canEditItems()) $('itemEditDialog').close();
  $('noChannels').classList.toggle('hidden', !currentUser || channels.length > 0 || ['channels', 'account'].includes(currentTab));
  $('channelViews').classList.toggle('hidden', !currentChannelId || ['channels', 'account'].includes(currentTab));
  $('nav-account').classList.toggle('hidden', !currentUser);
  $('nav-menu').classList.toggle('hidden', !currentUser);
  $('shareButton').classList.toggle('hidden', currentMemberRole !== 'owner');
  $('completeShoppingButton').classList.toggle('hidden', currentMemberRole !== 'owner');
  $('nav-complete').classList.toggle('hidden', currentMemberRole !== 'owner');
  $('menu-share').classList.toggle('hidden', currentMemberRole !== 'owner');
  renderNavigationShortcuts();
  renderJoinedChannels();
  const listName = channels.find(c => c.id === currentChannelId)?.name || 'なし';
  $('currentListName').textContent = '使用中: ' + listName;
  document.querySelector('.actions').classList.toggle('single-action', currentMemberRole !== 'owner');
  syncNavigationMenu();
  if (currentUser && !currentChannelId && ['list', 'add', 'members', 'complete'].includes(currentTab)) switchTab('channels');
  else if (currentTab === 'add' && !canEditItems()) switchTab('list');
  else if (currentTab === 'complete' && currentMemberRole !== 'owner') switchTab('list');
}

function resetSignedOutState() {
  window.KagopitaLiveUpdates.stop();
  window.KagopitaNotifications?.reset();
  window.KagopitaPush?.setUser(null);
  window.KagopitaPush?.clear();
  shoppingRenderState = '';
  ++channelSelectionVersion;
  currentUser = null;
  currentChannelId = null;
  currentMemberRole = null;
  channels = [];
  currentTab = 'list';
  updateChannelControls();
  $('view-account').classList.add('hidden');
  $('view-channels').classList.add('hidden');
}

let channelSelectionVersion = 0;
async function refreshChannels(preferredId = currentChannelId) {
  const version = ++channelSelectionVersion;
  const data = await api('/api/me');
  if (version !== channelSelectionVersion) return;
  currentUser = data.user;
  window.KagopitaPush?.setUser(currentUser.id);
  channels = data.channels;
  window.KagopitaNotifications?.refresh(currentUser.id);
  const selected = channels.find(channel => channel.id === preferredId && !channel.archivedAt) || channels.find(channel => !channel.archivedAt) || null;
  currentChannelId = selected?.id || null;
  currentMemberRole = selected?.role || null;
  updateChannelControls();
  if (currentChannelId) await loadShoppingList();
  else {
    shoppingRenderState = '';
    $('categoriesContainer').replaceChildren();
    $('familyFeedContainer').replaceChildren();
  }
  window.KagopitaLiveUpdates.start(async () => {
    if (!currentUser) return;
    await refreshChannels();
    if (!currentChannelId || document.querySelector('dialog[open]')) return;
    if (currentTab === 'members') await loadMembers();
    if (currentTab === 'add') await loadFavorites();
  }, data => {
    if (data.userId === currentUser?.id) KagopitaDialogs.notice('このリストから退出させられました。');
  });
}

async function selectChannel(channelId) {
  const selected = channels.find(channel => channel.id === channelId);
  if (!selected || selected.archivedAt) return;
  ++channelSelectionVersion;
  currentChannelId = selected.id;
  currentMemberRole = selected.role;
  currentTab = 'list';
  updateChannelControls();
  await switchTab('list');
}

let shoppingData = null;
let shoppingRequestId = 0;
let shoppingRenderState = '';
localizationReady = true;
let shoppingMembers = [];
let filterChannelId = null;
let editingItem = null;

function memberOption(member) {
  const option = new Option(member.username, member.id); option.dataset.i18nIgnore = 'true'; return option;
}
function fillAssignees(select, selected = '') {
  select.replaceChildren(new Option('未割り当て', ''));
  shoppingMembers.forEach(member => select.add(memberOption(member)));
  select.value = selected || '';
}

async function openItemEditor(item, category) {
  const channelId = currentChannelId;
  try {
    const { members } = await api(channelUrl('/members'));
    if (channelId !== currentChannelId) return;
    shoppingMembers = members;
    editingItem = { id: item.id, channelId };
    $('editName').value = item.name;
    $('editQty').value = item.qty;
    updateQuantityPreview('edit');
    $('editCategory').value = category;
    editCategoryManual = category !== KagopitaCategory.suggest(item.name);
    $('editNotes').value = item.notes || '';
    $('editPrice').value = item.price ?? '';
    $('editRecurrence').value = item.recurrence || 'none';
    $('editRecurrence').dispatchEvent(new Event('change', { bubbles: true }));
    $('editDetails').open = false;
    fillAssignees($('editAssignee'), item.assignedTo);
    $('editMessage').textContent = '';
    $('itemEditDialog').showModal();
  } catch (error) { KagopitaDialogs.notice(error.message); }
}

$('cancelItemEdit').onclick = () => $('itemEditDialog').close();
$('itemEditForm').addEventListener('submit', async event => {
  event.preventDefault();
  if (!editingItem || editingItem.channelId !== currentChannelId) {
    $('itemEditDialog').close(); return;
  }
  $('saveItemButton').disabled = true;
  try {
    await api(channelUrl(`/items/${editingItem.id}`), {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: $('editName').value.trim(), qty: KagopitaQuantity.format($('editName').value, $('editQty').value),
        category: $('editCategory').value.trim(), assignedTo: $('editAssignee').value || null, ...itemExtras('edit') })
    });
    $('itemEditDialog').close();
    await loadShoppingList();
  } catch (error) { $('editMessage').textContent = error.message; }
  finally { $('saveItemButton').disabled = false; }
});
['itemSearch', 'categoryFilter', 'assignmentFilter'].forEach(id => {
  $(id).addEventListener(id === 'itemSearch' ? 'input' : 'change', () => {
    if (shoppingData) renderShoppingList(shoppingData);
  });
});

$('clearFilters').addEventListener('click', () => {
  $('itemSearch').value = ''; $('categoryFilter').value = ''; $('assignmentFilter').value = '';
  if (shoppingData) renderShoppingList(shoppingData);
});

async function loadShoppingList() {
  if (!currentChannelId) return false;
  const requestId = ++shoppingRequestId;
  const channelId = currentChannelId;
  try {
    const [data, { members }] = await Promise.all([api(channelUrl('/shopping-list')), api(channelUrl('/members'))]);
    if (requestId !== shoppingRequestId || channelId !== currentChannelId) return false;
    const renderState = JSON.stringify([data, members, currentMemberRole]);
    if (filterChannelId === channelId && shoppingRenderState === renderState) return true;
    if (filterChannelId !== channelId) {
      $('itemSearch').value = ''; $('categoryFilter').value = ''; $('assignmentFilter').value = '';
      $('searchDetails').open = false;
      $('deletedItemsDetails').open = false;
      filterChannelId = channelId;
      $('itemEditDialog').close();
    }
    shoppingData = data; shoppingMembers = members;
    fillAssignees($('inputAssignee'), $('inputAssignee').value);
    const selectedCategory = $('categoryFilter').value;
    const names = [...new Set([...KagopitaCategory.categories, ...data.categories.map(c => c.name)])];
    $('categoryFilter').replaceChildren(new Option('すべてのカテゴリ', ''), ...names.map(name => { const option = new Option(name, name); option.dataset.shoppingCategory = name; option.dataset.i18nIgnore = 'true'; return option; }));
    $('categoryFilter').value = names.includes(selectedCategory) ? selectedCategory : '';
    $('categorySuggestions').replaceChildren(...names.map(name => { const option = new Option(name, name); option.dataset.shoppingCategory = name; option.dataset.i18nIgnore = 'true'; return option; }));
    const selectedAssignment = $('assignmentFilter').value;
    $('assignmentFilter').replaceChildren(new Option('すべての担当者', ''), new Option('自分の担当', 'mine'), new Option('未割り当て', 'unassigned'), ...members.map(memberOption));
    $('assignmentFilter').value = [...$('assignmentFilter').options].some(o => o.value === selectedAssignment) ? selectedAssignment : '';
    renderShoppingList(data);
    renderDeletedItems(data.deletedItems || []);
    shoppingRenderState = renderState;
    return true;
  } catch (error) {
    if (requestId !== shoppingRequestId || channelId !== currentChannelId) return false;
    shoppingRenderState = '';
    console.error(error);
    $('categoriesContainer').textContent = error.message;
    return false;
  }
}

function renderShoppingList(data) {
    const query = $('itemSearch').value.trim().normalize('NFKC').toLocaleLowerCase('ja');
    const categoryFilter = $('categoryFilter').value;
    const assignment = $('assignmentFilter').value;
    let visibleCount = 0;
    $('progressCount').textContent = `${data.completed}/${data.total}`;
    const container = $('categoriesContainer');
    container.replaceChildren();

    data.categories.forEach(category => {
      if (categoryFilter && category.name !== categoryFilter) return;
      const visibleItems = category.items.filter(item => {
        const matchesText = `${item.name} ${localItemName(item.name)} ${KagopitaShoppingLanguage.canonical(item.name)} ${category.name} ${localItemName(category.name)} ${(uiTranslations[shoppingLanguage()] || {})[category.name] || ''} ${item.assignedName || ''}`.normalize('NFKC').toLocaleLowerCase('ja').includes(query);
        const matchesAssignment = !assignment || (assignment === 'unassigned' ? !item.assignedTo : item.assignedTo === (assignment === 'mine' ? currentUser.id : assignment));
        return matchesText && matchesAssignment;
      });
      if (!visibleItems.length) return;
      visibleCount += visibleItems.length;
      const card = document.createElement('article');
      card.className = 'category-card';
      const title = document.createElement('h3');
      title.className = 'category-title';
      const titleText = document.createElement('span');
      titleText.textContent = (uiTranslations[shoppingLanguage()] || {})[category.name] || localItemName(category.name);
      titleText.dataset.i18nIgnore = 'true';
      const count = document.createElement('span');
      count.className = 'category-count';
      count.textContent = `${category.items.filter(item => item.completed).length}/${category.items.length}`;
      title.append(titleText, count);
      card.appendChild(title);

      visibleItems.forEach(item => {
        const row = document.createElement('div');
        row.className = 'shopping-item';
        const check = document.createElement('button');
        check.className = `check-button ${item.completed ? 'checked' : ''}`;
        check.setAttribute('aria-pressed', String(item.completed));
        check.innerHTML = item.completed ? '<i class="ph-bold ph-check"></i>' : '';
        check.setAttribute('aria-label', `${item.name}の完了状態を切り替え`);
        check.onclick = () => toggleItem(item.id);
        const info = document.createElement('div');
        info.className = 'item-info';
        const name = document.createElement('p');
        name.className = `item-name ${item.completed ? 'completed' : ''}`;
        const itemLabel = document.createElement('span');
        shoppingName(itemLabel, item.name);
        name.appendChild(itemLabel);
        const qty = document.createElement('span');
        qty.className = 'item-qty';
        shoppingQuantity(qty, item.name, item.qty, ' (', ')');
        name.appendChild(qty);
        const added = document.createElement('div');
        added.className = 'item-added';
        added.textContent = `追加: ${item.addedBy}`;
        const assignee = document.createElement('div');
        assignee.className = 'item-assignee';
        assignee.textContent = `担当: ${item.assignedName || '未割り当て'}`;
        const edit = document.createElement('button');
        edit.type = 'button'; edit.className = 'item-edit-button';
        edit.innerHTML = '<i class="ph-bold ph-pencil-simple" aria-hidden="true"></i>'; edit.title = '編集'; edit.setAttribute('aria-label', `${item.name}を編集`);
        edit.onclick = () => openItemEditor(item, category.name);
        const meta = document.createElement('div');
        meta.className = 'item-meta';
        meta.append(assignee, added);
        info.append(name, meta);
        if (item.notes) {
          const note = document.createElement('p'); note.className = 'item-note'; note.textContent = item.notes; note.dataset.i18nIgnore = 'true';
          info.append(note);
        }
        if (item.price != null || (item.recurrence && item.recurrence !== 'none')) {
          const detail = document.createElement('div'); detail.className = 'item-detail';
          const repeatLabel = ({daily:'毎日', weekly:'毎週', monthly:'毎月'})[item.recurrence];
          detail.textContent = [item.price != null ? new Intl.NumberFormat('ja-JP', {style:'currency',currency:'JPY'}).format(item.price) : '',
            repeatLabel ? '↻ ' + translateFeature(repeatLabel) : '',
            item.nextDueAt ? translateFeature('次回') + ': ' + new Date(item.nextDueAt).toLocaleDateString() : ''].filter(Boolean).join(' · ');
          info.append(detail);
        }
        const favorite = document.createElement('button');
        favorite.className = `favorite-toggle${item.isFavorite ? ' selected' : ''}`;
        favorite.type = 'button';
        favorite.innerHTML = `<i class="ph-${item.isFavorite ? 'fill' : 'bold'} ph-star"></i>`;
        favorite.setAttribute('aria-label', item.isFavorite
          ? `${item.name}をお気に入りから削除`
          : `${item.name}をお気に入りに追加`);
        favorite.title = item.isFavorite ? 'お気に入りから削除' : 'お気に入りに追加';
        favorite.onclick = () => toggleFavorite(item.id, item.isFavorite);
        const remove = document.createElement('button');
        remove.className = 'delete-button';
        remove.innerHTML = '<i class="ph-bold ph-trash"></i>';
        remove.setAttribute('aria-label', `${item.name}を削除`);
        remove.onclick = () => deleteItem(item.id);
        row.append(check, info);
        if (canEditItems()) row.append(edit, favorite, remove);
        card.appendChild(row);
      });
      container.appendChild(card);
    });

    if (!container.children.length) {
      const empty = document.createElement('div');
      empty.className = 'category-card empty-state';
      empty.textContent = data.total ? '条件に合う商品がありません。検索・絞り込みを変更してください。' : 'リストは空です。商品を追加しましょう！';
      container.appendChild(empty);
    }
    $('filterCount').textContent = `${data.total}件中 ${visibleCount}件を表示`;
    $('clearFilters').classList.toggle('hidden', !query && !categoryFilter && !assignment);
    $('filterDetails').classList.toggle('has-filters', Boolean(categoryFilter || assignment));
    renderFamilyFeed(data.familyFeed);
}

async function loadFavorites() {
  if (!currentChannelId) return;
  const channelId = currentChannelId;
  const requestId = ++favoritesRequestId;
  const container = $('favoritesContainer');
  try {
    const { favorites } = await api(`/api/channels/${encodeURIComponent(channelId)}/favorites`);
    if (requestId !== favoritesRequestId || channelId !== currentChannelId) return;
    container.replaceChildren();
    if (!favorites.length) {
      const empty = document.createElement('p');
      empty.className = 'favorite-empty';
      empty.textContent = 'お気に入りはまだありません。';
      container.appendChild(empty);
      return;
    }

    favorites.forEach(favorite => {
      const row = document.createElement('div');
      row.className = 'favorite-row';
      const details = document.createElement('div');
      details.className = 'favorite-details';
      const name = document.createElement('strong');
      name.className = 'favorite-name';
      shoppingName(name, favorite.name);
      const meta = document.createElement('span');
      meta.className = 'favorite-meta';
      const aisle = document.createElement('span');
      aisle.textContent = (uiTranslations[shoppingLanguage()] || {})[favorite.category] || localItemName(favorite.category);
      aisle.dataset.i18nIgnore = 'true'; aisle.dataset.shoppingCategory = favorite.category;
      const quantity = document.createElement('span'); shoppingQuantity(quantity, favorite.name, favorite.qty, ' · ');
      meta.append(aisle, quantity);
      details.append(name, meta);

      const add = document.createElement('button');
      add.className = 'favorite-add-button';
      add.type = 'button';
      add.innerHTML = '<i class="ph-bold ph-plus"></i> 追加';
      add.addEventListener('click', async () => {
        add.disabled = true;
        try {
          await api(channelUrl(`/favorites/${favorite.id}/add`), { method: 'POST' });
          await loadShoppingList();
        } catch (error) {
          KagopitaDialogs.notice(error.message);
        } finally {
          add.disabled = false;
        }
      });

      const remove = document.createElement('button');
      remove.className = 'favorite-remove-button';
      remove.type = 'button';
      remove.innerHTML = '<i class="ph-bold ph-trash"></i>';
      remove.setAttribute('aria-label', `${favorite.name}をお気に入りから削除`);
      remove.title = 'お気に入りから削除';
      remove.addEventListener('click', async () => {
        remove.disabled = true;
        try {
          await api(channelUrl(`/favorites/${favorite.id}`), { method: 'DELETE' });
          await loadFavorites();
          await loadShoppingList();
        } catch (error) {
          KagopitaDialogs.notice(error.message);
        } finally {
          remove.disabled = false;
        }
      });

      row.append(details, add, remove);
      container.appendChild(row);
    });
  } catch (error) {
    if (requestId !== favoritesRequestId || channelId !== currentChannelId) return;
    container.replaceChildren();
    const message = document.createElement('p');
    message.className = 'favorite-empty';
    message.textContent = error.message;
    container.appendChild(message);
  }
}

async function toggleFavorite(itemId, isFavorite) {
  try {
    await api(channelUrl(`/items/${itemId}/favorite`), {
      method: isFavorite ? 'DELETE' : 'PUT'
    });
    await loadShoppingList();
    if (currentTab === 'add') await loadFavorites();
  } catch (error) {
    KagopitaDialogs.notice(error.message);
  }
}

let historyPage = 1;
const historyPageSize = 10;
let historyChannelId = null;
let historyPeopleKey = '';
function resetHistoryFilters() {
  $('historySearch').value = '';
  ['historyAction', 'historyPerson', 'historyPeriod'].forEach(id => { $(id).value = ''; });
  historyPage = 1;
}
['historySearch', 'historyAction', 'historyPerson', 'historyPeriod'].forEach(id => {
  $(id).addEventListener(id === 'historySearch' ? 'input' : 'change', () => {
    historyPage = 1;
    renderFamilyFeed(shoppingData?.familyFeed || []);
  });
});
$('historyClear').addEventListener('click', () => {
  resetHistoryFilters(); renderFamilyFeed(shoppingData?.familyFeed || []);
});
function moveHistoryPage(change) {
  historyPage += change;
  renderFamilyFeed(shoppingData?.familyFeed || []);
  $('historyCount').scrollIntoView({block: 'nearest'});
}
$('historyPrevious').addEventListener('click', () => moveHistoryPage(-1));
$('historyNext').addEventListener('click', () => moveHistoryPage(1));
function renderFamilyFeed(feed = []) {
  if (historyChannelId !== currentChannelId) {
    historyChannelId = currentChannelId; historyPeopleKey = '';
    resetHistoryFilters(); $('historyDetails').open = false;
  }
  const people = [...new Set(feed.map(entry => entry.name))].sort((a,b) => a.localeCompare(b));
  const peopleKey = JSON.stringify(people);
  if (historyPeopleKey !== peopleKey) {
    const selected = $('historyPerson').value;
    $('historyPerson').replaceChildren(new Option('すべてのメンバー',''), ...people.map(name => {
      const option = new Option(name,name); option.dataset.i18nIgnore = 'true'; return option;
    }));
    $('historyPerson').value = people.includes(selected) ? selected : '';
    historyPeopleKey = peopleKey;
  }
  const query = $('historySearch').value.trim().toLocaleLowerCase();
  const action = $('historyAction').value;
  const person = $('historyPerson').value;
  const period = $('historyPeriod').value;
  const since = new Date(); since.setHours(0,0,0,0);
  if (period && period !== 'today') since.setDate(since.getDate() - Number(period) + 1);
  const itemActions = ['added','edited','completed','uncompleted','deleted','restored','recurring'];
  const matching = feed.filter(entry =>
    (!query || `${entry.name} ${entry.item || ''} ${localItemName(entry.item || '')}`.toLocaleLowerCase().includes(query)) &&
    (!action || (action === 'members' ? !itemActions.includes(entry.action) : entry.action === action)) &&
    (!person || entry.name === person) && (!period || new Date(entry.createdAt) >= since)
  ).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
  const pageCount = Math.max(1, Math.ceil(matching.length / historyPageSize));
  historyPage = Math.max(1, Math.min(historyPage, pageCount));
  const start = (historyPage - 1) * historyPageSize;
  const language = localStorage.getItem('kagopita-language') || 'ja';
  const from = matching.length ? start + 1 : 0, to = Math.min(start + historyPageSize, matching.length);
  $('historyCount').textContent = ({
    ja: `${matching.length}件中 ${from}–${to}件を表示（新しい順）`,
    en: `${from}–${to} of ${matching.length} entries · Newest first`,
    ko: `${matching.length}개 중 ${from}–${to}개 · 최신순`,
    zh: `显示 ${from}–${to} / ${matching.length} 条 · 最新优先`,
    es: `${from}–${to} de ${matching.length} registros · Más recientes primero`
  })[language] || `${from}–${to} / ${matching.length}`;
  $('historyPage').textContent = `${historyPage} / ${pageCount}`;
  $('historyPrevious').disabled = historyPage === 1;
  $('historyNext').disabled = historyPage === pageCount;
  $('historyPagination').hidden = pageCount <= 1;
  $('historyClear').classList.toggle('hidden', !query && !action && !person && !period);
  const container = $('familyFeedContainer');
  container.replaceChildren();
  if (!matching.length) {
    const empty = document.createElement('p');
    empty.className = 'share-instructions';
    const language = localStorage.getItem('kagopita-language') || 'ja';
    if (feed.length) empty.textContent = ({ja:'条件に合う履歴がありません。',en:'No matching history.',ko:'일치하는 기록이 없습니다.',zh:'没有符合条件的记录。',es:'No hay registros coincidentes.'})[language];
    else empty.textContent = ({ en: 'Changes to members and the list will appear here.', ko: '멤버와 목록의 변경 사항이 여기에 표시됩니다.', zh: '成员和清单的变更会显示在这里。', es: 'Los cambios de miembros y de la lista aparecerán aquí.' }[language] || '参加者やリストの変更内容がここに表示されます。');
    container.appendChild(empty);
    return;
  }
  matching.slice(start, start + historyPageSize).forEach(entry => {
    const row = document.createElement('div');
    row.className = 'feed-item';
    const avatar = document.createElement('div');
    avatar.className = 'feed-avatar';
    avatar.textContent = entry.name.charAt(0);
    const content = document.createElement('div');
    content.className = 'feed-content';
    const actions = {
      created: 'リストを作成しました',
      joined: '共有リストに参加しました',
      added: `「${entry.item}」を追加しました`,
      edited: `「${entry.item}」を編集しました`,
      completed: `「${entry.item}」を完了にしました`,
      uncompleted: `「${entry.item}」を未完了に戻しました`,
      deleted: `「${entry.item}」を削除しました`,
      restored: `「${entry.item}」を復元しました`,
      recurring: `「${entry.item}」を繰り返しで未購入に戻しました`,
      archived: 'リストをアーカイブしました', unarchived: 'アーカイブを解除しました',
      kicked: `「${entry.item}」をリストから退出させました`,
      left: `「${entry.item}」から退出しました`,
      'role-changed': 'メンバーの権限を変更しました',
      renamed: `名前を変更しました (${entry.item})`
    };
    const language = localStorage.getItem('kagopita-language') || 'ja';
    const localizedActions = feedTranslations[language];
    const actionText = localizedActions
      ? (typeof localizedActions[entry.action] === 'function' ? localizedActions[entry.action](['added','edited','completed','uncompleted','deleted','restored','recurring'].includes(entry.action) ? localItemName(entry.item) : entry.item) : localizedActions[entry.action])
      : (actions[entry.action] || 'リストを更新しました');
    const description = document.createElement('div');
    description.textContent = `${entry.name}${language === 'ja' ? '：' : ': '}${actionText || localizedActions?.updated || actions[entry.action] || 'リストを更新しました'}`;
    const time = document.createElement('span');
    time.className = 'feed-time';
    time.textContent = new Date(entry.createdAt).toLocaleString(language);
    content.append(description, time);
    row.append(avatar, content);
    container.appendChild(row);
  });
}

async function toggleItem(id) {
  try {
    await api(channelUrl(`/items/${id}/toggle`), { method: 'PATCH' });
    await loadShoppingList();
  } catch (error) {
    KagopitaDialogs.notice(error.message);
  }
}

async function deleteItem(id) {
  try {
    await api(channelUrl(`/items/${id}`), { method: 'DELETE' });
    await loadShoppingList();
  } catch (error) {
    KagopitaDialogs.notice(error.message);
  }
}

const categoryPicker = $('categoryPicker');
const categoryPickerButton = $('categoryPickerButton');
const categoryOptions = $('categoryOptions');
// Reuse the compact picker; canonical values are independent of UI language.
KagopitaCategory.categories.forEach(category => {
  if ([...categoryOptions.children].some(option => option.dataset.value === category)) return;
  const option = document.createElement('button');
  option.type = 'button'; option.className = 'category-option';
  option.setAttribute('role', 'option'); option.setAttribute('aria-selected', 'false');
  option.tabIndex = -1; option.dataset.value = category;
  const label = document.createElement('span'); label.textContent = category;
  option.append(label); categoryOptions.append(option);
});
const categoryOptionButtons = [...categoryOptions.querySelectorAll('[role="option"]')];
let addCategoryManual = false;
let editCategoryManual = false;
function setAddCategory(category) {
  $('inputCategory').value = category;
  $('categoryPickerValue').textContent = category;
  categoryOptionButtons.forEach(button => {
    const selected = button.dataset.value === category;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-selected', String(selected));
  });
  const language = document.documentElement.lang || 'ja';
  window.KagopitaI18n.translate($('categoryPickerValue'), language, uiTranslations[language] || {});
}
function suggestAddCategory() {
  const name = $('inputName').value.trim();
  if (!name) addCategoryManual = false;
  if (!addCategoryManual && !$('customCategory').value.trim()) {
    setAddCategory(KagopitaCategory.suggest(name) || 'その他');
  }
}
$('inputName').addEventListener('input', suggestAddCategory);
$('customCategory').addEventListener('input', suggestAddCategory);
$('editCategory').addEventListener('input', () => { editCategoryManual = true; });
$('editName').addEventListener('input', () => {
  if (!editCategoryManual) $('editCategory').value = KagopitaCategory.suggest($('editName').value) || 'その他';
});

function closeCategoryPicker(restoreFocus = false) {
  categoryOptions.hidden = true;
  categoryPickerButton.setAttribute('aria-expanded', 'false');
  if (restoreFocus) categoryPickerButton.focus();
}

function selectCategory(option) {
  addCategoryManual = true;
  setAddCategory(option.dataset.value);
  closeCategoryPicker(true);
}

categoryPickerButton.addEventListener('click', () => {
  const isOpen = !categoryOptions.hidden;
  if (isOpen) {
    closeCategoryPicker();
    return;
  }
  categoryOptions.hidden = false;
  categoryPickerButton.setAttribute('aria-expanded', 'true');
  (categoryOptionButtons.find(option => option.getAttribute('aria-selected') === 'true') ||
    categoryOptionButtons[0]).focus();
});

categoryOptionButtons.forEach(option => {
  option.addEventListener('click', () => selectCategory(option));
});

categoryOptions.addEventListener('keydown', event => {
  const currentIndex = categoryOptionButtons.indexOf(document.activeElement);
  let nextIndex = currentIndex;
  if (event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % categoryOptionButtons.length;
  else if (event.key === 'ArrowUp') {
    nextIndex = (currentIndex - 1 + categoryOptionButtons.length) % categoryOptionButtons.length;
  } else if (event.key === 'Home') nextIndex = 0;
  else if (event.key === 'End') nextIndex = categoryOptionButtons.length - 1;
  else if (event.key === 'Escape') {
    event.preventDefault();
    closeCategoryPicker(true);
    return;
  } else {
    return;
  }
  event.preventDefault();
  categoryOptionButtons[nextIndex].focus();
});

document.addEventListener('focusin', event => {
  if (!categoryPicker.contains(event.target)) closeCategoryPicker();
});

document.addEventListener('click', event => {
  if (!categoryPicker.contains(event.target)) closeCategoryPicker();
});

function updateQuantityPreview(prefix) {
  const name = $(prefix + 'Name').value;
  const quantity = $(prefix + 'Qty').value;
  shoppingQuantity($(prefix + 'QtyPreview'), name, KagopitaQuantity.format(name, quantity), '→ ');
}
['input', 'edit'].forEach(prefix => {
  [prefix + 'Name', prefix + 'Qty'].forEach(id => $(id).addEventListener('input', () => updateQuantityPreview(prefix)));
  updateQuantityPreview(prefix);
});

$('addForm').addEventListener('submit', async event => {
  event.preventDefault();
  const name = $('inputName').value.trim();
  const category = $('customCategory').value.trim() || $('inputCategory').value;
  const qty = KagopitaQuantity.format(name, $('inputQty').value);
  const message = $('formMessage');
  if (!name) {
    message.textContent = '商品名を入力してください。';
    return;
  }
  try {
    await api(channelUrl('/items'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, category, qty, assignedTo: $('inputAssignee').value || null, ...itemExtras('input') })
    });
    $('inputName').value = '';
    $('customCategory').value = '';
    addCategoryManual = false;
    suggestAddCategory();
    $('inputQty').value = '1';
    $('inputNotes').value = ''; $('inputPrice').value = ''; $('inputRecurrence').value = 'none';
    $('inputRecurrence').dispatchEvent(new Event('change', {bubbles:true})); $('inputDetails').open = false;
    updateQuantityPreview('input');
    message.textContent = '商品を追加しました。';
    await loadShoppingList();
    switchTab('list');
  } catch (error) {
    message.textContent = error.message;
  }
});

async function handleResetList() {
  const url = channelUrl('/complete');
  await KagopitaDialogs.show({
    title: 'このリストを完了して削除しますか？',
    body: 'このリストと履歴を削除し、メンバー全員が退出します。他のリストやアカウントには影響しません。この操作は取り消せません。',
    confirmLabel: '完了して削除', danger: true,
    onConfirm: async () => { await api(url, { method: 'POST' }); await refreshChannels(null); }
  });
}

async function switchTab(tab) {
  if (!['list', 'add', 'members', 'complete', 'channels', 'account'].includes(tab)) return;
  if (tab === 'complete' && currentMemberRole !== 'owner') return;
  if (!currentUser) return;
  if (!currentChannelId && ['list', 'add', 'members', 'complete'].includes(tab)) return switchTab('channels');
  if (tab === 'add' && (!canEditItems() || currentTab === 'add')) return;
  const previousTab = currentTab;
  closeNavigationMenu();
  currentTab = tab;
  $('nav-add').disabled = !currentChannelId || !canEditItems() || tab === 'add';
  window.scrollTo({top: 0, behavior: 'instant'});
  $('channelViews').classList.toggle('hidden', !currentChannelId || ['channels', 'account'].includes(tab));
  $('noChannels').classList.toggle('hidden', !currentUser || channels.length > 0 || ['channels', 'account'].includes(tab));
  ['list', 'add', 'members', 'complete', 'channels', 'account'].forEach(name => {
    $(`view-${name}`).classList.toggle('hidden', name !== tab);
    const nav = $(`nav-${name}`);
    if (!nav) return;
    nav.classList.toggle('active', name === tab);
    if (name === tab) nav.setAttribute('aria-current', 'page');
    else nav.removeAttribute('aria-current');
    const icon = nav.querySelector('i');
    if (icon) {
      icon.className = name === tab && name !== 'add'
        ? icon.className.replace('ph-bold', 'ph-fill')
        : icon.className.replace('ph-fill', 'ph-bold');
    }
  });
  renderNavigationShortcuts();
  syncNavigationMenu();
  if (tab === 'account' && previousTab !== 'account') prepareAccountTab();
  if (tab === 'channels') { renderJoinedChannels(); $('createChannelMessage').textContent = ''; $('joinChannelMessage').textContent = ''; }
  const pending = [];
  if (tab === 'list' || tab === 'add') pending.push(loadShoppingList());
  if (tab === 'add') pending.push(loadFavorites());
  if (tab === 'members') pending.push(loadMembers());
  await Promise.all(pending);
  applyLanguage(localStorage.getItem('kagopita-language') || 'ja');
}

const shareDialog = $('shareDialog');
function makeInviteUrl(token) {
  return `${window.location.origin}${window.location.pathname}#invite=${encodeURIComponent(token)}`;
}

$('shareButton').addEventListener('click', async () => {
  const message = $('shareMessage');
  message.textContent = '';
  $('shareQr').replaceChildren();
  try {
    const { inviteCode } = await api(channelUrl('/invites'), { method: 'POST' });
    const shareUrl = makeInviteUrl(inviteCode);
    $('shareLink').value = shareUrl;
    new QRCode($('shareQr'), {
      text: shareUrl,
      width: 220,
      height: 220,
      colorDark: '#000000',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M
    });
  } catch (error) {
    console.error(error);
    message.textContent = error.message || '共有リンクを作成できませんでした。';
  }
  shareDialog.showModal();
});

$('copyShareLink').addEventListener('click', async () => {
  const link = $('shareLink');
  const message = $('shareMessage');
  try {
    await window.KagopitaActions.request(() => navigator.clipboard.writeText(link.value));
    message.textContent = '招待リンクをコピーしました。参加してほしい人に送ってください。';
  } catch (error) {
    console.error('招待リンクをコピーできませんでした。', error);
    link.focus();
    link.select();
    message.textContent = '自動コピーできませんでした。選択されたリンクをコピーしてください。';
  }
});
$('closeShareDialog').addEventListener('click', () => shareDialog.close());
shareDialog.addEventListener('click', event => {
  if (event.target === shareDialog) shareDialog.close();
});

$('emailInviteForm').addEventListener('submit', async event => {
  event.preventDefault();
  const button = event.currentTarget.querySelector('[type=\"submit\"]');
  const message = $('emailInviteMessage');
  button.disabled = true; message.textContent = '';
  try {
    await api(channelUrl('/email-invites'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: $('inviteEmail').value.trim() }) });
    message.textContent = '招待メールを送信しました。'; $('inviteEmail').value = '';
  } catch (error) { message.textContent = error.message; } finally { button.disabled = false; }
});

$('profileAvatar').addEventListener('change', () => { const file = $('profileAvatar').files[0]; if (!file) return; const image = document.createElement('img'); image.src = URL.createObjectURL(file); image.alt = '選択したプロフィール画像'; $('profileAvatarPreview').replaceChildren(image); });

function avatarElement(user, fallback) { const node = document.createElement('div'); node.className = 'feed-avatar'; if (user?.avatar) { const image = document.createElement('img'); image.src = user.avatar; image.alt = ''; node.appendChild(image); } else node.textContent = fallback || user?.username?.charAt(0) || '?'; return node; }

function updateAvatarAccess() {
  const allowed = Boolean(currentUser?.emailVerified);
  const input = $('profileAvatar');
  const button = document.querySelector('.avatar-picker-button');
  const avatarLabel = document.querySelector('label[for="profileAvatar"]');
  const picker = document.querySelector('.avatar-picker');
  if (avatarLabel) avatarLabel.classList.toggle('hidden', !allowed);
  if (picker) picker.classList.toggle('hidden', !allowed);
  if (input) input.disabled = !allowed;
  if (button) {
    button.classList.toggle('disabled', !allowed);
    button.setAttribute('aria-disabled', String(!allowed));
    button.title = allowed ? '' : 'メールアドレスを確認するとプロフィール画像を変更できます。';
  }
  if (!allowed && $('profileMessage')) $('profileMessage').textContent = '';
}

const profileDialog = $('profileDialog');
let profileInitialName = '';
let profileInitialAvatar = null;
function updateProfileSaveState() {
  const hasNewFile = Boolean($('profileAvatar').files[0]);
  const changedName = $('profileName').value.trim() !== profileInitialName;
  $('profileSaveButton').disabled = !hasNewFile && !changedName;
}

$('profileName').addEventListener('input', updateProfileSaveState);
$('profileAvatar').addEventListener('change', updateProfileSaveState);
async function readAvatarFile(file) {
  if (!file) return undefined;
  if (!file.type.match(/^image\/(jpeg|png|webp)$/)) throw new Error('JPG、PNG、WebP画像を選択してください。');
  const bitmap = await new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error('画像を読み込めませんでした。')); image.src = URL.createObjectURL(file); });
  const size = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 256;
  canvas.getContext('2d').drawImage(bitmap, (bitmap.width - size) / 2, (bitmap.height - size) / 2, size, size, 0, 0, 256, 256);
  return canvas.toDataURL('image/jpeg', 0.82);
}
let membersRequestId = 0, membersRefreshPending = false;
async function loadMembers() {
  const requestId = ++membersRequestId;
  const channelId = currentChannelId;
  const container = $('membersContainer');
  let members;
  try {
    ({ members } = await api(channelUrl('/members')));
    if (requestId !== membersRequestId || channelId !== currentChannelId) return;
  } catch (error) {
    if (requestId !== membersRequestId || channelId !== currentChannelId) return;
    container.replaceChildren();
    const message = document.createElement('p');
    message.className = 'share-message';
    message.textContent = error.message;
    container.appendChild(message);
    return;
  }

  // Do not replace a role picker while the user is interacting with it.
  const activePicker = container.querySelector('.custom-select.is-open');
  if (activePicker) {
    if (!membersRefreshPending) {
      membersRefreshPending = true;
      activePicker.addEventListener('kagopita:select-close', () => { membersRefreshPending = false; loadMembers(); }, {once:true});
    }
    return;
  }

  container.replaceChildren();
  members.forEach(member => {
    const row = document.createElement('div');
    row.className = 'feed-item member-row';
    const avatar = avatarElement(member);
    const content = document.createElement('div');
    content.className = 'feed-content';
    const memberName = document.createElement('span'); memberName.className = 'member-name'; memberName.textContent = member.username; content.appendChild(memberName);
    const role = document.createElement('span');
    role.className = 'member-role'; role.dataset.memberRole = member.role;
    role.textContent = translateFeature(memberRoleLabel(member.role));
    content.appendChild(role);
    row.append(avatar, content);
    if (['owner', 'admin'].includes(currentMemberRole) && member.id !== currentUser.id && member.role !== 'owner' && (currentMemberRole === 'owner' || member.role !== 'admin')) {
      row.classList.add('member-row-editable');
      const controls = document.createElement('div'); controls.className = 'member-role-controls';
      const select = document.createElement('select'); select.className = 'member-role-select';
      select.id = `member-role-${member.id}`;
      select.setAttribute('aria-label', `${member.username}: ${translateFeature('権限')}`);
      select.dataset.i18nIgnore = 'true';
      for (const value of (currentMemberRole === 'owner' ? ['member', 'editor', 'admin'] : ['member', 'editor'])) select.add(new Option(translateFeature(memberRoleLabel(value)), value));
      select.value = member.role;
      select.addEventListener('change', async () => {
        const selectedRole = select.value;
        const url = channelUrl(`/members/${encodeURIComponent(member.id)}/role`);
        select.disabled = true;
        const save = async () => {
          await api(url, { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({role: selectedRole}) });
          await refreshChannels(); await loadMembers();
        };
        try {
          await save();
        } catch (error) { KagopitaDialogs.notice(error.message); }
        finally { if (select.isConnected) { select.disabled = false; select.value = member.role; } }
      });
      controls.append(select); row.append(controls);
      const kick = document.createElement('button');
      kick.className = 'kick-button';
      kick.type = 'button';
      const kickIcon = document.createElement('i'); kickIcon.className = 'ph ph-user-minus'; kickIcon.setAttribute('aria-hidden', 'true');
      const kickLabel = document.createElement('span'); kickLabel.textContent = '退出させる';
      kick.append(kickIcon, kickLabel);
      kick.addEventListener('click', async () => {
        const url = channelUrl(`/members/${encodeURIComponent(member.id)}`);
        await KagopitaDialogs.show({
          title: 'メンバーを退出させますか？',
          body: '「{name}」をこのリストから退出させます。再び参加するには、新しい招待が必要です。',
          values: { name: member.username }, confirmLabel: '退出させる', danger: true,
          onConfirm: async () => { await api(url, { method: 'DELETE' }); await loadMembers(); }
        });
      });
      controls.appendChild(kick);
    }
    container.appendChild(row);
  });
  window.KagopitaSelects?.enhance(container);
}

function updateAccountStatus(language) {
  if (!currentUser) return;
  const labels = {ja: ['確認済み','未確認'], en: ['verified','unverified'], ko: ['확인됨','미확인'], zh: ['已验证','未验证'], es: ['verificado','sin verificar']};
  const hints = {
    ja: 'メールアドレスとパスワードを設定すると、別の端末からログインできます。',
    en: 'Set an email and password to sign in from another device.',
    ko: '이메일과 비밀번호를 설정하면 다른 기기에서 로그인할 수 있습니다.',
    zh: '设置邮箱和密码后即可从其他设备登录。',
    es: 'Configura un correo y una contraseña para iniciar sesión desde otro dispositivo.'
  };
  const status = (labels[language] || labels.ja)[currentUser.emailVerified ? 0 : 1];
  $('accountStatus').textContent = currentUser.email ? `${currentUser.email} (${status})` : hints[language] || hints.ja;
}
function prepareAccountTab() {
  if (!currentUser) return;
  closeNavigationMenu();
  $('profileName').value = currentUser.username;
  profileInitialName = currentUser.username;
  profileInitialAvatar = currentUser.avatar || null;
  $('profileSaveButton').disabled = true;
  const preview = $('profileAvatarPreview');
  preview.replaceChildren();
  if (currentUser.avatar) {
    const image = document.createElement('img');
    image.src = currentUser.avatar;
    image.alt = '現在のプロフィール画像';
    preview.appendChild(image);
  } else {
    const icon = document.createElement('i');
    icon.className = 'ph-bold ph-camera';
    preview.appendChild(icon);
  }
  $('profileAvatar').value = '';
  updateAvatarAccess();
  applyLanguage(localStorage.getItem('kagopita-language') || 'ja');
  $('profileMessage').textContent = '';
  $('accountPassword').value = '';
  $('accountVerificationCode').value = '';
  $('credentialsMessage').textContent = '';
  $('accountVerificationMessage').textContent = '';
  const hasEmail = Boolean(currentUser.email);
  updateAccountStatus(localStorage.getItem('kagopita-language') || 'ja');
  $('credentialsForm').classList.toggle('hidden', hasEmail);
  $('changeEmailForm').classList.add('hidden');
  $('changePasswordForm').classList.add('hidden');
  $('toggleChangeEmail').classList.toggle('hidden', !hasEmail || !currentUser.emailVerified);
  $('toggleChangePassword').classList.toggle('hidden', !hasEmail || !currentUser.emailVerified);
  $('toggleChangeEmail').setAttribute('aria-expanded', 'false');
  $('toggleChangePassword').setAttribute('aria-expanded', 'false');
  $('deleteAccountButton').classList.toggle('hidden', !hasEmail || !currentUser.emailVerified);
  $('accountVerificationForm').classList.toggle('hidden', !hasEmail || currentUser.emailVerified);
  $('resendAccountVerification').classList.toggle('hidden', !hasEmail || currentUser.emailVerified);
}
$('nav-account').addEventListener('click', () => switchTab('account'));
$('languageSelect').addEventListener('click', () => {
  const options = $('languageOptions');
  const open = options.classList.toggle('hidden');
  $('languageSelect').setAttribute('aria-expanded', String(!open));
});
$('languageOptions').querySelectorAll('[data-language]').forEach(option => option.addEventListener('click', event => {
  applyLanguage(event.currentTarget.dataset.language);
  $('languageOptions').classList.add('hidden');
  $('languageSelect').setAttribute('aria-expanded', 'false');
}));
document.addEventListener('click', event => {
  if (!event.target.closest('.language-menu')) {
    $('languageOptions').classList.add('hidden');
    $('languageSelect').setAttribute('aria-expanded', 'false');
  }
});

$('profileForm').addEventListener('submit', async event => {
  event.preventDefault();
  const message = $('profileMessage');
  const button = event.currentTarget.querySelector('[type="submit"]');
  button.disabled = true;
  try {
    const avatar = await window.KagopitaActions.request(() => readAvatarFile($('profileAvatar').files[0]));
    const { username, avatar: savedAvatar } = await api('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: $('profileName').value.trim(), ...(avatar !== undefined ? { avatar } : {}) })
    });
    currentUser.username = username;
    currentUser.avatar = savedAvatar;
    switchTab('list');
    await loadShoppingList();
  } catch (error) {
    message.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

$('credentialsForm').addEventListener('submit', async event => {
  event.preventDefault();
  const button = event.currentTarget.querySelector('[type="submit"]');
  const message = $('credentialsMessage');
  if (!window.KagopitaTerms.requireAcceptance('credentials')) return;
  $('credentialsForm').dataset.termsSubmitting = 'true';
  button.disabled = true;
  message.textContent = '';
  try {
    const { email, emailVerified } = await api('/api/account/credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: $('accountEmail').value.trim(),
        password: $('accountPassword').value,
        ...window.KagopitaTerms.acceptance('credentials')
      })
    });
    currentUser.email = email;
    currentUser.emailVerified = emailVerified;
    $('accountStatus').textContent = `${email}（未確認）`;
    $('accountVerificationMessage').textContent = '確認メールを送信しました。メールに記載された6桁のコードを入力してください。';
    $('accountPassword').value = '';
    $('accountVerificationCode').value = '';
    $('credentialsForm').classList.add('hidden');
    $('accountVerificationForm').classList.remove('hidden');
    $('resendAccountVerification').classList.remove('hidden');
    requestAnimationFrame(() => $('accountVerificationCode').focus());
  } catch (error) {
    message.textContent = error.message;
  } finally {
    delete $('credentialsForm').dataset.termsSubmitting;
    window.KagopitaTerms.sync();
  }
});

function toggleAccountAction(buttonId, formId) {
  const button = $(buttonId);
  const form = $(formId);
  button.addEventListener('click', () => {
    const open = form.classList.toggle('hidden');
    button.setAttribute('aria-expanded', String(!open));
  });
}

toggleAccountAction('toggleChangeEmail', 'changeEmailForm');
toggleAccountAction('toggleChangePassword', 'changePasswordForm');

$('changePasswordForm').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('[type="submit"]');
  const message = $('changePasswordMessage');
  button.disabled = true;
  message.textContent = '';
  try {
    await api('/api/account/password', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: $('currentPassword').value, newPassword: $('newPassword').value })
    });
    $('currentPassword').value = '';
    $('newPassword').value = '';
    message.textContent = 'パスワードを変更しました。';
  } catch (error) {
    message.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

$('changeEmailForm').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('[type="submit"]');
  const message = $('changeEmailMessage');
  button.disabled = true;
  message.textContent = '';
  try {
    const { email, emailVerified } = await api('/api/account/email', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: $('changeEmail').value.trim(), password: $('changeEmailPassword').value })
    });
    currentUser.email = email;
    currentUser.emailVerified = emailVerified;
    $('changeEmail').value = '';
    $('changeEmailPassword').value = '';
    $('accountStatus').textContent = `${email}（未確認）`;
    message.textContent = '確認メールを送信しました。';
    $('changeEmailForm').classList.add('hidden');
    $('changePasswordForm').classList.add('hidden');
    $('accountVerificationForm').classList.remove('hidden');
  } catch (error) {
    message.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

$('deleteAccountButton').addEventListener('click', () => KagopitaDialogs.show({
  title: 'アカウントを削除しますか？',
  body: 'この操作は取り消せません。アカウントと関連するデータが削除されます。',
  confirmLabel: 'アカウントを削除', danger: true,
  onConfirm: async () => { await api('/api/account', { method: 'DELETE' }); window.location.reload(); }
}));

$('accountVerificationForm').addEventListener('submit', async event => {
  event.preventDefault();
  const button = event.currentTarget.querySelector('[type="submit"]');
  button.disabled = true;
  $('accountVerificationMessage').textContent = '';
  try {
    await api('/api/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: currentUser.email,
        code: $('accountVerificationCode').value.trim()
      })
    });
    currentUser.emailVerified = true;
    updateAvatarAccess();
    $('accountStatus').textContent = `${currentUser.email}（確認済み）`;
    $('accountVerificationMessage').textContent = 'メールアドレスを確認しました。';
    $('accountVerificationForm').classList.add('hidden');
    $('resendAccountVerification').classList.add('hidden');
  } catch (error) {
    $('accountVerificationMessage').textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

$('accountVerificationCode').addEventListener('input', event => {
  event.currentTarget.value = event.currentTarget.value.replace(/\D/g, '').slice(0, 6);
});

$('resendAccountVerification').addEventListener('click', async event => {
  const button = event.currentTarget;
  button.disabled = true;
  $('accountVerificationMessage').textContent = '';
  try {
    const result = await api('/api/resend-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: currentUser.email })
    });
    $('accountVerificationMessage').textContent = '対象アカウントがある場合、新しい確認コードを送信します。';
  } catch (error) {
    $('accountVerificationMessage').textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

$('logoutButton').addEventListener('click', async event => {
  const button = event.currentTarget;
  button.disabled = true;
  $('accountStatus').textContent = '';
  try {
    await api('/api/logout', { method: 'POST' });
    await window.KagopitaPush?.clear();
    window.location.reload();
  } catch (error) {
    $('accountStatus').textContent = error.message;
    button.disabled = false;
  }
});


$('closeProfileDialog').addEventListener('click', () => switchTab('list'));
$('leaveGroup').addEventListener('click', () => {
  const url = channelUrl('/membership');
  return KagopitaDialogs.show({
    title: 'リストから退出しますか？',
    body: currentMemberRole === 'owner' ? '作成者が退出すると、このリストと商品・履歴が完全に削除され、全員が退出します。この操作は取り消せません。' : '退出すると、このリストが参加中のリストから削除されます。他のメンバーは引き続き利用できます。',
    confirmLabel: '退出する', danger: true,
    onConfirm: async () => { await api(url, { method: 'DELETE' }); await refreshChannels(null); }
  });
});

const channelsDialog = $('channelsDialog');
function translateFeature(text) { return (uiTranslations[document.documentElement.lang] || {})[text] || text; }
function itemExtras(prefix) {
  return { notes: $(prefix + 'Notes').value.trim(), price: $(prefix + 'Price').value === '' ? null : Number($(prefix + 'Price').value), recurrence: $(prefix + 'Recurrence').value };
}
function renderDeletedItems(items) {
  const container = $('deletedItemsList'); container.replaceChildren();
  if (!items.length) { const empty=document.createElement('p'); empty.textContent=translateFeature('削除した商品はありません。'); container.append(empty); }
  for (const item of items) {
    const row=document.createElement('div'); row.className='deleted-item-row';
    const name=document.createElement('span'); const label=document.createElement('span'); shoppingName(label,item.name); const quantity=document.createElement('span'); shoppingQuantity(quantity,item.name,item.qty,' (',')'); name.append(label,quantity);
    const restore=document.createElement('button'); restore.type='button'; restore.className='text-button'; restore.textContent=translateFeature('復元');
    restore.setAttribute('aria-label', `${item.name}: ${translateFeature('復元')}`);
    restore.onclick=async()=>{restore.disabled=true; try {await api(channelUrl(`/items/${item.id}/restore`),{method:'POST'});await loadShoppingList();}catch(error){KagopitaDialogs.notice(error.message);restore.disabled=false;}};
    row.append(name,restore);container.append(row);
  }
}
function renderJoinedChannels() {
  const section = $('joinedChannelsSection');
  const list = $('joinedChannelsList'), archived = $('archivedChannelsList');
  list.replaceChildren(); archived.replaceChildren();
  section.classList.toggle('hidden', channels.length === 0);
  $('archivedListsDetails').classList.toggle('hidden', !channels.some(channel=>channel.archivedAt));
  for (const channel of channels) {
    const row=document.createElement('div'); row.className='managed-list-row' + (channel.id === currentChannelId ? ' is-current' : '') + (channel.archivedAt ? ' is-archived' : '');
    const button = document.createElement(channel.archivedAt ? 'div' : 'button');
    if (!channel.archivedAt) button.type='button';
    button.className = `joined-channel-button${channel.id === currentChannelId ? ' selected' : ''}`;
    button.setAttribute('aria-current', channel.id === currentChannelId ? 'true' : 'false');
    const name=document.createElement('span'); name.className='joined-channel-name'; name.textContent=channel.name; name.dataset.i18nIgnore='true';
    const role=document.createElement('span');role.className='joined-channel-role';
    role.textContent=translateFeature(channel.archivedAt ? 'アーカイブ済み' : channel.id===currentChannelId ? '✓ 使用中' : memberRoleLabel(channel.role));
    const icon=document.createElement('span');icon.className='managed-list-icon';icon.setAttribute('aria-hidden','true');
    icon.innerHTML='<i class="ph-bold '+(channel.archivedAt?'ph-archive':'ph-shopping-bag')+'"></i>';
    button.append(icon,name,role);
    if (!channel.archivedAt && channel.id !== currentChannelId) { const arrow=document.createElement('i');arrow.className='ph-bold ph-caret-right managed-list-arrow';arrow.setAttribute('aria-hidden','true');button.append(arrow); }
    if (!channel.archivedAt) button.onclick=()=>selectChannel(channel.id);
    const actions=document.createElement('div');actions.className='list-management-actions';
    const action=(label,handler)=>{const b=document.createElement('button');b.type='button';b.className='text-button';
      const icon=document.createElement('i');icon.className='ph-bold '+(label==='複製'?'ph-copy':label==='アーカイブ'?'ph-archive':'ph-arrow-u-up-left');icon.setAttribute('aria-hidden','true');
      const text=document.createElement('span');text.textContent=translateFeature(label);b.append(icon,text);
      b.setAttribute('aria-label',`${translateFeature(label)}: ${channel.name}`);b.onclick=async()=>{b.disabled=true;try{await handler();}catch(error){$('listManagementMessage').textContent=error.message;b.disabled=false;}};actions.append(b);};
    action('複製',async()=>{
      const result=await api(`/api/channels/${encodeURIComponent(channel.id)}/duplicate`,{method:'POST'});
      await refreshChannels(result.id);switchTab('list');
    });
    if (channel.role==='owner') action(channel.archivedAt ? 'アーカイブを解除' : 'アーカイブ',async()=>{
      await api(`/api/channels/${encodeURIComponent(channel.id)}/archive`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({archived:!channel.archivedAt})});
      await refreshChannels(channel.archivedAt ? channel.id : currentChannelId);
    });
    row.append(button,actions);(channel.archivedAt ? archived:list).append(row);
  }
}

function openChannelsDialog() { return switchTab('channels'); }

const shortcutChoices = {
  channels: ['共有リスト', 'ph-folders'], members: ['メンバー', 'ph-users-three'],
  account: ['アカウント', 'ph-user-circle'], favorites: ['お気に入り', 'ph-star'],
  share: ['共有', 'ph-share-network'], complete: ['完了', 'ph-check-circle']
};
const defaultShortcuts = ['channels', 'members'];
function getShortcuts() {
  try {
    const saved = JSON.parse(localStorage.getItem('kagopita-shortcuts'));
    if (Array.isArray(saved) && saved.length === 2 && saved.every(key => shortcutChoices[key])) return saved;
  } catch (_) {}
  return [...defaultShortcuts];
}
function renderNavigationShortcuts() {
  getShortcuts().forEach((key, index) => {
    const button = $(index ? 'shortcut-right' : 'shortcut-left');
    const [label, icon] = shortcutChoices[key];
    button.innerHTML = `<i class="ph-bold ${icon}" aria-hidden="true"></i><span>${label}</span>`;
    button.disabled = (['complete', 'share'].includes(key) && currentMemberRole !== 'owner') || (key === 'account' && !currentUser) || (['add', 'favorites'].includes(key) && !canEditItems());
    button.classList.toggle('hidden', key === 'members' && !currentChannelId);
    button.classList.toggle('active', key === currentTab);
    if (key === currentTab) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
    button.dataset.navigationAction = key;
    button.onclick = () => runNavigationAction(key);
  });
}
function runNavigationAction(key) {
  closeNavigationMenu();
  if (!currentUser) return;
  if (key === 'channels') return openChannelsDialog();
  if (key === 'account') return $('nav-account').click();
  if (key === 'share') return $('shareButton').click();
  if (key === 'favorites') return switchTab('add').then(() => { $('favoritesContainer').scrollIntoView({block: 'center'}); });
  return switchTab(key);
}
function syncNavigationMenu() {
  $('navigationDialog').querySelectorAll('[data-menu-tab]').forEach(button => {
    const selected = button.dataset.menuTab === currentTab;
    button.classList.toggle('hidden', !currentChannelId && ['list', 'members'].includes(button.dataset.menuTab));
    button.disabled = selected || (button.dataset.menuTab === 'complete' && currentMemberRole !== 'owner') || (button.dataset.menuTab === 'add' && !canEditItems());
    if (selected) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
}
function openNavigationMenu() {
  if (!currentUser) return closeNavigationMenu();
  const menu = $('navigationDialog');
  if (menu.classList.contains('is-open')) return closeNavigationMenu();
  window.KagopitaNotifications?.close();
  syncNavigationMenu();
  menu.scrollTop = 0;
  menu.inert = false; menu.classList.add('is-open'); menu.setAttribute('aria-hidden', 'false');
  $('nav-menu').setAttribute('aria-expanded', 'true');
  applyLanguage(localStorage.getItem('kagopita-language') || 'ja');
  menu.querySelector('.menu-actions button:not(.hidden):not(:disabled)')?.focus({preventScroll: true});
}
function closeNavigationMenu(restoreFocus = false) {
  const menu = $('navigationDialog');
  menu.classList.remove('is-open'); menu.inert = true; menu.setAttribute('aria-hidden', 'true');
  $('nav-menu').setAttribute('aria-expanded', 'false');
  if (restoreFocus) $('nav-menu').focus();
}
document.addEventListener('pointerdown', event => {
  if (!event.target.closest('#navigationDialog, #nav-menu')) closeNavigationMenu();
});
document.addEventListener('focusin', event => {
  if ($('navigationDialog').classList.contains('is-open') && !event.target.closest('#navigationDialog, #nav-menu')) closeNavigationMenu();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !event.defaultPrevented && $('navigationDialog').classList.contains('is-open')) {
    event.preventDefault(); closeNavigationMenu(true);
  }
});
new ResizeObserver(() => document.documentElement.style.setProperty('--header-bottom', document.querySelector('.header').getBoundingClientRect().bottom + 'px')).observe(document.querySelector('.header'));


$('showChannelsButton').addEventListener('click', openChannelsDialog);


function selectListAccess(mode, focusTab = false) {
  document.querySelectorAll('[data-list-access]').forEach(tab => {
    const selected = tab.dataset.listAccess === mode;
    tab.setAttribute('aria-selected', String(selected)); tab.tabIndex = selected ? 0 : -1;
    if (selected && focusTab) tab.focus();
  });
  $('createChannelForm').classList.toggle('hidden', mode !== 'create');
  $('joinChannelForm').classList.toggle('hidden', mode !== 'join');
}
document.querySelectorAll('[data-list-access]').forEach(tab => {
  tab.addEventListener('click', () => selectListAccess(tab.dataset.listAccess));
  tab.addEventListener('keydown', event => {
    if (['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) {
      event.preventDefault();
      const mode = event.key === 'Home' ? 'create' : event.key === 'End' ? 'join' : tab.dataset.listAccess === 'create' ? 'join' : 'create';
      selectListAccess(mode, true);
    }
  });
});

$('createChannelForm').addEventListener('submit', async event => {
  event.preventDefault();
  const message = $('createChannelMessage');
  try {
    const created = await api('/api/channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: $('channelName').value.trim() })
    });
    $('channelName').value = '';

    await refreshChannels(created.id);
    await switchTab('list');
  } catch (error) {
    message.textContent = error.message;
  }
});

$('joinChannelForm').addEventListener('submit', async event => {
  event.preventDefault();
  const message = $('joinChannelMessage');
  try {
    const result = await api('/api/invites/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invite: $('channelInvite').value.trim() })
    });
    $('channelInvite').value = '';

    await refreshChannels(result.channelId);
    await switchTab('list');
  } catch (error) {
    message.textContent = error.message;
  }
});

$('noChannelsCreateButton').addEventListener('click', openChannelsDialog);

function showWelcomeMode(mode) {
  const tabMode = ['join', 'guest', 'account'].includes(mode)
    ? mode
    : ['login', 'register'].includes(mode) ? 'account' : null;
  // Keep the account mode tabs visible while switching between register and login.
  const showModeTabs = mode === 'choice' || tabMode !== null || mode === 'login';
  $('welcomeModeTabs').classList.toggle('hidden', !showModeTabs);
  const modeIndex = { join: 0, guest: 1, account: 2 }[tabMode];
  if (modeIndex !== undefined) $('welcomeModeTabs').style.setProperty('--welcome-mode-index', modeIndex);
  document.querySelectorAll('[data-welcome-mode]').forEach(button => {
    const selected = button.dataset.welcomeMode === tabMode;
    button.setAttribute('aria-pressed', String(selected));
    button.disabled = selected;
  });
  $('welcomeAccountForm').classList.toggle('hidden', mode !== 'guest');
  $('welcomeAuthActions').classList.add('hidden');
  $('welcomeJoinForm').classList.toggle('hidden', mode !== 'join');
  $('welcomeRegisterForm').classList.toggle('hidden', !['account', 'register'].includes(mode));
  $('welcomeVerifyForm').classList.toggle('hidden', mode !== 'verify');
  $('welcomeLoginForm').classList.toggle('hidden', mode !== 'login');
  $('passwordResetRequestForm').classList.toggle('hidden', mode !== 'reset');
  $('passwordResetCompleteForm').classList.toggle('hidden', mode !== 'resetComplete');
  const activeForm = document.querySelector('#noChannels form:not(.hidden), #noChannels .welcome-auth-actions:not(.hidden)');
  if (activeForm) { activeForm.classList.remove('welcome-form-slide'); void activeForm.offsetWidth; activeForm.classList.add('welcome-form-slide'); }
  if (mode === 'verify') requestAnimationFrame(() => $('welcomeVerifyCode').focus());
}

$('welcomeModeTabs').querySelectorAll('[data-welcome-mode]').forEach(button => {
  button.addEventListener('click', () => {
    if (!button.disabled) showWelcomeMode(button.dataset.welcomeMode);
  });
});
$('showWelcomeRegister').addEventListener('click', () => showWelcomeMode('register'));
$('showWelcomeLogin').addEventListener('click', () => showWelcomeMode('login'));
$('welcomeRegisterLogin').addEventListener('click', () => showWelcomeMode('login'));
$('showPasswordReset').addEventListener('click', () => showWelcomeMode('reset'));
$('backToWelcomeLogin').addEventListener('click', () => showWelcomeMode('login'));
$('passwordResetRequestForm').addEventListener('submit', async event => {
  event.preventDefault();
  const email = $('passwordResetEmail').value.trim();
  const message = $('passwordResetMessage');
  message.textContent = '';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    message.textContent = '有効なメールアドレスを入力してください。';
    $('passwordResetEmail').classList.add('field-error');
    return;
  }
  try {
    const result = await api('/api/password-reset/request', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email })
    });
    message.textContent = result.message;
  } catch (error) {
    message.textContent = error.message;
  }
});
$('passwordResetCompleteForm').addEventListener('submit', async event => {
  event.preventDefault();
  const message = $('passwordResetCompleteMessage');
  const password = $('passwordResetNewPassword').value;
  if (password.length < 8) {
    message.textContent = 'パスワードは8文字以上で入力してください。';
    return;
  }
  try {
    await api('/api/password-reset/complete', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: new URLSearchParams(window.location.search).get('reset'), password })
    });
    message.textContent = 'パスワードを更新しました。ログインしています…';
    $('passwordResetNewPassword').value = '';
    window.setTimeout(() => window.location.replace('/'), 500);
  } catch (error) {
    message.textContent = error.message;
  }
});
document.querySelectorAll('.welcomeBackButton').forEach(button => {
  button.addEventListener('click', () => showWelcomeMode(button.dataset.welcomeBack || 'choice'));
});

$('welcomeAccountForm').addEventListener('submit', async event => {
  event.preventDefault();
  if (!window.KagopitaTerms.requireAcceptance('guest')) return;
  const button = event.currentTarget.querySelector('[type="submit"]');
  $('welcomeAccountForm').dataset.termsSubmitting = 'true';
  button.disabled = true;
  $('welcomeAccountMessage').textContent = '';
  try {
    await api('/api/account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: $('welcomeAccountName').value.trim(), ...window.KagopitaTerms.acceptance('guest') })
    });
    window.location.reload();
  } catch (error) {
    $('welcomeAccountMessage').textContent = error.message;
  } finally {
    delete $('welcomeAccountForm').dataset.termsSubmitting;
    window.KagopitaTerms.sync();
  }
});

$('welcomeRegisterForm').addEventListener('submit', async event => {
  event.preventDefault();
  const button = event.currentTarget.querySelector('[type="submit"]');
  const message = $('welcomeRegisterMessage');
  if (!window.KagopitaTerms.requireAcceptance('register')) return;
  const requiredFields = [...event.currentTarget.querySelectorAll('input[required]')];
  const emailInput = $('welcomeRegisterEmail');
  const invalidEmail = Boolean(emailInput.value.trim()) && !emailInput.checkValidity();
  const missingFields = requiredFields
    .filter(input => !input.value.trim());
  requiredFields.forEach(input => {
    input.classList.toggle('field-error', missingFields.includes(input) || (input === emailInput && invalidEmail));
  });
  if (invalidEmail || missingFields.length) {
    if (invalidEmail) message.textContent = '有効なメールアドレスを入力してください。';
    else message.textContent = '必須項目を入力してください。';
    (invalidEmail ? emailInput : missingFields[0]).focus();
    return;
  }
  $('welcomeRegisterForm').dataset.termsSubmitting = 'true';
  button.disabled = true;
  message.textContent = '';
  try {
    const { email } = await api('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: $('welcomeRegisterName').value.trim(),
        email: $('welcomeRegisterEmail').value.trim(),
        password: $('welcomeRegisterPassword').value,
        ...window.KagopitaTerms.acceptance('register')
      })
    });
    $('welcomeRegisterPassword').value = '';
    $('welcomeVerifyEmail').value = email;
    $('welcomeVerifyCode').value = '';
    $('welcomeVerifyDescription').textContent = '確認メールに記載された6桁のコードを入力してください。有効期限は24時間です。';
    $('welcomeVerifyMessage').textContent = '';
    showWelcomeMode('verify');
  } catch (error) {
    message.textContent = error.message;
  } finally {
    delete $('welcomeRegisterForm').dataset.termsSubmitting;
    window.KagopitaTerms.sync();
  }
});

document.querySelectorAll('#welcomeRegisterForm input[required], #welcomeLoginForm input[required]').forEach(input => {
  input.addEventListener('input', () => {
    if (input.value.trim()) input.classList.remove('field-error');
  });
});

$('welcomeVerifyCode').addEventListener('input', event => {
  event.currentTarget.value = event.currentTarget.value.replace(/\D/g, '').slice(0, 6);
});

$('welcomeVerifyForm').addEventListener('submit', async event => {
  event.preventDefault();
  const submitButton = event.currentTarget.querySelector('[type="submit"]');
  submitButton.disabled = true;
  $('welcomeVerifyMessage').textContent = '';
  try {
    await api('/api/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: $('welcomeVerifyEmail').value.trim(),
        code: $('welcomeVerifyCode').value.trim()
      })
    });
    window.location.replace('/?verified=1');
  } catch (error) {
    $('welcomeVerifyMessage').textContent = error.message;
  } finally {
    submitButton.disabled = false;
  }
});

$('resendWelcomeVerification').addEventListener('click', async event => {
  const button = event.currentTarget;
  button.disabled = true;
  const message = $('welcomeVerifyMessage');
  try {
    const result = await api('/api/resend-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: $('welcomeVerifyEmail').value.trim() })
    });
    message.textContent = '対象アカウントがある場合、新しい確認コードを送信します。';
  } catch (error) {
    message.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

$('welcomeLoginForm').addEventListener('submit', async event => {
  event.preventDefault();
  const button = event.currentTarget.querySelector('[type="submit"]');
  const message = $('welcomeLoginMessage');
  const requiredFields = [...event.currentTarget.querySelectorAll('input[required]')];
  const emailInput = $('welcomeLoginEmail');
  const invalidEmail = Boolean(emailInput.value.trim()) && !emailInput.checkValidity();
  const missingFields = requiredFields
    .filter(input => !input.value.trim());
  requiredFields.forEach(input => {
    input.classList.toggle('field-error', missingFields.includes(input) || (input === emailInput && invalidEmail));
  });
  if (invalidEmail || missingFields.length) {
    if (invalidEmail) {
      message.textContent = '有効なメールアドレスを入力してください。';
      emailInput.focus();
      return;
    }
    const missingEmail = !$('welcomeLoginEmail').value.trim();
    const missingPassword = !$('welcomeLoginPassword').value.trim();
    message.textContent = missingEmail && missingPassword
      ? 'メールアドレスとパスワードを入力してください。'
      : missingPassword
        ? 'パスワードを入力してください。'
        : 'メールアドレスを入力してください。';
    missingFields[0].focus();
    return;
  }
  button.disabled = true;
  message.textContent = '';
  try {
    await api('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: $('welcomeLoginEmail').value.trim(),
        password: $('welcomeLoginPassword').value
      })
    });
    window.location.reload();
  } catch (error) {
    if (error.status === 403) {
      $('welcomeVerifyEmail').value = $('welcomeLoginEmail').value.trim();
      $('welcomeVerifyCode').value = '';
      $('welcomeVerifyDescription').textContent = error.message;
      $('welcomeVerifyMessage').textContent = '';
      showWelcomeMode('verify');
    } else {
      message.textContent = error.message;
    }
  } finally {
    button.disabled = false;
  }
});

$('welcomeJoinForm').addEventListener('submit', async event => {
  event.preventDefault();
  if (!window.KagopitaTerms.requireAcceptance('join')) return;
  const button = event.currentTarget.querySelector('[type="submit"]');
  $('welcomeJoinForm').dataset.termsSubmitting = 'true';
  button.disabled = true;
  $('welcomeJoinMessage').textContent = '';
  try {
    await api('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invite: $('welcomeInviteCode').value.trim(),
        username: $('welcomeJoinName').value.trim(),
        ...window.KagopitaTerms.acceptance('join')
      })
    });
    window.location.reload();
  } catch (error) {
    $('welcomeJoinMessage').textContent = error.message;
  } finally {
    delete $('welcomeJoinForm').dataset.termsSubmitting;
    window.KagopitaTerms.sync();
  }
});

function showEmailVerificationNotice() {
  const params = new URLSearchParams(window.location.search);
  const notice = $('authNotice');
  if (params.get('verified') === '1') {
    notice.textContent = 'メールアドレスを確認しました。アカウントをご利用いただけます。';
  } else if (params.get('verification') === 'invalid') {
    notice.textContent = 'メールアドレスを確認できませんでした。ログイン画面から確認コードを再送してください。';
  } else {
    return;
  }
  notice.classList.remove('hidden');
  params.delete('verified');
  params.delete('verification');
  const query = params.toString();
  window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
}

async function startApp() {
  showEmailVerificationNotice();
  try {
    const joinedChannelId = await acceptInviteFromUrl();
    if (joinedChannelId === false) {
      await refreshChannels(null);
      return;
    }
    await refreshChannels(joinedChannelId || currentChannelId);
  } catch (error) {
    console.error(error);
    resetSignedOutState();
    $('noChannels').classList.remove('hidden');
    $('channelViews').classList.add('hidden');
    document.querySelector('.bottom-nav').classList.add('hidden');
    $('noChannelsTitle').textContent = error.status === 404
      ? 'サーバーを再起動してください'
      : error.status === 401
        ? '自分のリストを作成する / 招待で参加する'
        : 'サーバーに接続できません';
    $('noChannelsMessage').textContent = error.status === 404
      ? '実行中のサーバーが古いバージョンのようです。プロジェクトフォルダーで npm start を再実行してください。'
      : error.status === 401
        ? '招待がなくても利用できます。名前を登録して自分のリストを作成するか、招待番号で共有リストに参加してください。'
        : error.message;
    $('noChannelsCreateButton').classList.add('hidden');
    if (error.status === 401) {
      if (new URLSearchParams(window.location.search).has('reset')) showWelcomeMode('resetComplete');
      else showWelcomeMode('guest');
    }
    return;
  }

}

window.addEventListener('hashchange', async () => {
  if ($('joinDialog').open || !new URLSearchParams(window.location.hash.slice(1)).get('invite')) return;
  try {
    const joinedChannelId = await acceptInviteFromUrl();
    if (!joinedChannelId || joinedChannelId === false) return;
    await refreshChannels(joinedChannelId);
    switchTab('list');
  } catch (error) {
    console.error('Could not process invite link.', error);
  }
});

startApp();
