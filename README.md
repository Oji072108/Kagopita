# カゴピタ

## ローカルでの実行方法

カゴピタは、Node.jsに標準搭載されているSQLite機能を使ってデータを保存します。**Node.js 22.5以降**をインストールしてください。

ターミナルでプロジェクトのフォルダを開き、次のコマンドを実行します。

```sh
npm install
npm start
```

初めて起動すると、サーバーのターミナルに初期招待リンクが表示されます。このリンクを開くと、最初のアカウントと共有リストが作成され、そのユーザーが管理者になります。

初期招待リンクは一度しか使えません。使用されるまでは、ターミナルに表示されるリンクや `data/share-token` ファイルの内容を他人に見せないでください。

招待リンクを使わなくても、アプリを直接開いて表示名を登録すれば、自分専用のリストを作成できます。共有リストに参加した後でも、自分用のリストを追加して管理できます。

## アカウントとリストの管理

1つのアカウントで、複数の買い物リストを使えます。

リスト選択画面から、次の操作ができます。

- 使用するリストの切り替え
- 新しいリストの作成
- 招待コードを使った共有リストへの参加

リストから退出しても、アカウントや他のリストは削除されません。

管理者がリストから退出した場合は、最も長く参加しているメンバーに管理者権限が引き継がれます。メンバーが誰もいなくなったリストは、自動的に削除されます。

管理者は、一度だけ使用できる招待を発行したり、メンバーをリストから退出させたりできます。

## メールアドレスでのアカウント登録

表示名だけで使うゲスト利用はこれまでどおり可能です。別の端末から同じアカウントにログインしたい場合は、メールアドレスと8文字以上のパスワードを登録してください。

新規利用時は、サインイン画面からアカウントを作成できます。すでにゲストとして利用中の場合は、プロフィール画面の「アカウント」から登録すると、現在のリストやメンバー情報をそのまま引き継げます。

登録済みのメールアドレスとパスワードを使うと、別の端末からログインできます。ログアウトしてもアカウントやリストは削除されません。

アカウント作成後、確認メールに記載された6桁のコードをアプリに入力すると登録が完了します。コードは24時間有効です。メールが届かない場合は、確認画面、ログイン画面、またはプロフィール画面から再送できます。未確認のメールアドレスではログインできません。

確認メールの送信にはSMTP設定が必要です。Gmailを使う場合は、サーバーの環境変数に次の値を設定してください。

```text
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=送信元のGmailアドレス
SMTP_PASS=Googleで発行したアプリパスワード
SMTP_FROM=送信元の表示名とメールアドレス
PUBLIC_URL=アプリの公開URL
```

`SMTP_PASS` にはGoogleアカウントの通常のパスワードを使わず、Googleアカウントで発行した16文字のアプリパスワードを使用してください。コピー時に含まれる空白は自動的に取り除かれます。パスワードやアプリパスワードはチャットやリポジトリに記載せず、サーバー環境にだけ設定してください。ローカルで試す場合は `PUBLIC_URL` を `http://localhost:3000` にしてください。

設定例（PowerShell）:

```powershell
$env:SMTP_HOST = "smtp.gmail.com"
$env:SMTP_PORT = "465"
$env:SMTP_SECURE = "true"
$env:SMTP_USER = "送信元のGmailアドレス"
$env:SMTP_PASS = "Googleで発行したアプリパスワード"
$env:SMTP_FROM = "カゴピタ <送信元のGmailアドレス>"
$env:PUBLIC_URL = "http://localhost:3000"
npm start
```

これらの設定はサーバーの起動ごとに必要です。公開環境では `PUBLIC_URL` にHTTPSの公開URLを設定してください。SMTP未設定時は、アカウント登録やゲストアカウントへのメール登録は完了しません。

現在、パスワードの再設定には対応していません。登録したパスワードを安全に保管してください。

## 商品とお気に入り

商品はカテゴリや数量を指定して、買い物リストに追加できます。

よく購入する商品は、商品行にある星ボタンを押すとお気に入りに登録できます。登録した商品は「追加・共有」画面からワンタップで再追加できるため、毎回入力する必要がありません。

お気に入りはリストごとに管理され、不要になった商品は後から削除できます。

## 買い物の完了と履歴

買い物を完了すると、対象のリストに関するデータが削除されます。削除されるのは、リスト本体、商品、招待、履歴、メンバー登録です。

ただし、他のリストやアカウントには影響しません。

リストの変更は、Server-Sent Events（SSE）によって、接続中のメンバーにリアルタイムで反映されます。また、各リストには最新100件の履歴が保存されます。

## データの保存とバックアップ

SQLiteのデータベースは、次のファイルに保存されます。

```text
data/kagopita.sqlite
```

データベース本体と、実行中に作成されるWAL関連ファイルはGitの管理対象外です。

初回起動時に `data/family-state.json` が存在する場合、アプリはメンバー、現在のセッション、招待、商品、履歴のデータをSQLiteに移行します。元のJSONファイルは変更せず、バックアップとして残します。

SQLiteのバックアップを作成する場合は、次のいずれかの方法を使用してください。

- サーバーを停止してからデータベースファイルをコピーする
- サーバーを稼働させたまま、SQLiteのバックアップAPIを使用する

データの保存先を変更したい場合は、`KAGOPITA_DATA_DIR` に書き込み可能なディレクトリを指定してください。データベース、初期招待コードのファイル、移行元のJSONファイルの保存場所が変更されます。

## 公開環境へのデプロイ

インターネット上に公開する場合は、サーバーの起動時に `PUBLIC_URL` へ公開用のHTTPSアドレスを設定してください。

初回デプロイ時には、必要に応じて起動前に `FAMILY_SHARE_TOKEN` を設定できます。値には、他人に推測されにくい非公開の英数字8文字を指定してください。

初期招待リンクは、最初の管理者になるユーザーにだけ共有してください。初期招待コードを公開すると、意図しないユーザーが参加する可能性があります。

2回目以降の招待は、アプリ内から発
## アップデートログ

### 2026-10-25

- アカウント登録画面からログイン画面へ切り替えられるように改善
- ログイン画面でも利用方法のタブを表示し、アカウントを選択状態に維持
- プロフィールダイアログの見出しを中央配置し、左右と上下の余白を統一
- 未ログイン時はプロフィール画像の変更欄を非表示化
- スクロールバーをサイトの配色に合わせて調整

### 2026-10-25（追加）

- メールアドレスとパスワードの必須入力チェックを追加
- 未入力の項目を赤く強調し、入力内容に応じたエラーメッセージを表示
- メールアドレスの形式を検証し、不正な形式を受け付けないように改善


### Japanese quantity suggestions

The Add and Edit forms accept number-only quantities and suggest Japanese counters
from common item names (for example トマト → 個, にんじん → 本, 箸 → 膳).
`public/js/quantity.js` contains ordered offline rules; packaging words take priority
and unknown products fall back to 個. These are suggestions, not grammatical or
packaging guarantees: enter a free-form quantity when a specific unit is needed. Counters are automatic; no unit picker is shown.
Existing explicit quantities are never rewritten just because a name changes.

Run `node scripts/test-quantity.cjs` for rule checks. With Playwright installed in a
separate test environment, run `NODE_PATH=<test-env>/node_modules node scripts/test-quantity-ui.cjs`
against the running preview (`KAGOPITA_TEST_URL` overrides localhost:3001).
The UI check loads real assets and mocks API data/writes, so no live list is changed.

### Item details and list management

- Edit an item using its pencil button. Quantity counters remain automatic.
- Add/Edit → **詳細（メモ・価格・繰り返し）** holds optional notes, total price for that item in whole yen, and daily/weekly/monthly recurrence.
- Repeating items return to unchecked after the chosen interval following purchase. The same row is reused, so missed intervals do not create duplicate items. Monthly repeats clamp to the last valid day of the month. Deleted items and archived lists do not renew.
- **共有リスト** provides **複製** and admin-only **アーカイブ**. Copies contain non-deleted items (including details and recurrence), reset purchase status, and belong only to the copying user; assignments, members, invites, activity, and deleted items are not copied.
- Archived lists remain under **アーカイブしたリスト** and can be unarchived by their admin. Item mutations are blocked until unarchived; duplicates can still be made.
- **削除した商品 → 復元** restores soft-deleted items, including their details, as unchecked. Deletions made before this feature cannot be recovered. The existing **完了して削除** action still permanently deletes an entire list.
- Schema changes are additive and run at startup. Back up the SQLite database before updating an existing deployment.

Checks: `node scripts/test-item-management.cjs`, `node scripts/test-quantity.cjs`, and `node scripts/test-list-features.cjs`. For real mobile browser flows, set `KAGOPITA_BROWSER_TEST=1`, make `playwright-core` available, and optionally set `PW_EXECUTABLE_PATH` to your Chromium executable when running the last command. All feature tests use temporary databases and accounts.


### Shared-list languages

Each browser keeps its own Japanese, English, Korean, Simplified Chinese, or Spanish preference. `public/js/shopping-language.js` provides an offline, alias-based vocabulary for common shopping names, feeding both category and quantity inference. Names, favorites, deleted items, and known counters are localized for display; saved names/quantities, edits, brands, and notes retain their original text. Unknown words are not machine-translated. Extend the five-column vocabulary for additional terms; no external translation service or credential is used.

Verify with `node scripts/test-shopping-language.cjs` and the Playwright `scripts/test-shopping-language-ui.cjs` (uses API fixtures, never live list writes).
