# instaVRam プロジェクト仕様書

## プロジェクト概要

**instaVRam** は、Next.js (App Router) + Firebase + Mantine UI を用いたフォト共有 SNS アプリケーションです。ユーザー認証、アルバム作成、画像アップロード、コメント、いいね、リポスト、リアクション、フレンド申請、ウォッチ機能、通知、検索などの機能を備えています。

**技術スタック:**
- **フロントエンド:** Next.js 16.1 (App Router), React 19.2, TypeScript 5
- **バックエンド/DB:** Firebase Authentication, Firestore, Storage, Admin SDK
- **UI:** Mantine 7, Tailwind CSS
- **画像処理:** react-easy-crop (アバター切り抜き), lightgallery (ギャラリービューアー)
- **その他:** Nodemailer (メール送信予定)

---

## ディレクトリ構成とファイル説明

### ルートディレクトリ

```
instavram3/
├── app/              # Next.js App Router のページとレイアウト
├── components/       # React コンポーネント（UI/機能別）
├── lib/              # ビジネスロジック、repositories、Firebase 初期化
├── src/              # サービス層（タイムライン集約、プロフィールサービス等）
├── public/           # 静的ファイル（画像、favicon 等）
├── firestore.rules   # Firestore セキュリティルール
├── package.json      # npm 依存関係
└── tsconfig.json     # TypeScript 設定
```

---

### `app/` - Next.js App Router ページ構成

#### `app/layout.tsx`
ルートレイアウトファイル。Mantine の ColorSchemeScript、ToastProvider、SideNav、AuthGate を組み込み、全ページ共通の構造を提供します。

#### `app/page.tsx`
トップページ（ログイン前）。AuthForm コンポーネントを表示し、ログイン/新規登録へ誘導します。

#### `app/providers.tsx`
Mantine の MantineProvider でテーマとカラースキームを設定。全ページに React Context を提供します。

#### `app/globals.css`
Tailwind CSS の基本スタイルとカスタム変数（カラースキーム等）を定義します。

#### `app/timeline/page.tsx` (628 lines)
**メインタイムライン画面**。ログインユーザーの投稿、フレンドの投稿、ウォッチ中のユーザーの投稿を時系列に表示します。無限スクロール対応、リアルタイム購読（コメント、いいね、リポスト）、オプティミスティック更新を実装しています。

#### `app/album/[id]/page.tsx` (1526 lines)
**アルバム詳細ページ**。アルバムタイトル・URL・公開設定の編集、画像一覧、コメント入力、いいね・リポスト・リアクション操作、参加ユーザー表示を行います。lightgallery で画像ギャラリー表示にも対応します。

#### `app/album/new/page.tsx`
**新規アルバム作成ページ**。ImageUploadFlow コンポーネントでタイトル、公開設定を指定して複数画像を一度にアップロードできます。

#### `app/user/[id]/page.tsx` (1526 lines)
**ユーザープロフィール画面**。プロフィール編集（handle, displayName, bio, icon, cover, banner）、フレンド申請/承認/解除、ウォッチ追加/削除、アルバム/参加アルバム/コメント/画像タブ表示、アカウント削除フローを提供します。

#### `app/search/page.tsx`
**検索画面**。ユーザー検索（handle/displayName）に対応し、結果をリスト表示します。将来的にアルバム検索も拡張予定です。

#### `app/notification/page.tsx`
**通知一覧画面**。コメント、いいね、フレンド申請、ウォッチ、リポスト、リアクションの通知をリアルタイム購読で表示します。既読一括マークにも対応します。

#### `app/login/page.tsx`
**ログインページ**。メールアドレス＋パスワードでログインします。エラーメッセージ表示とログイン後リダイレクトを処理します。

#### `app/register/page.tsx`
**新規登録ページ**。メールアドレス、パスワード、ハンドル、表示名を入力してアカウントを作成します。handle の重複チェック付き。

#### `app/register/complete/page.tsx`
**登録完了画面**。登録後、メール確認の案内を表示します。

#### `app/api/` - サーバー API Routes

##### `app/api/comments/add/route.ts`
コメント追加 API。クライアント側から fetch して Firestore にコメントを作成します。

##### `app/api/likes/toggle/route.ts`
いいねトグル API。Admin SDK でいいね作成/削除を実行します。未初期化時はクライアント SDK へフォールバック。

##### `app/api/reposts/toggle/route.ts`
リポストトグル API。likes と同様、Admin SDK 優先でリポスト ON/OFF を切り替えます。

##### `app/api/reactions/toggle/route.ts`
リアクションのトグル API。絵文字単位でリアクション追加/削除を行います。

##### `app/api/images/add/route.ts`
画像追加 API。アルバムへの画像追加を Admin SDK で実行します。

##### `app/api/images/delete/route.ts`
画像削除 API。指定 imageId の画像を削除し、Storage からも削除を試みます。

##### `app/api/share/discord/route.ts`
Discord Webhook 経由で投稿共有を行う予定のエンドポイント。

##### `app/api/reports/album/route.ts`
アルバム通報 API。将来的にモデレーション機能に対応予定。

---

### `components/` - UI コンポーネント

#### `components/AuthForm.tsx`
ログインフォーム。メールアドレス＋パスワードでログインまたは新規登録へのリンクを提供します。

#### `components/AuthGate.tsx`
認証ガード。未ログイン時にログインページへリダイレクトします。

#### `components/SideNav.tsx`
サイドナビゲーション。タイムライン、通知、検索、プロフィール、新規アルバム作成へのリンクを表示します。

#### `components/Header.tsx`, `components/HeaderGate.tsx`
ヘッダー部品。将来的にトップバー表示に使用予定。

#### `components/ThemeSwitch.tsx`
ライトモード/ダークモード切り替えスイッチ（将来実装予定）。

#### `components/AlbumCard.tsx`
アルバムカード UI。画像サムネイル、タイトル、オーナー情報を表示します。

#### `components/AlbumCreateModal.tsx`
アルバム作成ダイアログ。簡易的なモーダル UI でタイトルと公開設定を入力します。

#### `components/album/` - アルバム関連 UI

##### `components/album/AlbumActionsMenu.tsx`
アルバム操作メニュー（編集・削除・通報）。オーナーと閲覧者で表示項目を切り替えます。

##### `components/album/DeleteConfirmModal.tsx`
削除確認ダイアログ。アルバムまたは画像削除時に確認を求めます。

##### `components/album/ReportConfirmModal.tsx`
通報確認ダイアログ。アルバム通報機能に使用します。

##### `components/album/ShareMenu.tsx`
共有メニュー。URL コピー、Twitter 共有、Discord 共有（実装予定）ボタンを提供します。

#### `components/comments/` - コメント UI

##### `components/comments/CommentItem.tsx`
コメント 1 件の表示 UI。ユーザーアイコン、本文、削除ボタン（本人またはアルバムオーナーのみ）を表示します。

##### `components/comments/CommentInput.tsx`
コメント入力フォーム。textarea でコメントを入力し、送信ボタンで投稿します。

#### `components/form/` - 汎用フォームコンポーネント

##### `components/form/TextareaAutosize.tsx`
自動リサイズする textarea コンポーネント（コメント入力等で使用）。

#### `components/gallery/` - ギャラリー関連 UI

##### `components/gallery/ImageGrid.tsx`
画像グリッド表示。クリックでギャラリービューアーを開きます。

##### `components/gallery/GalleryViewer.tsx`
lightgallery を使ったフルスクリーン画像ビューアー（スワイプ対応）。

#### `components/profile/` - プロフィール UI

##### `components/profile/Avatar.tsx`
ユーザーアイコン表示コンポーネント。サイズ指定で動的にスタイルを変更します。

##### `components/profile/AvatarModal.tsx`
アバター編集ダイアログ。react-easy-crop で画像をトリミングして Storage へアップロードします。

##### `components/profile/AvatarCropper.tsx`
トリミング UI 本体。react-easy-crop の操作 UI を提供します。

##### `components/profile/FriendActions.tsx`
フレンドアクション UI。申請送信、承認、解除ボタンを状態に応じて表示します。

##### `components/profile/FriendRemoveConfirmModal.tsx`
フレンド解除確認ダイアログ。解除時に確認を求めます。

##### `components/profile/WatchActions.tsx`
ウォッチ（フォロー）操作ボタン。ウォッチ追加/削除を切り替えます。

#### `components/timeline/` - タイムライン UI

##### `components/timeline/TimelineItem.tsx` (715 lines)
タイムライン 1 行の UI。リポストバナー、画像追加バナー、オーナー表示、画像グリッド、コメントプレビュー、いいね/コメント/リポスト/リアクションボタンを含みます。

##### `components/timeline/ReactionSummary.tsx`
リアクション集計表示。絵文字別カウントとマイリアクションのハイライトを提供します。

##### `components/timeline/ReactionPickerPopover.tsx`
リアクション絵文字ピッカー。カテゴリ別絵文字一覧をポップオーバーで表示します。

#### `components/ui/` - 汎用 UI コンポーネント

##### `components/ui/Button.tsx`
汎用ボタンコンポーネント。variant (primary, ghost, danger 等) とサイズを指定可能です。

##### `components/ui/Toast.tsx`
トースト通知 UI。成功・エラーメッセージを画面右上に表示します。

##### `components/ui/ThemeSwitch.tsx`
テーマ切り替えスイッチ（実装予定）。

#### `components/upload/` - アップロード UI

##### `components/upload/ImageUploadFlow.tsx`
画像アップロードフロー。複数画像選択、タイトル・公開設定入力、一括アップロード処理を統合します。

##### `components/upload/ImagePreviewGrid.tsx`
アップロード前の画像プレビューグリッド表示。

##### `components/upload/ImageDropzone.tsx`
ドラッグ＆ドロップ対応の画像選択 UI。Mantine Dropzone を使用します。

#### `components/icons/` - アイコンコンポーネント

##### `components/icons/HeartIcon.tsx`
いいねアイコン（ハートマーク）。塗りつぶしでアクティブ状態を表現します。

##### `components/icons/ChatIcon.tsx`
コメントアイコン（吹き出しマーク）。

##### `components/icons/RepostIcon.tsx`
リポストアイコン（リツイートマーク）。

##### `components/icons/SearchIcon.tsx`
検索アイコン。

##### `components/icons/BellIcon.tsx`
通知アイコン（ベルマーク）。

##### `components/icons/UserIcon.tsx`
ユーザーアイコン（人マーク）。

---

### `lib/` - ビジネスロジック・リポジトリ層

#### `lib/firebase.ts`
Firebase アプリ初期化と db, auth, storage のエクスポート。環境変数から設定を読み込みます。

#### `lib/firebaseAdmin.ts`
Firebase Admin SDK 初期化。サーバーサイド API routes で使用します。

#### `lib/paths.ts`
Firestore コレクション名を定数として集中管理（`COL.users`, `COL.albums` など）。

#### `lib/constants/` - 定数定義

##### `lib/constants/reactions.ts`
リアクション絵文字のカテゴリ定義（顔、ハート、食べ物、スポーツ等）。

#### `lib/repos/` - Firestore アクセス層

##### `lib/repos/userRepo.ts`
ユーザー情報の CRUD 操作（作成、取得、更新、検索）。ハンドル重複チェック機能付き。

##### `lib/repos/albumRepo.ts`
アルバムの作成、取得、更新、削除、オーナー別一覧取得。公開設定（public/friends）の管理も行います。

##### `lib/repos/imageRepo.ts`
アルバム内画像の追加、削除、一覧取得。Storage へのアップロードも含みます。

##### `lib/repos/commentRepo.ts`
コメントの追加、削除、一覧取得。アルバム単位でのコメント取得をサポートします。

##### `lib/repos/likeRepo.ts`
いいねのトグル（追加/削除）、カウント、ユーザー一覧取得。いいね状態のチェック機能も提供します。

##### `lib/repos/repostRepo.ts`
リポストのトグル、カウント、リポストユーザー一覧取得。タイムライン表示用にアルバム単位のリポスト情報を取得します。

##### `lib/repos/reactionRepo.ts`
リアクションのトグル、一覧取得、絵文字別集計。リアクターユーザー情報の取得も行います。

##### `lib/repos/friendRepo.ts`
フレンド申請の送信、承認、キャンセル、解除。受信済み申請の一覧、承認済みフレンドの一覧取得を提供します。

##### `lib/repos/watchRepo.ts`
ウォッチ（フォロー）の追加、削除、トグル。ウォッチ中オーナー ID 一覧、ウォッチャー一覧を取得します。

##### `lib/repos/notificationRepo.ts`
通知の追加、一覧取得、既読一括マーク。リアルタイム購読機能（onSnapshot）も提供します。

##### `lib/repos/searchRepo.ts`
ユーザー検索機能（handle/displayName の部分一致クエリ）。将来的にアルバム検索も拡張予定。

##### `lib/repos/timelineRepo.ts`
タイムライン用のアルバム取得クエリ。指定オーナー ID リストと公開設定を考慮してフェッチします。

##### `lib/repos/blockRepo.ts`
ブロック機能用リポジトリ（**現在未実装、ファイルは空**）。将来的にユーザーブロック機能を実装予定。

#### `lib/services/` - サービス層

##### `lib/services/avatar.ts`
アバター画像のアップロードおよびリサイズ処理。react-easy-crop で生成した Blob を Storage へ保存します。

##### `lib/services/createAlbumWithImages.ts`
アルバムと画像を一括作成するサービス。複数画像のアップロードをトランザクション的に処理します。

##### `lib/services/deleteAccount.ts`
アカウント削除サービス。ユーザー情報、アルバム、画像、コメント、フレンド申請などを一括削除します（実装中）。

##### `lib/services/sendVerificationDev.ts`
メール確認リンク送信サービス（開発用）。Nodemailer でメール送信を予定しています（実装中）。

---

### `src/` - アプリケーション層サービス

#### `src/services/timeline/listLatestAlbums.ts` (244 lines)
**タイムライン集約サービス**。自分、フレンド、ウォッチ中ユーザーの最新アルバムを取得し、画像、コメントプレビュー、いいね、リポスト、リアクションを集約して TimelineItemVM を生成します。権限エラー発生時のフォールバックロジックも実装されています。

#### `src/services/profile/`
プロフィール画面用のサービス（アルバム取得、フレンド数集計等）を配置予定。

#### `src/services/album/`
アルバム詳細画面用のサービス（参加ユーザー集計、画像メタ情報取得等）を配置予定。

#### `src/models/`
アプリケーション層のビューモデル定義（TimelineItemVM, UserRef 等）。

#### `src/types/`
型定義ファイル（models.ts など）。Firestore ドキュメント型を定義します。

#### `src/hooks/`
カスタム React Hooks（useUser, useAuth 等）を配置予定。

#### `src/utils/`
汎用ユーティリティ関数（日付変換、バリデーション等）。

#### `src/constants/`
アプリケーション全体で使用する定数（リアクション絵文字、エラーメッセージ等）。

#### `src/components/`
src 内部で使う独立コンポーネント（存在する場合）。

#### `src/repositories/`
将来的に lib/repos から移行する可能性がある Firestore アクセス層（現在未使用）。

#### `src/libs/`
サードパーティライブラリの薄いラッパー（axios, Firebase 等）を配置予定。

#### `src/README.md`
src ディレクトリの構成と役割を説明するドキュメント（存在する場合）。

---

## Firestore データモデル

### コレクション一覧

- **users**: ユーザープロフィール情報（uid, handle, displayName, bio, iconURL, coverURL, bannerURL）
- **albums**: アルバム（ownerId, title, placeUrl, visibility, createdAt, updatedAt）
- **albumImages**: アルバム内画像（albumId, uploaderId, url, thumbUrl, createdAt）
- **comments**: コメント（albumId, userId, body, createdAt）
- **likes**: いいね（albumId, userId, createdAt）。ドキュメント ID = `albumId_userId`
- **reposts**: リポスト（albumId, userId, createdAt）。ドキュメント ID = `albumId_userId`
- **reactions**: リアクション（albumId, userId, emoji, createdAt）。ドキュメント ID = `albumId:userId:emoji`
- **friends**: フレンド申請（userId, targetId, status, createdAt）。ドキュメント ID = `userId_targetId`
- **watches**: ウォッチ（userId, ownerId, createdAt）。ドキュメント ID = `userId_ownerId`
- **notifications**: 通知（userId, actorId, type, albumId, message, createdAt, readAt）
- **blocks**: ブロック（**未実装**）

---

## Firestore セキュリティルール (`firestore.rules`)

### 基本方針

- **認証チェック**: `isSignedIn()` でログインユーザーのみ書き込み可
- **所有者チェック**: `isUser(uid)` で自分の情報のみ更新可
- **フレンド関係チェック**: `isFriendWith(otherId)` で相互フレンド関係を確認
- **アルバム可視性チェック**: `canReadAlbum(albumId)` でアルバムが公開（public）またはフレンド限定（friends）の場合に読み取り許可
- **読み取りルール**: 基本的に **permissive (true)** で、クライアント側でフィルタリングを行う設計（ブロック解除後のリアルタイム更新に対応）
- **書き込みルール**: フレンド関係やアルバム可視性を厳密にチェックし、不正な作成を防止

### ヘルパー関数

```plaintext
isSignedIn(): ログイン中か
isUser(uid): 自分のドキュメントか
isFriendWith(otherId): 双方向フレンド関係が accepted か
canReadAlbum(albumId): アルバムが public またはフレンド限定で権限あるか
```

### 各コレクションのルール概要

- **users**: read: 全員, create/update/delete: 本人のみ
- **albums**: read: 全員, create: ログインユーザーのみ, update/delete: オーナーのみ
- **albumImages**: read: 全員, create: アップローダー本人のみ（`canReadAlbum` チェック付き）, delete: アップローダーまたはアルバムオーナー
- **comments**: read: 全員, create: ログインユーザー（`canReadAlbum` チェック付き）, delete: コメント作成者またはアルバムオーナー
- **likes**: read: 全員, create: ログインユーザー（`canReadAlbum` チェック付き）, delete: 本人のみ
- **reposts**: read: 全員, create: ログインユーザー（`canReadAlbum` チェック付き）, delete: 本人のみ
- **reactions**: read: 全員, create: ログインユーザー（`canReadAlbum` チェック付き）, delete: 本人のみ
- **friends**: read: ログインユーザーのみ, create: 本人が userId の申請のみ（status=pending）, update: targetId 本人が承認操作のみ, delete: 申請者または対象者が削除可
- **watches**: read: ログインユーザーのみ, create: 本人が userId のウォッチのみ, delete: 本人のみ
- **notifications**: read: 本人のみ, create: actorId が本人の場合のみ, update: readAt を null → 非 null にする既読化のみ許可, delete: 不可
- **その他パス**: 全て閉じる（read: false, write: false）

### フレンド限定機能

- アルバム visibility が `'friends'` の場合、オーナー本人または承認済みフレンドのみが `canReadAlbum` を通過
- comments, likes, reposts, reactions の create 時に `canReadAlbum` チェックが入るため、フレンド限定アルバムへの操作は権限がないユーザーには不可

### ブロック機能（未実装）

- blocks コレクションのルールは未定義
- 将来的に `isBlockedWith(otherId)` ヘルパーと、インタラクション制限ロジックを追加予定

---

## 機能一覧と実装ファイル対応表

### 1. 認証機能

- **実装ファイル:**
  - `lib/firebase.ts` (Firebase Auth 初期化)
  - `components/AuthForm.tsx` (ログインフォーム)
  - `components/AuthGate.tsx` (認証ガード)
  - `app/login/page.tsx` (ログインページ)
  - `app/register/page.tsx` (新規登録ページ)
  - `app/register/complete/page.tsx` (登録完了ページ)
- **セキュリティルール:** users コレクションで本人のみ create/update 可能

### 2. アルバム管理

- **実装ファイル:**
  - `lib/repos/albumRepo.ts` (アルバム CRUD)
  - `app/album/[id]/page.tsx` (詳細・編集画面)
  - `app/album/new/page.tsx` (新規作成画面)
  - `components/AlbumCard.tsx` (カード UI)
  - `components/album/AlbumActionsMenu.tsx` (操作メニュー)
  - `lib/services/createAlbumWithImages.ts` (一括作成サービス)
- **セキュリティルール:** albums コレクション（オーナーのみ更新/削除可）

### 3. 画像アップロード・管理

- **実装ファイル:**
  - `lib/repos/imageRepo.ts` (画像 CRUD)
  - `components/upload/ImageUploadFlow.tsx` (アップロードフロー)
  - `components/upload/ImageDropzone.tsx` (ドロップゾーン)
  - `components/upload/ImagePreviewGrid.tsx` (プレビュー)
  - `components/gallery/ImageGrid.tsx` (画像グリッド)
  - `components/gallery/GalleryViewer.tsx` (lightgallery ビューアー)
  - `app/api/images/add/route.ts` (画像追加 API)
  - `app/api/images/delete/route.ts` (画像削除 API)
- **セキュリティルール:** albumImages コレクション（uploaderId 本人またはアルバムオーナーが削除可）

### 4. タイムライン表示

- **実装ファイル:**
  - `app/timeline/page.tsx` (タイムライン画面)
  - `src/services/timeline/listLatestAlbums.ts` (集約サービス)
  - `lib/repos/timelineRepo.ts` (タイムライン用クエリ)
  - `components/timeline/TimelineItem.tsx` (タイムライン 1 行 UI)
- **特徴:** 自分、フレンド、ウォッチユーザーの投稿を集約、無限スクロール、リアルタイム購読

### 5. ソーシャル機能（フレンド・ウォッチ）

- **実装ファイル:**
  - `lib/repos/friendRepo.ts` (フレンド申請 CRUD)
  - `lib/repos/watchRepo.ts` (ウォッチ CRUD)
  - `components/profile/FriendActions.tsx` (フレンドボタン UI)
  - `components/profile/WatchActions.tsx` (ウォッチボタン UI)
  - `components/profile/FriendRemoveConfirmModal.tsx` (解除確認ダイアログ)
  - `app/user/[id]/page.tsx` (プロフィール画面で操作)
- **セキュリティルール:** friends/watches コレクションで本人のみ作成/削除可能

### 6. インタラクション（いいね・コメント・リポスト・リアクション）

- **実装ファイル:**
  - `lib/repos/likeRepo.ts` (いいね)
  - `lib/repos/commentRepo.ts` (コメント)
  - `lib/repos/repostRepo.ts` (リポスト)
  - `lib/repos/reactionRepo.ts` (リアクション)
  - `app/api/likes/toggle/route.ts` (いいねトグル API)
  - `app/api/reposts/toggle/route.ts` (リポストトグル API)
  - `app/api/reactions/toggle/route.ts` (リアクショントグル API)
  - `app/api/comments/add/route.ts` (コメント追加 API)
  - `components/comments/CommentItem.tsx`, `CommentInput.tsx` (コメント UI)
  - `components/timeline/ReactionSummary.tsx`, `ReactionPickerPopover.tsx` (リアクション UI)
- **セキュリティルール:** likes/reposts/reactions/comments で canReadAlbum チェック、本人のみ削除可能

### 7. 通知機能

- **実装ファイル:**
  - `lib/repos/notificationRepo.ts` (通知 CRUD、リアルタイム購読)
  - `app/notification/page.tsx` (通知一覧画面)
  - `components/icons/BellIcon.tsx` (通知アイコン)
- **セキュリティルール:** notifications コレクションで本人のみ読み取り、actorId 本人のみ作成、既読化のみ update 可能

### 8. 検索機能

- **実装ファイル:**
  - `lib/repos/searchRepo.ts` (ユーザー検索クエリ)
  - `app/search/page.tsx` (検索画面)
  - `components/icons/SearchIcon.tsx` (検索アイコン)
- **特徴:** handle/displayName の部分一致検索（インデックス要）

### 9. ブロック機能（未実装）

- **実装予定ファイル:**
  - `lib/repos/blockRepo.ts` (現在空ファイル)
  - `firestore.rules` に blocks コレクション追加
  - `app/user/[id]/page.tsx` にブロック UI 追加
  - `src/services/timeline/listLatestAlbums.ts` でブロックユーザーフィルタリング追加
- **仕様:** Twitter 相当の相互ブロック、投稿非表示、コメント非表示、フレンド/ウォッチ強制解除

### 10. プロフィール編集

- **実装ファイル:**
  - `app/user/[id]/page.tsx` (プロフィール画面でインライン編集)
  - `lib/repos/userRepo.ts` (ユーザー情報更新)
  - `components/profile/AvatarModal.tsx` (アバター編集ダイアログ)
  - `components/profile/AvatarCropper.tsx` (画像トリミング UI)
  - `lib/services/avatar.ts` (アバターアップロードサービス)
- **特徴:** handle, displayName, bio, アイコン、カバー画像、バナー画像の編集に対応

### 11. アカウント削除

- **実装ファイル:**
  - `lib/services/deleteAccount.ts` (アカウント削除サービス、実装中)
  - `app/user/[id]/page.tsx` (削除フローと確認ダイアログ)
- **仕様:** ユーザー情報、アルバム、画像、コメント、フレンド申請などを一括削除（Storage も削除予定）

### 12. パスワードリセット（未実装）

- **実装予定:**
  - Firebase Auth のパスワードリセット機能（メール送信）
  - 第三者による変更防止、メールアドレス存在漏洩防止の設計
  - 中立的なメッセージ、CAPTCHA、レート制限を追加予定

### 13. テーマ切り替え（未実装）

- **実装予定ファイル:**
  - `components/ThemeSwitch.tsx` (ライト/ダーク切り替えスイッチ)
  - Mantine の useMantineColorScheme で動的切り替え
- **現状:** ColorSchemeScript は導入済みだが、UI 未完成

---

## 未実装・実装中機能

### 未実装

1. **ブロック機能**: blockRepo.ts は空ファイル、firestore.rules にもルール未定義
2. **パスワードリセット**: Firebase Auth のリセット機能は利用可能だが、カスタム実装（中立メッセージ、CAPTCHA）は未着手
3. **テーマ切り替え UI**: ColorSchemeScript は準備済みだが、UI ボタンは非表示またはコメントアウト状態
4. **Discord Webhook 共有**: app/api/share/discord/route.ts はエンドポイントのみ存在、実装未完了
5. **アルバム通報機能**: app/api/reports/album/route.ts はエンドポイントのみ存在、モデレーション機能未実装
6. **アルバム検索**: searchRepo.ts はユーザー検索のみ実装、アルバム検索は未対応

### 実装中

1. **アカウント削除サービス**: deleteAccount.ts は部分実装、Storage 削除やトランザクション処理が未完成
2. **メール確認リンク送信**: sendVerificationDev.ts は Nodemailer 設定が未完成
3. **プロフィール画面の詳細**: app/user/[id]/page.tsx は機能豊富だが、参加アルバム・コメント・画像タブの集計ロジックが一部不完全

---

## 開発・運用メモ

### Firebase Emulator

- 開発時は Firebase Emulator Suite を使用してローカル環境でテスト可能
- `firebase emulators:start` でエミュレータを起動し、環境変数で接続先を切り替え

### デプロイ

- Firestore ルール: `firebase deploy --only firestore:rules`
- Next.js アプリ: Vercel または Firebase Hosting へデプロイ

### 環境変数

- `NEXT_PUBLIC_FIREBASE_*`: Firebase クライアント SDK 用設定
- `FIREBASE_SERVICE_ACCOUNT_KEY`: Admin SDK 用サービスアカウント JSON（サーバー側）

### 依存関係更新

- `npm outdated` で最新バージョンを確認
- `npm update` で安全に更新
- メジャーバージョンアップ時は互換性確認が必要

### コードスタイル

- TypeScript strict モード有効
- ESLint + Prettier でコードフォーマット統一（設定ファイル存在確認）
- コンポーネントは "use client" ディレクティブで明示的にクライアント化

### テスト

- ユニットテスト: Jest + React Testing Library（未導入）
- E2E テスト: Playwright または Cypress（未導入）

---

## 今後の拡張予定

1. **ブロック機能の完全実装**: blockRepo.ts の実装、firestore.rules への追加、タイムライン/プロフィールでのフィルタリング
2. **パスワードリセットのカスタム実装**: 中立メッセージ、CAPTCHA、レート制限付きの安全な実装
3. **テーマ切り替え UI の完成**: ライト/ダークモード切り替えボタンの実装
4. **アルバム検索機能**: タイトル・タグでの検索、フルテキスト検索の導入
5. **通報・モデレーション機能**: アルバム通報の処理フロー、管理者用ダッシュボード
6. **Discord Webhook 統合**: 投稿を Discord に自動共有する機能の完成
7. **通知プッシュ機能**: Firebase Cloud Messaging (FCM) でプッシュ通知
8. **リアクション絵文字のカスタマイズ**: ユーザーがカスタム絵文字を追加できる機能
9. **タグ機能**: アルバムにタグを付けて分類・検索できる機能
10. **統計・分析機能**: いいね数ランキング、人気アルバム表示など

---

## まとめ

本プロジェクトは、Next.js App Router + Firebase を軸にしたフォト共有 SNS として、基本的なソーシャル機能（フレンド、ウォッチ、いいね、コメント、リポスト、リアクション）を実装済みです。Firestore セキュリティルールは読み取りを permissive にしてクライアント側フィルタリングで柔軟性を確保し、書き込みは厳格にチェックする設計になっています。

未実装機能（ブロック、パスワードリセット、テーマ切り替え、アルバム検索、通報）については、今後の拡張ロードマップに含まれており、段階的に実装予定です。

---

**作成日:** 2025-01-XX  
**最終更新:** 2025-01-XX  
**バージョン:** 1.0

