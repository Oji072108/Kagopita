let currentTab = 'list';
let currentUser = null;
let currentChannelId = null;
let currentMemberRole = null;
let channels = [];
let favoritesRequestId = 0;

const $ = id => document.getElementById(id);

const translations = {
  ja: { profileTitle: '表示名を変更', accountSettingsTitle: 'アカウント', profileNameLabel: '表示名', profileAvatarLabel: 'プロフィール画像', photoAdd: '写真を追加', photoHint: 'JPG、PNG、WebP / 400KB以内', choose: '選択', close: '閉じる', save: '保存する', leave: 'このリストから退出', logout: 'ログアウト', language: '表示言語', languageSub: 'Language', navList: 'リスト', navAdd: '追加・共有', navMembers: 'メンバー', navAccount: 'アカウント', navComplete: '完了', doneEyebrow: '買い物完了', doneTitle: '買い忘れなし！', doneText: 'この共有リストとログを削除し、メンバー全員をこのリストから退出させます。他のリストやアカウントには影響しません。', doneDelete: 'このリストを完了して削除', doneBack: 'リストに戻る' },
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
const originalUiText = new WeakMap();
const originalUiAttributes = new WeakMap();
function translatePageText(language) {
  const dictionary = uiTranslations[language] || {};
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    if (!originalUiText.has(node)) originalUiText.set(node, node.nodeValue.trim());
    const original = originalUiText.get(node);
    if (!original) continue;
    node.nodeValue = node.nodeValue.replace(node.nodeValue.trim(), dictionary[original] || original);
  }
  document.querySelectorAll('[placeholder], [aria-label], [title]').forEach(element => {
    if (!originalUiAttributes.has(element)) originalUiAttributes.set(element, {});
    const originals = originalUiAttributes.get(element);
    ['placeholder', 'aria-label', 'title'].forEach(attribute => {
      const value = element.getAttribute(attribute);
      if (!(attribute in originals)) originals[attribute] = value;
      const original = originals[attribute];
      if (original) element.setAttribute(attribute, dictionary[original] || original);
    });
  });
}
function applyLanguage(language) {
  const t = translations[language] || translations.ja;
  translatePageText(language);
  document.documentElement.lang = language;
  $('profileTitle').textContent = t.profileTitle;
  $('accountSettingsTitle').textContent = t.accountSettingsTitle;
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
  if (photoCopy) photoCopy.textContent = t.photoAdd || translations.en.photoAdd;
  if (photoHint) photoHint.textContent = t.photoHint || translations.en.photoHint;
  if (chooseButton) chooseButton.textContent = t.choose || translations.en.choose;
  $('closeProfileDialog').setAttribute('aria-label', t.close || translations.en.close);
  $('profileSaveButton').textContent = t.save;
  $('leaveGroup').textContent = t.leave;
  $('logoutButton').textContent = t.logout;
  document.querySelector('.language-setting-copy strong').textContent = t.language;
  document.querySelector('.language-setting-copy small').textContent = t.languageSub;
  const complete = document.querySelector('#view-complete');
  if (complete) {
    complete.querySelector('.eyebrow').textContent = t.doneEyebrow;
    complete.querySelector('h2').textContent = t.doneTitle;
    complete.querySelector('p').textContent = t.doneText;
    complete.querySelectorAll('button')[0].lastChild.textContent = ` ${t.doneDelete}`;
    complete.querySelectorAll('button')[1].textContent = t.doneBack;
  }
  const labels = document.querySelectorAll('.bottom-nav-links .nav-item span');
  [t.navList, t.navAdd, t.navMembers, t.navAccount, t.navComplete].forEach((value, index) => { if (labels[index]) labels[index].textContent = value; });
  localStorage.setItem('kagopita-language', language);
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
  let response;
  try {
    response = await fetch(url, options);
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('サーバーに接続できません。サーバーが起動しているか、表示中のURLとポートをご確認ください。');
    }
    throw error;
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const error = new Error(data.error || (response.status === 401
      ? '利用状態を確認できません。画面を更新するか、招待リンクから参加し直してください。'
      : `通信に失敗しました（応答番号：${response.status}）。`));
    error.status = response.status;
    throw error;
  }
  return response.json();
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
      const button = form.querySelector('[type="submit"]');
      button.disabled = true;
      message.textContent = '';
      try {
        const result = await api('/api/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ invite, username: $('joinName').value.trim() })
        });
        window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
        finish(result.channelId);
      } catch (error) {
        message.textContent = error.message;
      } finally {
        button.disabled = false;
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
  $('noChannels').classList.toggle('hidden', !currentUser || channels.length > 0);
  $('channelViews').classList.toggle('hidden', !currentChannelId);
  $('nav-account').classList.toggle('hidden', !currentUser);
  $('shareButton').classList.toggle('hidden', currentMemberRole !== 'admin');
  $('completeShoppingButton').classList.toggle('hidden', currentMemberRole !== 'admin');
  $('nav-complete').classList.toggle('hidden', currentMemberRole !== 'admin');
  document.querySelector('.bottom-nav-links')
    .classList.toggle('without-complete', currentMemberRole !== 'admin');
  document.querySelector('.bottom-nav-links')
    .classList.toggle('without-account', !currentUser);
  document.querySelector('.actions').classList.toggle('single-action', currentMemberRole !== 'admin');
  if (currentTab === 'complete' && currentMemberRole !== 'admin') switchTab('list');
}

async function refreshChannels(preferredId = currentChannelId) {
  const data = await api('/api/me');
  currentUser = data.user;
  channels = data.channels;
  const selected = channels.find(channel => channel.id === preferredId) || channels[0] || null;
  currentChannelId = selected?.id || null;
  currentMemberRole = selected?.role || null;
  updateChannelControls();
  if (currentChannelId) await loadShoppingList();
  else {
    $('categoriesContainer').replaceChildren();
    $('familyFeedContainer').replaceChildren();
  }
}

async function selectChannel(channelId) {
  const selected = channels.find(channel => channel.id === channelId);
  if (!selected) return;
  currentChannelId = selected.id;
  currentMemberRole = selected.role;
  currentTab = 'list';
  updateChannelControls();
  switchTab('list');
  await loadShoppingList();
}

async function loadShoppingList() {
  if (!currentChannelId) return false;
  try {
    const data = await api(channelUrl('/shopping-list'));
    $('progressCount').textContent = `${data.completed}/${data.total}`;
    const container = $('categoriesContainer');
    container.replaceChildren();

    data.categories.forEach(category => {
      if (!category.items.length) return;
      const card = document.createElement('article');
      card.className = 'category-card';
      const title = document.createElement('h3');
      title.className = 'category-title';
      const titleText = document.createElement('span');
      titleText.textContent = `【${category.name}】`;
      const count = document.createElement('span');
      count.className = 'category-count';
      count.textContent = `${category.items.filter(item => item.completed).length}/${category.items.length}`;
      title.append(titleText, count);
      card.appendChild(title);

      category.items.forEach(item => {
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
        name.textContent = item.name;
        const qty = document.createElement('span');
        qty.className = 'item-qty';
        qty.textContent = ` (${item.qty})`;
        name.appendChild(qty);
        const added = document.createElement('div');
        added.className = 'item-added';
        added.textContent = `追加: ${item.addedBy}`;
        info.append(name, added);
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
        row.append(check, info, favorite, remove);
        card.appendChild(row);
      });
      container.appendChild(card);
    });

    if (!container.children.length) {
      const empty = document.createElement('div');
      empty.className = 'category-card empty-state';
      empty.textContent = 'リストは空です。商品を追加しましょう！';
      container.appendChild(empty);
    }
    renderFamilyFeed(data.familyFeed);
    return true;
  } catch (error) {
    console.error(error);
    $('categoriesContainer').textContent = error.message;
    return false;
  }
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
      name.textContent = favorite.name;
      const meta = document.createElement('span');
      meta.className = 'favorite-meta';
      meta.textContent = `${favorite.category} · ${favorite.qty}`;
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
          alert(error.message);
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
          alert(error.message);
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
    alert(error.message);
  }
}

function renderFamilyFeed(feed) {
  const container = $('familyFeedContainer');
  container.replaceChildren();
  if (!feed.length) {
    const empty = document.createElement('p');
    empty.className = 'share-instructions';
    const language = localStorage.getItem('kagopita-language') || 'ja';
    empty.textContent = ({ en: 'Changes to members and the list will appear here.', ko: '멤버와 목록의 변경 사항이 여기에 표시됩니다.', zh: '成员和清单的变更会显示在这里。', es: 'Los cambios de miembros y de la lista aparecerán aquí.' }[language] || '参加者やリストの変更内容がここに表示されます。');
    container.appendChild(empty);
    return;
  }
  feed.forEach(entry => {
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
      completed: `「${entry.item}」を完了にしました`,
      uncompleted: `「${entry.item}」を未完了に戻しました`,
      deleted: `「${entry.item}」を削除しました`,
      kicked: `「${entry.item}」をリストから退出させました`,
      left: `「${entry.item}」から退出しました`,
      renamed: `名前を変更しました (${entry.item})`
    };
    const language = localStorage.getItem('kagopita-language') || 'ja';
    const localizedActions = feedTranslations[language];
    const actionText = localizedActions
      ? (typeof localizedActions[entry.action] === 'function' ? localizedActions[entry.action](entry.item) : localizedActions[entry.action])
      : (actions[entry.action] || 'リストを更新しました');
    const description = document.createElement('div');
    description.textContent = `${entry.name}${language === 'ja' ? '：' : ': '}${actionText}`;
    const time = document.createElement('span');
    time.className = 'feed-time';
    time.textContent = new Date(entry.createdAt).toLocaleString();
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
    alert(error.message);
  }
}

async function deleteItem(id) {
  try {
    await api(channelUrl(`/items/${id}`), { method: 'DELETE' });
    await loadShoppingList();
  } catch (error) {
    alert(error.message);
  }
}

const categoryPicker = $('categoryPicker');
const categoryPickerButton = $('categoryPickerButton');
const categoryOptions = $('categoryOptions');
const categoryOptionButtons = [...categoryOptions.querySelectorAll('[role="option"]')];

function closeCategoryPicker(restoreFocus = false) {
  categoryOptions.hidden = true;
  categoryPickerButton.setAttribute('aria-expanded', 'false');
  if (restoreFocus) categoryPickerButton.focus();
}

function selectCategory(option) {
  $('inputCategory').value = option.dataset.value;
  $('categoryPickerValue').textContent = option.querySelector('span').textContent;
  categoryOptionButtons.forEach(button => {
    const selected = button === option;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-selected', String(selected));
  });
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

$('addForm').addEventListener('submit', async event => {
  event.preventDefault();
  const name = $('inputName').value.trim();
  const category = $('inputCategory').value;
  const qty = $('inputQty').value.trim();
  const message = $('formMessage');
  if (!name) {
    message.textContent = '商品名を入力してください。';
    return;
  }
  try {
    await api(channelUrl('/items'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, category, qty })
    });
    $('inputName').value = '';
    $('inputQty').value = '1個';
    message.textContent = '商品を追加しました。';
    await loadShoppingList();
    switchTab('list');
  } catch (error) {
    message.textContent = error.message;
  }
});

async function handleResetList() {
  if (!confirm('買い物を完了すると、このリストとログが削除され、メンバー全員がこのリストから退出します。よろしいですか？')) return;
  try {
    await api(channelUrl('/complete'), { method: 'POST' });
    await refreshChannels(null);
  } catch (error) {
    alert(error.message);
  }
}

async function switchTab(tab) {
  if (tab === 'complete' && currentMemberRole !== 'admin') return;
  currentTab = tab;
  ['list', 'add', 'members', 'complete'].forEach(name => {
    $(`view-${name}`).classList.toggle('hidden', name !== tab);
    const nav = $(`nav-${name}`);
    nav.classList.toggle('active', name === tab);
    const icon = nav.querySelector('i');
    if (icon) {
      icon.className = name === tab
        ? icon.className.replace('ph-bold', 'ph-fill')
        : icon.className.replace('ph-fill', 'ph-bold');
    }
  });
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
      colorDark: '#26332a',
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
    await navigator.clipboard.writeText(link.value);
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
async function loadMembers() {
  const container = $('membersContainer');
  container.replaceChildren();
  let members;
  try {
    ({ members } = await api(channelUrl('/members')));
  } catch (error) {
    const message = document.createElement('p');
    message.className = 'share-message';
    message.textContent = error.message;
    container.appendChild(message);
    return;
  }

  members.forEach(member => {
    const row = document.createElement('div');
    row.className = 'feed-item member-row';
    const avatar = avatarElement(member);
    const content = document.createElement('div');
    content.className = 'feed-content';
    content.textContent = member.username;
    const role = document.createElement('span');
    role.className = 'member-role';
    role.textContent = member.role === 'admin' ? '管理者' : '参加者';
    content.appendChild(role);
    row.append(avatar, content);
    if (currentMemberRole === 'admin' && member.id !== currentUser.id) {
      const kick = document.createElement('button');
      kick.className = 'kick-button';
      kick.type = 'button';
      kick.textContent = '退出させる';
      kick.addEventListener('click', async () => {
        if (!confirm(`${member.username}さんをこのリストから退出させますか？`)) return;
        try {
          await api(channelUrl(`/members/${encodeURIComponent(member.id)}`), { method: 'DELETE' });
          await loadMembers();
        } catch (error) {
          alert(error.message);
        }
      });
      row.appendChild(kick);
    }
    container.appendChild(row);
  });
}

$('nav-account').addEventListener('click', async () => {
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
  $('accountStatus').textContent = hasEmail
    ? `${currentUser.email}（${currentUser.emailVerified ? '確認済み' : '未確認'}）`
    : ({ en: 'Set an email and password to sign in from another device.', ko: '이메일과 비밀번호를 설정하면 다른 기기에서 로그인할 수 있습니다.', zh: '设置邮箱和密码后即可从其他设备登录。', es: 'Configura un correo y una contraseña para iniciar sesión desde otro dispositivo.' }[localStorage.getItem('kagopita-language')] || 'メールアドレスとパスワードを設定すると、別の端末からログインできます。');
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
  profileDialog.showModal();
});
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
    const avatar = await readAvatarFile($('profileAvatar').files[0]);
    const { username, avatar: savedAvatar } = await api('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: $('profileName').value.trim(), ...(avatar !== undefined ? { avatar } : {}) })
    });
    currentUser.username = username;
    currentUser.avatar = savedAvatar;
    profileDialog.close();
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
  button.disabled = true;
  message.textContent = '';
  try {
    const { email, emailVerified } = await api('/api/account/credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: $('accountEmail').value.trim(),
        password: $('accountPassword').value
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
    button.disabled = false;
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

$('deleteAccountButton').addEventListener('click', async () => {
  $('deleteAccountMessage').textContent = '';
  $('deleteAccountDialog').showModal();
});

$('cancelDeleteAccount').addEventListener('click', () => $('deleteAccountDialog').close());
$('confirmDeleteAccount').addEventListener('click', async () => {
  const button = $('confirmDeleteAccount');
  button.disabled = true;
  try {
    await api('/api/account', { method: 'DELETE' });
    window.location.reload();
  } catch (error) {
    $('deleteAccountMessage').textContent = error.message;
    button.disabled = false;
  }
});

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
    window.location.reload();
  } catch (error) {
    $('accountStatus').textContent = error.message;
    button.disabled = false;
  }
});

profileDialog.addEventListener('click', event => {
  if (event.target === profileDialog) profileDialog.close();
});
$('closeProfileDialog').addEventListener('click', () => profileDialog.close());
$('leaveGroup').addEventListener('click', () => {
  $('leaveConfirmError').textContent = '';
  $('leaveConfirmDialog').showModal();
});
$('cancelLeave').addEventListener('click', () => $('leaveConfirmDialog').close());
$('confirmLeave').addEventListener('click', async event => {
  const button = event.currentTarget;
  button.disabled = true;
  try {
    await api(channelUrl('/membership'), { method: 'DELETE' });
    $('leaveConfirmDialog').close();
    profileDialog.close();
    await refreshChannels(null);
  } catch (error) {
    $('leaveConfirmError').textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

const channelsDialog = $('channelsDialog');
function renderJoinedChannels() {
  const section = $('joinedChannelsSection');
  const list = $('joinedChannelsList');
  list.replaceChildren();
  section.classList.toggle('hidden', channels.length === 0);
  for (const channel of channels) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `joined-channel-button${channel.id === currentChannelId ? ' selected' : ''}`;
    button.setAttribute('aria-current', channel.id === currentChannelId ? 'true' : 'false');

    const name = document.createElement('span');
    name.className = 'joined-channel-name';
    name.textContent = channel.name;
    const role = document.createElement('span');
    role.className = 'joined-channel-role';
    role.textContent = channel.role === 'admin' ? '管理者' : '参加者';
    button.append(name, role);
    button.addEventListener('click', async () => {
      channelsDialog.close();
      await selectChannel(channel.id);
    });
    list.appendChild(button);
  }
}

function openChannelsDialog() {
  renderJoinedChannels();
  $('createChannelMessage').textContent = '';
  $('joinChannelMessage').textContent = '';
  channelsDialog.showModal();
  applyLanguage(localStorage.getItem('kagopita-language') || 'ja');
}

$('showChannelsButton').addEventListener('click', openChannelsDialog);
$('closeChannelsDialog').addEventListener('click', () => channelsDialog.close());
channelsDialog.addEventListener('click', event => {
  if (event.target === channelsDialog) channelsDialog.close();
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
    channelsDialog.close();
    await refreshChannels(created.id);
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
    channelsDialog.close();
    await refreshChannels(result.channelId);
  } catch (error) {
    message.textContent = error.message;
  }
});

$('noChannelsCreateButton').addEventListener('click', openChannelsDialog);

function showWelcomeMode(mode) {
  const tabMode = ['join', 'guest', 'account'].includes(mode)
    ? mode
    : mode === 'login' ? 'account' : null;
  // Keep the account mode tabs visible while switching between register and login.
  const showModeTabs = mode === 'choice' || tabMode !== null || mode === 'login';
  $('welcomeModeTabs').classList.toggle('hidden', !showModeTabs);
  const modeIndex = { join: 0, guest: 1, account: 2 }[tabMode];
  if (modeIndex !== undefined) $('welcomeModeTabs').style.setProperty('--welcome-mode-index', modeIndex);
  document.querySelectorAll('[data-welcome-mode]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.welcomeMode === tabMode));
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
  button.addEventListener('click', () => showWelcomeMode(button.dataset.welcomeMode));
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
  const button = event.currentTarget.querySelector('[type="submit"]');
  button.disabled = true;
  $('welcomeAccountMessage').textContent = '';
  try {
    await api('/api/account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: $('welcomeAccountName').value.trim() })
    });
    window.location.reload();
  } catch (error) {
    $('welcomeAccountMessage').textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

$('welcomeRegisterForm').addEventListener('submit', async event => {
  event.preventDefault();
  const button = event.currentTarget.querySelector('[type="submit"]');
  const message = $('welcomeRegisterMessage');
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
  button.disabled = true;
  message.textContent = '';
  try {
    const { email } = await api('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: $('welcomeRegisterName').value.trim(),
        email: $('welcomeRegisterEmail').value.trim(),
        password: $('welcomeRegisterPassword').value
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
    button.disabled = false;
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
  const button = event.currentTarget.querySelector('[type="submit"]');
  button.disabled = true;
  $('welcomeJoinMessage').textContent = '';
  try {
    await api('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invite: $('welcomeInviteCode').value.trim(),
        username: $('welcomeJoinName').value.trim()
      })
    });
    window.location.reload();
  } catch (error) {
    $('welcomeJoinMessage').textContent = error.message;
  } finally {
    button.disabled = false;
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
    $('noChannels').classList.remove('hidden');
    $('channelViews').classList.add('hidden');
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

  const events = new EventSource('/api/events');
  events.addEventListener('update', event => {
    if (JSON.parse(event.data).channelId === currentChannelId) {
      refreshChannels(currentChannelId);
      if (currentTab === 'members') loadMembers();
      if (currentTab === 'add') loadFavorites();
    }
  });
  events.addEventListener('membership-removed', async event => {
    const data = JSON.parse(event.data);
    if (data.userId === currentUser?.id) {
      alert('このリストから退出させられました。');
      await refreshChannels(null);
      return;
    }
    await refreshChannels();
  });
  events.addEventListener('channel-completed', () => refreshChannels(null));
  events.addEventListener('channels', () => refreshChannels());
  events.onerror = error => console.error('Live updates disconnected; the browser will retry.', error);
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
