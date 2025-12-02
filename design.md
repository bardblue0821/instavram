# Instavram 設計
## 概要
- ツイッター・インスタグラムライクにする

## 技術
- Next.js
- Firebase/PostgreSQL
- Tailwind CSS
- TypeScript

## 手順: スプリント１
### 手順
1. 開発環境準備  
   - Node.js と VS Code をインストール  
   - npx create-next-app@latest instavram （TypeScript / Tailwind 有効）  
   - cd instavram
2. Firebase プロジェクト作成（Firestore / Storage / Auth 有効化 詳細手順）  
   2-1. プロジェクト作成  
       - ブラウザで https://console.firebase.google.com を開く  
       - 「プロジェクトを追加」→ 任意のプロジェクト名入力 → 規約同意 → Google Analytics は最初はオフで可 → 作成完了待ち  
   2-2. Web アプリの追加  
       - プロジェクトホームで「アプリを追加」→ Web(</>) を選択  
       - アプリ名入力（例: instavram-web）→ Firebase Hosting は後でで可 → 「登録」  
       - 表示された設定スニペット（firebaseConfig）をコピー（後で src/lib/firebase.ts に貼る）  
       - // Import the functions you need from the SDKs you need
          import { initializeApp } from "firebase/app";
          import { getAnalytics } from "firebase/analytics";
          // TODO: Add SDKs for Firebase products that you want to use
          // https://firebase.google.com/docs/web/setup#available-libraries

          // Your web app's Firebase configuration
          // For Firebase JS SDK v7.20.0 and later, measurementId is optional
                    const firebaseConfig = {
                        apiKey: "AIzaSyDpx2YhHDQbjn2FG0LkWAeVVjO4Uqf8RH0",
                        authDomain: "instavram3.firebaseapp.com",
                        projectId: "instavram3",
                        // 修正: storageBucket は <projectId>.appspot.com 形式
                        storageBucket: "instavram3.appspot.com",
                        messagingSenderId: "244098860504",
                        appId: "1:244098860504:web:c0edf72e7e1cedd092dead",
                        measurementId: "G-6D5ZV5JK4E"
                    };

          // Initialize Firebase
          const app = initializeApp(firebaseConfig);
          const analytics = getAnalytics(app);
   2-3. Authentication 有効化  
       - 左メニュー「Authentication」→「はじめる」  
       - 「サインイン方法」タブで「メール/パスワード」をクリック→有効化→保存  
       - 「Google」をクリック→有効化→プロジェクト公開名を確認（project-244098860504）→保存  
       - （動作確認用に後で実際にログイン画面を作る）  
   2-4. Firestore 有効化  
       - 左メニュー「Firestore データベース」→「データベースを作成」  
       - モード選択画面で「テストモード」→（警告が出るが期限内にルール変更予定）→ 次へ  
       - リージョンはアプリ利用地域に近いもの（例: asia-northeast1）を選択 → 作成完了待ち  
       - 作成後、まだコレクションは作らなくてよい（コード側で追加）  
   2-5. Storage 有効化  
       - 左メニュー「Storage」→「使ってみる」  
       - リージョンは Firestore と同じに揃える → 作成  
       - デフォルトルールはテスト期間後に request.auth != null などへ変更予定  
   2-6. API キー等確認  
       - 左上「プロジェクトの設定」(歯車) →「全般」→「マイアプリ」にある Web アプリ欄の「SDK設定と構成」から firebaseConfig を再確認  
       - 以下キーを .env.local に貼る  
         NEXT_PUBLIC_FIREBASE_API_KEY=...  
         NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...  
         NEXT_PUBLIC_FIREBASE_PROJECT_ID=...  
         NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...  
         NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...  
         NEXT_PUBLIC_FIREBASE_APP_ID=...  
   2-7. 最低限ルールを後で締めるメモ  
       - Firestore ルール: 認証必須 / 自分のデータのみ変更 / 画像数制限はアプリ側でチェック  
       - Storage ルール: 認証ユーザーのみ書き込み・読み込み（後でサイズ/パス制限追加）
   2-8. 動作確認準備  
       - npm run dev 後、ブラウザ開いてコンソールエラーが出ないか  
       - Firebase コンソール「Authentication」のユーザー一覧がログイン後に増えることを後で確認
3. 依存追加  
   - npm install firebase react-firebase-hooks  
   - （PostgreSQL を使う場合は後で：npm install @prisma/client prisma pg）
4. Firebase 初期化ファイル作成 (推奨: `lib/firebase.ts` ルート直下。`src/lib` でも可)  
     - 目的: Firebase SDK を一度だけ初期化し、`auth / firestore / storage` を他ファイルから簡潔に利用できるようにする。
     - 詳細手順:
         4-1. ディレクトリ確認: プロジェクト直下に `lib/` が無ければ作成（`mkdir lib`）。Next.js(App Router) では `src/` を使わずルート `lib/` でも問題なし。
         4-2. 環境変数準備: `.env.local` に `NEXT_PUBLIC_FIREBASE_*` が入っていることを確認。値変更後は開発サーバー再起動。
         4-3. ファイル作成: `lib/firebase.ts` を新規作成し以下テンプレを貼る。
             ```ts
             import { initializeApp, getApps, getApp } from 'firebase/app'
             import { getAuth } from 'firebase/auth'
             import { getFirestore } from 'firebase/firestore'
             import { getStorage } from 'firebase/storage'
             // import { getAnalytics } from 'firebase/analytics' // ブラウザ限定で使う場合のみ

             const firebaseConfig = {
                 apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
                 authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
                 projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
                 storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
                 messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
                 appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
                 measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || undefined,
             }

             // HMR や再レンダーで二重初期化しないためのパターン
             const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()

             export const auth = getAuth(app)
             export const db = getFirestore(app)
             export const storage = getStorage(app)
             // export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null
             ```
         4-4. 再初期化防止: `getApps().length` を使う理由は開発中のホットリロード時に `Firebase App named '[DEFAULT]' already exists` エラーを避けるため。
         4-5. エクスポート設計: UI コンポーネント側では `import { auth, db, storage } from '@/lib/firebase'` で利用。パスエイリアス `@/` を使う場合は `tsconfig.json` の `paths` 設定が必要（後で追加）。
         4-6. Analytics を使う場合: Firebase コンソールで有効化後、計測が必要な画面でのみ遅延ロード推奨。
             ```ts
             // 例: useEffect 内で
             useEffect(() => {
                 if (typeof window !== 'undefined') {
                     import('firebase/analytics').then(({ getAnalytics }) => {
                         getAnalytics(app)
                     })
                 }
             }, [])
             ```
         4-7. 型補助 (任意): 返却型を強制したい場合
             ```ts
             export type FirebaseServices = {
                 auth: ReturnType<typeof getAuth>
                 db: ReturnType<typeof getFirestore>
                 storage: ReturnType<typeof getStorage>
             }
             ```
         4-8. 動作確認: `npm run dev` 起動 → ブラウザ開きエラーがないか。必要なら `console.log(auth.app.name)` を一時的に表示して初期化を確認。
         4-9. トラブルシュート: 
             - "storageBucket" 関連 404 → `.env.local` のバケット名を再確認（通常 `*.appspot.com`）。
             - "projectId does not match" → 変数 typo。Firebase コンソールと比較。
             - 二重初期化エラー → `getApps()` チェックが入っているか確認。
             - 環境変数が `undefined` → `NEXT_PUBLIC_` プレフィックス付与忘れ / サーバー再起動忘れ。
         4-10. 追加サービス例 (後で拡張): Functions / Messaging / Remote Config 等を使う時は同ファイルで import → export を追加するだけでよい。

5. データ構造（Firestore の例 / PostgreSQL なら同じ形のテーブル）  
   - users { uid, displayName, iconURL, bio, createdAt }  
   - albums { id, ownerId, title?, placeUrl?, createdAt, updatedAt }  
   - albumImages { id, albumId, uploaderId, url, createdAt }  
   - comments { id, albumId, userId, body, createdAt }  
   - likes { id, albumId, userId }  
   - friends { id, userId, targetId, status } (status: "pending"|"accepted")  
   - watches { id, userId, ownerId } (ウォッチ＝タイムライン表示対象)  
   - （4枚/ユーザー制限: albumImages を albumId + uploaderId で count）
   
     【実装手順（この章をコード化する最短ルート）】
     1) 型ファイル作成: `types/models.ts`
            ```ts
            export interface UserDoc { uid:string; displayName:string; iconURL?:string; bio?:string; createdAt:Date }
            export interface AlbumDoc { id:string; ownerId:string; title?:string; placeUrl?:string; createdAt:Date; updatedAt:Date }
            export interface AlbumImageDoc { id:string; albumId:string; uploaderId:string; url:string; createdAt:Date }
            export interface CommentDoc { id:string; albumId:string; userId:string; body:string; createdAt:Date }
            export interface LikeDoc { id:string; albumId:string; userId:string; createdAt:Date }
            export type FriendStatus = 'pending'|'accepted'
            export interface FriendDoc { id:string; userId:string; targetId:string; status:FriendStatus; createdAt:Date }
            export interface WatchDoc { id:string; userId:string; ownerId:string; createdAt:Date }
            ```
     2) コレクション定数: `lib/paths.ts`
            ```ts
            export const COL = { users:'users', albums:'albums', albumImages:'albumImages', comments:'comments', likes:'likes', friends:'friends', watches:'watches' }
            ```
     3) リポジトリ雛形: `lib/repos/` ディレクトリ。最低限のみ。
            - `userRepo.ts`
                ```ts
                import { db } from '../firebase'; import { doc,getDoc,setDoc } from 'firebase/firestore'; import { COL } from '../paths'
                export async function getUser(uid:string){ return (await getDoc(doc(db,COL.users,uid))).data() }
                export async function createUser(uid:string, displayName:string){
                    const now=new Date(); await setDoc(doc(db,COL.users,uid),{ uid, displayName, createdAt:now })
                }
                ```
            - `albumRepo.ts`
                ```ts
                import { db } from '../firebase'; import { collection,addDoc,doc,getDoc,updateDoc } from 'firebase/firestore'; import { COL } from '../paths'
                export async function createAlbum(ownerId:string, data:{title?:string;placeUrl?:string}){
                    const now=new Date(); return await addDoc(collection(db,COL.albums),{ ownerId, title:data.title||null, placeUrl:data.placeUrl||null, createdAt:now, updatedAt:now })
                }
                export async function getAlbum(id:string){ return (await getDoc(doc(db,COL.albums,id))).data() }
                export async function touchAlbum(id:string){ await updateDoc(doc(db,COL.albums,id),{ updatedAt:new Date() }) }
                ```
            - `imageRepo.ts` (4枚制限判定付き)
                ```ts
                import { db } from '../firebase'; import { collection,addDoc,query,where,getDocs } from 'firebase/firestore'; import { COL } from '../paths'
                export async function addImage(albumId:string, uploaderId:string, url:string){
                    const q=query(collection(db,COL.albumImages), where('albumId','==',albumId), where('uploaderId','==',uploaderId));
                    const count=(await getDocs(q)).size; if(count>=4) throw new Error('LIMIT_4_PER_USER');
                    await addDoc(collection(db,COL.albumImages),{ albumId, uploaderId, url, createdAt:new Date() })
                }
                ```
            - `commentRepo.ts`
                ```ts
                import { db } from '../firebase'; import { collection,addDoc } from 'firebase/firestore'; import { COL } from '../paths'
                export async function addComment(albumId:string,userId:string,body:string){
                    if(!body.trim()) throw new Error('EMPTY'); if(body.length>200) throw new Error('TOO_LONG');
                    await addDoc(collection(db,COL.comments),{ albumId,userId,body,createdAt:new Date() })
                }
                ```
            - `likeRepo.ts`
                ```ts
                import { db } from '../firebase'; import { doc,getDoc,setDoc,deleteDoc } from 'firebase/firestore'; import { COL } from '../paths'
                export async function toggleLike(albumId:string,userId:string){
                    const id=`${albumId}_${userId}`; const ref=doc(db,COL.likes,id); const snap=await getDoc(ref);
                    if(snap.exists()) await deleteDoc(ref); else await setDoc(ref,{ albumId,userId,createdAt:new Date() })
                }
                ```
     4) 初回ユーザー作成フロー: 認証成功後 `getUser(uid)` が null → `createUser(uid, displayName)` 実行。
     5) 4枚制限: `imageRepo.addImage` 内の件数チェック（後で高速化したければカウンタを albums に保持）。
     6) セキュリティルール最小案: ルートに `firestore.rules` を作成。
            ```
            rules_version = '2'; service cloud.firestore { match /databases/{db}/documents {
                function authed(){ return request.auth != null; }
                match /users/{uid} { allow read: if true; allow create,update: if authed() && uid==request.auth.uid; }
                match /albums/{id} { allow read: if authed(); allow create: if authed(); allow update,delete: if authed() && resource.data.ownerId==request.auth.uid; }
                match /albumImages/{id} { allow read: if authed(); allow create: if authed(); allow delete: if authed() && (resource.data.uploaderId==request.auth.uid); }
                match /comments/{id} { allow read,create: if authed(); allow delete: if authed() && (resource.data.userId==request.auth.uid); }
                match /likes/{id} { allow read,create,delete: if authed(); }
                match /friends/{id} { allow read,create,update: if authed(); }
                match /watches/{id} { allow read,create,delete: if authed(); }
            }}
            ```
            後でフレンド/オーナー細分化を強化。
     7) インデックス追加タイミング: Firestore コンソールで "index required" 警告が出たクエリのみ手動追加（最初は不要）。
     8) タイムライン暫定取得: `query(collection(db,COL.albums), orderBy('createdAt','desc'), limit(50))` → クライアント側で friends + watches + 自分 ownerId をフィルタ。
     9) PostgreSQL 移行時: Prisma で Like に `@@unique([albumId,userId])`、Watch に `@@unique([userId,ownerId])` を付与しロジック共通化。
     10) エラーメッセージ方針: LIMIT_4_PER_USER / TOO_LONG / EMPTY など短いコードを throw → UI で日本語化。
   
6. 認証画面 /login  
   - メール登録 & ログインボタン  
   - Google ログインボタン  
   - 成功後: users に存在しなければ作成
   
   【具体的実装手順】
   6-1. ページ作成: `app/login/page.tsx` を作成し `"use client"` を先頭に記述（Firebase Auth はブラウザ依存）。
   6-2. 依存読込: `import { auth } from '../../lib/firebase'` と `createUser/getUser` を `lib/repos/userRepo` から、`GoogleAuthProvider, signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword` を firebase/auth からインポート。
   6-3. 状態管理: `email`, `password`, `mode` ("login"|"register"), `loading`, `error`, `info` を useState で保持。
   6-4. バリデーション: 
       - email: 簡易で `/@.+\./` を満たさなければエラー。
       - password: 6文字未満はエラー。
   6-5. 登録フロー (register): 
       1) `createUserWithEmailAndPassword(auth,email,password)`
       2) `getUser(uid)` で Firestore 未作成なら `createUser(uid, displayName || email.split('@')[0])`。
       3) 完了後 `/` へ遷移。
   6-6. ログインフロー (login): 
       1) `signInWithEmailAndPassword(auth,email,password)`
       2) Firestore ドキュメントが無ければ `createUser(...)` （初期バージョンは常に保証する）
   6-7. Google ログイン: 
       - `const provider = new GoogleAuthProvider()` → `signInWithPopup(auth,provider)` → 同じく ensureUser ドキュメント作成。
   6-8. 初回ユーザー作成共通化: `lib/authUser.ts` に `export async function ensureUser(uid:string, displayName:string|undefined)` を実装し各フローで呼び出し。
   6-9. エラーハンドリング: Firebase が返す `auth/` 系エラーコードを switch し日本語化（例: `auth/email-already-in-use` → "既に登録済み"）。
   6-10. UI 要素: 
       - タブ/トグル: "ログイン" と "新規登録" の切替ボタン。
       - フィールド: email, password。
       - ボタン: 登録/ログイン (mode に応じて), Google ログイン, TOPへ戻る。
       - 状態表示: loading スピナーまたは "処理中..."、error メッセージ赤、info 緑。
   6-11. 成功後遷移: `router.push('/')` （App Router の `useRouter`）。
   6-12. 未ログインアクセス保護: `/login` は常に表示可。ログイン後再度アクセスされたら `/` に即時リダイレクトするため `useEffect` で `onAuthStateChanged` を監視。
   6-13. アクセシビリティ簡易: form 要素 + label, `aria-live="polite"` でメッセージ領域。
   6-14. 今後拡張: パスワードリセットリンク / 永続セッション / MFA / reCAPTCHA / プロフィール編集。

#### 新規登録時にパスワード入力を2回させる
登録フォーム改善として以下を導入済み:
- パスワード再入力フィールド (確認). 入力中リアルタイムで一致判定し不一致なら赤エラー表示、送信不可。
- パスワード表示/非表示トグル。「表示」押下でプレーンテキスト、「隠す」でマスク。
- 強度メーター (バー + ラベル)。評価基準: 長さ (>=8, >=12), 大文字/小文字混在, 数字, 記号。スコアに応じ「弱い/普通/良い/強い」。UIクラス: `.pw-strength-bar` と状態クラス (`pw-strength-weak` 等)。
- 送信前バリデーション: 長さ>=6 / 確認一致。
- アクセシビリティ: 強度ラベルと不一致メッセージに `aria-live="polite"`, エラーに `role="alert"`。

#### 新規登録時にユーザー名とユーザーIDを設定
目的: 表示名 (重複許容) と一意なユーザーID(handle) を分離し、後のメンションやプロフィールURL拡張を容易にする。

導入仕様:
- フィールド追加: ユーザー名 `displayName` (40文字上限 / 空白不可) と ユーザーID `handle` (英数字とアンダースコアのみ / 3〜20文字 / 重複不可)。
- リアルタイム重複チェック: 入力停止後 ~450ms で Firestore `users` コレクションに対し `where('handle','==',value)` クエリし存在判定。
    - 状態表示: idle / 確認中 / 利用可 / 使用不可 / 形式不正。
    - エラー時 (ネットワーク等) は一時的に "チェック失敗" を表示し再入力で再試行。
- バリデーション: フォーマット不正・重複（taken）・未入力で submit 拒否。ユーザー名は重複可のため存在チェックなし。
- 登録処理: `ensureUser(uid, displayName, email, handle)` を呼び出し user ドキュメントへ `{ uid, displayName, handle, createdAt }` を保存。
- Google ログインなど handle 未指定フローでは `ensureUser` 内で `displayName` 派生 + ランダムサフィックスによる自動生成 (最大3回衝突回避 / 失敗時タイムスタンプ後尾採用)。
- UI エラー表示: ユーザーIDが使用不可・形式不正時に赤下線 (`.input-underline.error`) と警告文。

注意点 / 今後の強化案:
- 競合レース: クライアント重複チェックは同時登録競合を完全保証しない。高確度な一意制は Cloud Functions + `handles/{handle}` ドキュメントの原子的作成（トランザクション）で後工程対応予定。
- インデックス最適化: `where('handle','==',...)` 単一フィールドクエリはデフォルトインデックスで十分。高頻度になる場合はキャッシュレイヤを検討。
- 予約語: 後で `admin`, `support`, `system` 等は禁止リストで弾く予定。
- 正規化: 大文字を小文字へ変換 (現在 `toLowerCase()` 済) により一意性をケース非感知で統一。
- URL 設計: 当初 `/@{handle}` や ルート直下 `/{handle}` を検討したが、最終的に衝突回避と明瞭性のため `/user/{handle}` を正式採用。UID フォールバックで `/user/{uid}` も存続。

#### プロフィール URL 方針 (/user/{handle})
正式プロフィールURLは `/user/{handle}` のみ。handle で検索し見つからない場合は 404 を返す。UID 直接アクセス (`/user/{uid}`) は廃止し、既存ユーザーは必ず handle を保持する前提に移行する。

採用理由:
- 明確な名前空間 (`/user/`) で他リソース (album 等) と衝突しない。
- ルート直下より sitemap / SEO 管理が容易。
- 既存 UID ページの互換をシンプルに保持できる。

仕様概要:
- 動的ルート: `app/user/[id]/page.tsx` はパラメータを handle としてのみ解釈し、`getUserByHandle` で取得。UID フォールバックロジックは削除。
- 競合防止: `RESERVED_HANDLES` に `login`,`timeline`,`album`,`user`,`handle` を含め、これらはハンドル登録不可。
- 表示: プロフィール内で UID と @handle を併記 (デバッグ/内部識別用)。
- Header: handle 未設定時はプロフィールリンク非表示（ユーザーは先に handle を確定させる必要あり）。

テスト観点:
1. ログイン後 `/user/{handle}` で自身プロフィール表示。
2. 存在しない handle → 「ユーザーが見つかりません (handle)」。
3. 予約語を handle に入力 → バリデーション拒否。
4. `/user/{uid}` へアクセス → 404 (期待どおり廃止)。

移行手順メモ:
1. 既存ユーザーで `handle` が null のレコードをスクリプトで一括付与 (例: displayName 正規化 + 衝突回避サフィックス)。
2. ログイン時 `ensureUser` にて legacy ドキュメント( handle 無し )を検知した場合、自動生成して保存する拡張を検討。
3. 移行完了後 Header での handle 未設定分岐 (リンク非表示) を削除可能。

拡張案:
- メンション自動リンク化 (`@handle`).
- handle 変更履歴管理と旧 handle リダイレクト。
- Cloud Functions で衝突時再生成を非同期処理。

7. 共通レイアウト  
   - ヘッダー: ログイン状態 / プロフィール遷移 / アルバム作成ボタン常駐
   
    【具体的実装手順】
    7-1. ヘッダー構成要素: ロゴ/タイトル, 認証状態表示 (displayName), プロフィール遷移リンク, アルバム作成ボタン, ログアウト or ログイン遷移。 
    7-2. ファイル追加: `components/Header.tsx` (client component), `lib/hooks/useAuthUser.ts` (購読フック)。
    7-3. 認証購読: `onAuthStateChanged(auth, ...)` を useEffect で購読し user を state に保持。`loading` フラグ表示でちらつき防止。 
    7-4. プロフィールリンク: ログイン済みなら `/u/${uid}` へ遷移するボタン。未ログイン時は非表示。 
    7-5. アルバム作成: `/album/new` へのリンク（未ログイン時は disabled）。後でモーダル化可能。 
    7-6. ログアウト: `signOut(auth)` 実行 → `/login` へ router.push。 
    7-7. ログイン誘導: 未ログインなら "ログイン" ボタンを表示し `/login` へ遷移。 
    7-8. レイアウト統合: `app/layout.tsx` に `<Header />` を追加し `<main>` で子コンテンツを包む。 
    7-9. スタイル最小案: Flex / space-between / sticky top。Tailwind: `sticky top-0 bg-white border-b z-50`. 
    7-10. 型安全: Hook 戻り値 `{ user, loading }`。user は Firebase User | null。 
    7-11. アクセシビリティ: ナビゲーションに `nav` 要素、ユーザー名は `aria-label` で意味付け。 
    7-12. 将来拡張: 通知ベル / 未読件数 / 検索バー / ダークモードトグル。 

8. アルバム作成フロー  
   - モーダル: コメント（200文字以内）+ 撮影場所URL（任意）+ 画像選択（最大4枚）  
   - 画像アップロード順: Storage へ put → ダウンロードURL → albumImages に保存 → albums 作成  
   - 同一 uploader がその album に既に 4 枚なら追加ボタン disabled
    
    【具体的実装手順】
    8-1. UI 仕様: 画像 (複数 / 最大4) 選択フィールド + コメント textarea(200文字制限) + 撮影場所URL input + 作成ボタン。未入力許可: コメントは空OK（初期は省略可 / 後で必須に変更可能）。
    8-2. 事前 ID 生成: Firestore の addDoc は ID 取得後に画像参照を遡るのが難しいため `const newRef = doc(collection(db, COL.albums))` で ID を先に生成し利用後に setDoc。
    8-3. 処理順序 (仕様準拠): (a) Storage へ各画像 uploadBytes → getDownloadURL (b) Firestore `albumImages` に各 URL を保存 (c) albums ドキュメント作成 (d) 初回コメントあれば comments 追加。
    8-4. 画像パス構成: `albums/{albumId}/{uploaderId}/{timestamp}_{index}.{ext}` 拡張子は file.name 末尾から取得。MIME 不正時は `.bin`。
    8-5. 4枚制限: 選択段階で files.length > 4 は警告。追加実行時にも `imageRepo.addImage` 経由で二重防止。UI では残り枚数を表示。
    8-6. エラーハンドリング: 途中失敗時 → 既に upload 済み画像のクリーンアップは初期版では省略（後で削除 API）。ユーザーへ失敗メッセージ表示 + 再実行誘導。
    8-7. 並列 vs 逐次: 初期は逐次 upload (for...of) で進行バー簡易表示。後で Promise.all + rate limit 検討。
    8-8. フック/サービス: `lib/services/createAlbumWithImages.ts` にメイン関数。入力: ownerId, {title?, placeUrl?, firstComment?}, files: File[]。戻り値: albumId。
    8-9. 戻り値契約: 成功→ albumId, 失敗→ throw (UI で translateError)。
    8-10. コメント検証: firstComment が 200 超 → `TOO_LONG` throw。空または空白のみは追加しない。
    8-11. UI コンポーネント: `components/AlbumCreateModal.tsx` (client) でフォーム + 進捗表示 (現在 x/total)。
    8-12. ページ統合: 既存 `/album/new` ページでモーダルの中身を直接表示（後でモーダル化）。成功後 `/album/{id}` へ遷移（詳細ページ後で作成）。
    8-13. アクセシビリティ: ファイル input に `aria-label="画像選択"`、進捗領域に `role="status"`。
    8-14. 今後拡張: 失敗時リトライ個別画像 / 画像プレビュー / 圧縮 / EXIF 読み取り / 同時並列アップロード。

9. 一旦デプロイ

     【目的】現状機能 (認証 / アルバム作成 / 画像アップロード / コメント基礎) を早期に本番相当環境へ公開し、運用/課題を洗い出す。

     #### 前提チェック
     - .env.local の `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` が `instavram3.appspot.com` であること (typo: firebasestorage.app などは不可)
     - Firebase Console: Authentication 有効 (Email/Password + Google)、Firestore/Storage 作成済み
     - ローカルで `npm run build` 成功

     #### Firebase セキュリティルール (最初の安全ライン)
     Firestore（最小案）:
     ```
     rules_version = '2';
     service cloud.firestore {
         match /databases/{db}/documents {
             function authed() { return request.auth != null; }
             match /users/{uid} {
                 allow read: if true;
                 allow create,update: if authed() && uid == request.auth.uid;
             }
             match /albums/{id} {
                 allow read: if true; // 公開閲覧なら true
                 allow create: if authed();
                 allow update,delete: if authed() && resource.data.ownerId == request.auth.uid;
             }
             match /albumImages/{id} {
                 allow read: if true;
                 allow create: if authed();
                 allow delete: if authed() && resource.data.uploaderId == request.auth.uid;
             }
             match /comments/{id} {
                 allow read: if true;
                 allow create: if authed();
                 allow delete: if authed() && resource.data.userId == request.auth.uid;
             }
             match /likes/{id} { allow read,create,delete: if authed(); }
             match /friends/{id} { allow read,create,update: if authed(); }
             match /watches/{id} { allow read,create,delete: if authed(); }
         }
     }
     ```
     Storage（初期案）:
     ```
     service firebase.storage {
         match /b/{bucket}/o {
             match /albums/{allPaths=**} {
                 allow read: if true;
                 allow write: if request.auth != null; // 認証ユーザーのみアップロード
             }
         }
     }
     ```

     #### Git リポジトリ準備
     1. `git init`
     2. `.gitignore` に `/.env.local` を追加
     3. `git add . && git commit -m "initial deploy"`
     4. GitHub に新規リポジトリ作成 → `git remote add origin <repo-url>` → `git push -u origin main`

     #### Vercel へデプロイ
     1. Vercel ダッシュボード → New Project → GitHub リポジトリ選択
     2. Framework 自動検出 (Next.js) 設定はデフォルト (Build: `next build`, Output: `.next`)
     3. Environment Variables に以下を登録:
            - NEXT_PUBLIC_FIREBASE_API_KEY
            - NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
            - NEXT_PUBLIC_FIREBASE_PROJECT_ID
            - NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
            - NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
            - NEXT_PUBLIC_FIREBASE_APP_ID
            - NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID (利用するなら)
     4. Deploy 実行 → 完了後 URL メモ
     5. Firebase Authentication 許可ドメインに Vercel の生成ドメイン (例: `instavram3.vercel.app`) を追加（未追加ならログイン失敗）

     #### 本番動作確認チェックリスト
     - ログイン画面で Email 登録 → 成功後 Firestore `users` にドキュメント生成
     - Google ログイン成功確認 (初回 user 作成)
     - アルバム作成 → 画像 1 枚アップロード進捗が進む → 完了後詳細ページへ遷移
     - 画像 URL 表示 (403/404 がない)
     - コメント投稿可能
     - いいねトグル反応 (likes ドキュメント生成/削除)
     - 再読み込みして表示が維持される

     #### トラブルシュート早見表
     | 症状 | 想定原因 | 対処 |
     |------|---------|------|
     | 画像アップロードが 0% 固定 | Storage bucket typo / ルール拒否 | `.env.local` と Console 再確認 / ルール緩和テスト |
     | ログイン後も Firestore 書き込み不可 | ルール条件 mismatch | Firestore ルールで一時的に `allow read, write: if request.auth != null;` |
     | 画像表示が 403 | Storage 読み取りルール / 認証必須設定 | read 条件を `if true` に緩和し再確認 |
     | Google ログイン失敗 | 許可ドメイン未設定 | Firebase Auth 設定に本番ドメイン追加 |
     | 404 (バケット) | STORAGE_BUCKET typo | `<projectId>.appspot.com` に修正 |

     #### 改善フェーズでの次ステップ (任意)
     - 追加画像アップロード画面の進捗統一
     - Cloud Functions で不要画像クリーンアップ
     - 画像サムネイル生成 (サイズ削減)
     - エラーコード日本語化共通モジュール
     - Lighthouse / Web Vitals 測定でパフォーマンス改善

     #### デプロイ後の安全化 TODO
     - 期間限定の緩いルールを日付スケジュールで厳格化
     - バックアップ / ログ監視 (Firestore/Storage の使用量確認)
     - IAM で不要サービスキーの削除

     ---

10. アルバム編集  
   - オーナーのみ: コメント編集 / 撮影場所編集 / 全画像削除可  
   - フレンド: 新規画像追加可（自分が追加した画像のみ削除可能）  
   - 画像削除条件: (owner) または (image.uploaderId === currentUser.uid)

        【具体的実装手順】
        10-1. Firestore ルール調整（任意強化）: image 削除をオーナーも可能にするため albums 参照関数を追加。
                ```
                function isOwner(albumId) {
                    return get(/databases/$(db)/documents/albums/$(albumId)).data.ownerId == request.auth.uid;
                }
                match /albumImages/{id} {
                    allow delete: if authed() && (resource.data.uploaderId == request.auth.uid || isOwner(resource.data.albumId));
                }
                match /comments/{id} {
                    allow delete: if authed() && (resource.data.userId == request.auth.uid || isOwner(resource.data.albumId));
                    allow update: if authed() && (resource.data.userId == request.auth.uid || isOwner(resource.data.albumId));
                }
                ```
        10-2. リポジトリ機能追加:
                - `albumRepo.updateAlbum(id, { title?, placeUrl? })` で部分更新（空文字は null に変換）。
                - `imageRepo.deleteImage(imageId)` 画像削除。`addImage` 時に doc id をセットするため image ドキュメントへ `id` フィールド付加。
                - `imageRepo.listImages(albumId)` で一覧取得（`id` を含む）。
                - `commentRepo.updateComment(commentId, body)` / `commentRepo.deleteComment(commentId)`。`addComment` も `id` を保存するよう修正。
        10-3. 既存データの互換性: 過去に保存した image/comment に `id` フィールドが無い場合、編集/削除ボタン押下でエラーになるため、一覧取得時に Firestore の `doc.id` をオブジェクトへマージ。
        10-4. UI 改修 (`app/album/[id]/page.tsx`):
                - アルバムヘッダーにオーナー用フォーム（タイトル・場所URL）を表示し Save ボタンで更新。変更前後で loading スピナー。
                - 画像カードに削除ボタン（オーナーまたは uploader）。クリック時確認ダイアログ → 成功後再取得。
                - コメント項目に (自身 or オーナー) の場合は [編集] [削除] ボタン。編集は textarea 切替 + 保存/キャンセル。
                - 画像追加は既存ロジック維持（後で Storage 化）。
        10-5. エラーハンドリング: repository からの throw を `translateError` で表示。権限不足は `PERMISSION_DENIED` にマッピング。
        10-6. UX 細部: 更新成功時に "保存しました" のトースト的メッセージ（初期版は state メッセージで十分）。削除前に confirm。
        10-7. 後で強化: 楽観的更新、差分のみ再フェッチ、画像一括削除、コメント編集履歴。
        10-8. テストシナリオ: オーナーがタイトル変更→反映 / オーナーが他人画像削除→成功 / 投稿者が自分の画像削除→成功 / 第三者は削除ボタン非表示 / コメント編集権限確認 / 権限違反でボタン非表示。
11. フレンド機能  
    - プロフィールに「フレンド申請」ボタン → friends に {status:"pending"}  
    - 相手が承認すると status:"accepted"  
    - フレンド判定: 双方向 accepted (簡易) か一方向 accepted (ルール決めて実装)

    【具体的実装手順】
    11-1. Firestore ルール強化（friends コレクション）:
        - 作成/更新時に request.resource.data.userId == request.auth.uid を必須（既に強化済み）。
        - 受信者が承認する操作は友達申請ドキュメントの userId が申請者、targetId が受信者のため、受信者側も update できるようにするには OR 条件を追加。
        例:
        ```
        match /friends/{friendId} {
          allow read: if authed();
          allow create: if authed() && request.resource.data.userId == request.auth.uid;
          allow update: if authed() && (
            request.resource.data.userId == request.auth.uid || // 申請者
            request.resource.data.targetId == request.auth.uid   // 受信者（承認操作）
          );
        }
        ```
    11-2. データモデル: 既存 `FriendDoc { id,userId,targetId,status,createdAt }` を利用。`status` は 'pending' | 'accepted'。解除は将来 'removed' を追加しても良い。
    11-3. リポジトリ拡張 (`friendRepo.ts`):
        - `cancelFriendRequest(userId, targetId)` : pending のみ削除。
        - `removeFriend(userId, targetId)` : accepted を削除（双方どちらからでも）。
        - `listPendingReceived(userId)` : targetId==userId かつ status=='pending'。
    11-4. フレンド判定ロジック: シンプルに「任意方向の accepted が存在すればフレンド」とみなす。
        - 拡張で双方向承認を必須にしたい場合、accepted が userId->targetId と targetId->userId の両方あるかチェック。
    11-5. UI (プロフィール `/u/[id]` ページに追加):
        - 自分以外のプロフィール閲覧時: 状態に応じてボタン表示
            - 未申請: 「フレンド申請」→ sendFriendRequest
            - 送信済み (pending で自分が userId): 「申請中…」表示 + キャンセルボタン
            - 受信 (pending で自分が targetId): 「承認」ボタン + 「拒否」(削除) ボタン
            - accepted: 「フレンド解除」ボタン
        - 状態取得: `getFriendStatus(viewerUid, profileUid)` と逆向き `getFriendStatus(profileUid, viewerUid)` を併用し役割判定。
    11-6. 状態決定テーブル（優先順）:
        | viewer→profile | profile→viewer | 表示状態 |
        |----------------|----------------|-----------|
        | accepted       | *              | 解除ボタン |
        | pending        | *              | 申請中 (キャンセル可) |
        | *              | pending        | 承認 / 拒否 |
        | null           | null           | 申請ボタン |
    11-7. 申請処理フロー:
        - 申請: `sendFriendRequest(currentUser.uid, profileUid)` → 成功後 state 更新。
        - 承認: `acceptFriend(senderUid, currentUser.uid)` （repo拡張で順序明記）→ status を 'accepted'。
        - 拒否/キャンセル: 該当ドキュメント削除。
        - 解除: accepted ドキュメント削除。
    11-8. 楽観的 UI: ボタン押下で即ラベル更新→非同期結果失敗時に復元 & エラー表示。
    11-9. テストシナリオ:
        1) A が B プロフィールで申請 → B に pending 受信が表示。
        2) B が承認 → 双方 accepted 表示 / A の「解除」ボタン出現。
        3) A が解除 → A/B とも未申請状態に戻る。
        4) 自分自身のプロフィールではボタン非表示。
    11-10. 将来拡張案:
        - 双方向承認方式 / 申請メッセージ / 通知連携 / フレンド一覧ページ / 検索 / ブロック機能。
        - フレンド数上限と rate limit (悪用防止)。
        - Cloud Functions で承認イベント時通知ドキュメント生成。
12. ウォッチ機能
    - 他ユーザーのプロフィールに「ウォッチ」ボタン → watches に保存  
    - タイムライン取得時: (自分がウォッチしている ownerId) + (自分のフレンドの ownerId) の albums を並べる

    【具体的実装手順】
    12-1. Firestore ルール確認: watches コレクションで
        ```
        match /watches/{watchId} {
          allow read: if authed();
          allow create, delete: if authed() && request.resource.data.userId == request.auth.uid;
        }
        ```
        - 自分自身をウォッチする操作はクライアント側で拒否 (SELF_WATCH エラー)。
    12-2. データモデル: 既存 `WatchDoc { id,userId,ownerId,createdAt }`。id は `userId_ownerId`。
    12-3. リポジトリ (`watchRepo.ts`) 既存関数:
        - `addWatch(userId, ownerId)` / `removeWatch(userId, ownerId)` / `toggleWatch(userId, ownerId)` / `listWatchedOwnerIds(userId)`。
        追加で:
        - `isWatched(userId, ownerId)` 単一判定 (doc.exists)。
        - `listWatchers(ownerId)` ownerId をウォッチしている userId 一覧（後で通知や公開数表示）。
    12-4. UI 追加 (プロフィール `/u/[id]`):
        - フレンドボタン群の下にウォッチ状態表示領域。
        - 状態判定: `isWatched(currentUser.uid, profileUid)` → true なら「ウォッチ解除」ボタン / false なら「ウォッチ」ボタン。
        - クリック後は即座に楽観的に表示更新しつつ非同期処理。失敗時は復元 + エラーメッセージ。
    12-5. タイムライン取得ロジック（簡易案）:
        - `const watched = await listWatchedOwnerIds(currentUser.uid)`。
        - フレンド accepted 一覧 (listAcceptedFriends) で得たオーナー id とマージし Set 化。
        - その集合に含まれる ownerId の albums をクエリする最初の最適化は後回し。初期版: 全 albums orderBy('createdAt','desc') limit(50) → クライアント側フィルタ。
    12-6. エラー処理:
        - 自分自身ウォッチ: 'SELF_WATCH' → 「自分はウォッチできません」。
        - ルール拒否 (userId 不一致) → 「権限がありません」。
    12-7. テストシナリオ:
        1) A が B をウォッチ → タイムラインで B のアルバムが表示される。
        2) A が解除 → 再読込後表示から消える（フレンドであれば残る）。
        3) 自分自身プロフィールでウォッチボタン非表示。
        4) エラー時 (一時的ネットワーク遮断) でメッセージ表示。
    12-8. 将来拡張案:
        - ウォッチ数表示 / 通知生成 / フレンドとウォッチの優先度設定 / ミュート機能 / 推薦アルゴリズム。
        - タイムラインクエリの `where('ownerId', 'in', [...])` 分割最適化。
13. タイムライン表示 (/timeline)  
    - Firestore クエリ簡略版: 最初は全 albums orderBy(createdAt desc) → クライアント側で対象 (friends + watches + 自分) にフィルタ  
    - 後で最適化: ownerId in [...] クエリ（必要なら分割取得）

    【具体的実装手順】
    13-1. 取得方針 (初期版): パフォーマンス最優先よりも簡易実装を優先し、最新 50 件のアルバムを取得後にフロントでフィルタ。
        - `getLatestAlbums(50)` を呼び出し → `listAcceptedFriends(currentUser.uid)` と `listWatchedOwnerIds(currentUser.uid)` を取得 → Set 化し ownerId が (自分 or friends or watched) に一致するもののみ表示。
        - 未ログイン時は最新公開アルバムをそのまま表示（後で「ログインすると絞り込み」とガイド）。
    13-2. カード表示要素（最小）: タイトル / オーナーID / 作成日時 / 先頭画像サムネイル (albumImages から 1件) / 画像枚数 (optional)。
        - 画像サムネイル取得: 各 albumId ごとに `query(albumImages where albumId==...) limit(1)` で最初の画像URL。並列取得で Promise.all。
        - 画像枚数は後回しでもよい。実装するなら count クエリ (albumImages where albumId==X)。
    13-3. UI 構成 (/timeline):
        - ログイン状態: ヘッダー下に "タイムライン" のタイトルと簡易説明。
        - ローディング: スケルトンまたは "読み込み中..."。
        - 空の場合: "対象アルバムがありません"。
        - エラー表示: `translateError` 利用し再試行ボタン。
        - 最初の最適化余地: friends + watched の ownerId 数が多い場合は `in` クエリ分割 (10件ずつ) を後で導入。
    13-4. 型/契約:
        - `TimelineAlbum { id:string; ownerId:string; title?:string|null; createdAt:Date; firstImageUrl?:string }`。
        - firstImageUrl が未取得ならプレースホルダー画像 (例: /placeholder.png) を表示。
    13-5. 失敗時考慮:
        - 画像取得が一部失敗してもアルバム本体は表示し、失敗画像はプレースホルダー差し替え。
        - friends / watches の取得失敗時: フィルタをスキップし全公開アルバム表示（エラー通知は軽く）。
    13-6. テストシナリオ:
        1) ログインユーザーが friend + watch を設定後、相手アルバムがタイムラインに出る。
        2) watch 解除後 friend のみが残る。
        3) ログアウト時に全体最新リストが表示。
        4) 先頭画像が無いアルバムにプレースホルダーが表示。
    13-7. 次段階最適化案:
        - `ownerId in [...]` で直接フィルタした Firestore クエリ (最大10件制限回避のバッチ化)。
        - ページネーション / infinite scroll。
        - Cloud Function でユーザーごとの personalized feed を事前集計。
        - likes/comment の最近更新ソート (更新日時を albums に反映 or 別コレクション)。
    13-8. アクセシビリティ: カードのリンク要素に `aria-label="アルバム: {title || '無題'}"` 追加。
    13-9. エラー/再試行ボタン: ネットワーク不安定時に album 取得と画像取得を再実行。

14. いいね機能 (likes) / アルバム詳細への導入  
    - 目的: ユーザーがアルバムに「いいね」し、一覧/詳細で人気指標を表示できる基盤作り（初期は詳細ページのみ表示）。  
    - コレクション: `likes` （ドキュメントID: `<albumId>_<userId>` 重複防止）  
    - 最低限フィールド: `{ albumId, userId, createdAt }`  
    - 権限 (firestore.rules): create/delete は本人のみ。read はログインユーザーのみ (将来的に公開表示にする場合は調整)。  

    【具体的実装手順】  
    14-1. Repository 拡充: 既存 `toggleLike(albumId, userId)` に加え:  
        - `countLikes(albumId): Promise<number>`: `where('albumId','==',albumId)` で件数。  
        - `hasLiked(albumId, userId): Promise<boolean>`: ドキュメント存在チェック。  
    14-2. UI 追加 (`app/album/[id]/page.tsx`):  
        - アルバムタイトル付近に Like ボタンとカウント表示。  
        - 状態: 未ログイン → グレー表示 & ツールチップ。  
        - 押下処理: 楽観的更新 → toggleLike → 失敗時ロールバック。  
    14-3. 初期ロード: アルバム詳細取得後に `hasLiked` + `countLikes` を並列取得し state へ。  
    14-4. 型: `LikeState { liked: boolean; count: number; busy: boolean }` を page 内で管理。  
    14-5. エラー処理: トグル失敗時は `translateError` でメッセージ表示、前状態へ戻す。  
    14-6. テストシナリオ:  
        1) 自分が Like 済み → ボタンが取り消しモード。  
        2) 取り消し後 count が -1。再 Like → +1。  
        3) 未ログインでボタン非活性。  
        4) 同一アルバムを他ユーザーが Like → 手動リロードで count 増加。 (リアルタイムは後工程)  
    14-7. 拡張余地:  
        - リアルタイム購読: onSnapshot で likes 件数サブスク。  
        - 人気アルバム一覧: likes 件数降順インデックス用 Cloud Function 集計 or BigQuery 連携。  
        - ユーザーごとの Like 履歴一覧ページ (/likes)。  
        - 通知: 自分のアルバムが Like されたとき通知送信。  
    14-8. パフォーマンス注意: 単純な count クエリは N 件分のドキュメントを転送するため大量アクセスで負荷 → 後で `albums` に `likeCount` キャッシュを持たせ Cloud Function でインクリ/デクリ。  
    14-9. アクセシビリティ: ボタンに `aria-pressed` を付与し状態を明示。  
15. コメント機能（詳細 / 編集 / リアルタイム / 権限）  
    - 目的: アルバムに対するテキストリアクション（最大200文字）を安全・快適に扱う。編集/削除権限とリアルタイム反映を整理。  
    - コレクション: `comments` ドキュメント構造 `{ id, albumId, userId, body, createdAt }`（id は Firestore doc.id を保存）  
    - 表示対象: アルバム詳細ページで最新順（createdAt desc）  
    - 投稿権限: 最初は「ログインしていれば誰でも」にしておき、後で (owner or friend) に制限可能（ルール/クエリ変更）。  
    - 編集権限: 投稿者本人 or アルバムオーナー  
    - 削除権限: 投稿者本人 or アルバムオーナー  
    - リアルタイム: onSnapshot により新規/編集/削除を即時反映（再取得不要）  

    【具体的実装手順】  
    15-1. バリデーション: `body.trim().length === 0` → `EMPTY`; `body.length > 200` → `TOO_LONG`。UI 側で残文字数を表示。  
    15-2. Repository 確認/強化 (`commentRepo.ts`):  
        - `addComment(albumId, userId, body)` 既存。throw コード維持。  
        - `updateComment(commentId, body)` / `deleteComment(commentId)` 既存。  
        - （任意）`subscribeComments(albumId, cb)` を追加し購読解放関数を返す。初期版はページ側で直接 onSnapshot を使用。  
    15-3. Firestore ルール再確認:  
        ```
        match /comments/{commentId} {
          allow read: if true; // 公開閲覧
          allow create: if authed();
          allow update, delete: if authed() && (resource.data.userId == request.auth.uid || isOwner(resource.data.albumId));
        }
        ```  
        - 投稿制限を friend のみにしたい場合は後で: `isFriend(request.auth.uid, resource.data.albumOwnerId)` 関数導入案。  
    15-4. UI 改修 (`app/album/[id]/page.tsx`):  
        - useEffect で `query(comments where albumId==X orderBy(createdAt,'desc'))` → onSnapshot 購読。  
        - 編集中は textarea に切替 + 保存/キャンセルボタン。保存時は楽観的でなく完了後に編集モード終了。  
        - 削除前 `confirm()`。  
        - リアルタイム導入後は add/edit/delete 後の再 getDocs を削除（購読が反映）。  
    15-5. ソート戦略: createdAt 昇順（古い→新しい）。Timestamp 不整合（欠損）の場合は fallback 0 を与えて並び替え破綻回避。  
        - Firestore で `where(albumId == X)` + `orderBy(createdAt asc)` を同時利用するには複合インデックスが必要になる（未作成時 `The query requires an index` エラー）。  
        - 作成手順: エラーに表示されるリンクを開きそのまま "作成"。または Firebase Console → Firestore Database → Indexes → Composite → Add Index → Collection `comments`, Fields: `albumId` Asc / `createdAt` Asc。  
        - 一時フォールバック: インデックス未作成時は orderBy を外しクライアント側で sort(昇順)。後でインデックスができれば自動で高速化可能。  
    15-6. 状態管理:  
        - `comments: CommentDoc[]`  
        - `editingCommentId` / `editingCommentBody`  
        - `commentText` / `commenting`  
        - エラー共通: `error`  
    15-7. エラーハンドリング: repository の Error.message を `translateError` 経由で UI 表示。EMPTY/TOO_LONG の和訳（例: "空のコメントは送信できません" / "200文字を超えています"）を後で追加。  
    15-8. テストシナリオ:  
        1) 新規コメント投稿 → 即リストに反映。  
        2) 編集 → body が更新され即反映。  
        3) 削除 → リストから消える。  
        4) オーナーが他人コメント削除可能 / 第三者は削除ボタン非表示。  
        5) 文字数201で投稿不可。  
        6) 未ログイン時フォーム非表示。  
    15-9. 拡張案:  
        - ページネーション / infinite scroll (一定件数 limit + startAfter)  
        - 返信ツリー (parentCommentId) / メンション通知  
        - 編集履歴保持 (別サブコレクション)  
        - NG ワードフィルタ / モデレーションキュー  
        - 通知連携 (Cloud Functions で新規コメント時に通知ドキュメント追加)  
    15-10. パフォーマンス留意: 高頻度更新アルバムではコメント購読が負荷。後で limit + pagination に変更、あるいは last 50 件のみ購読。  
    15-11. アクセシビリティ: フォーム領域に `aria-label="コメント入力"` と送信ボタンに適切なラベル、エラー領域は `role="alert"`。  
    15-12. セキュリティ拡張 (後工程): Cloud Functions で投稿時に内容を検査 (不適切語検出) しフラグ付与、UI で非表示。  
    15-13. 楽観的更新検討: 現段階は onSnapshot 即反映のため不要。大規模化時は local insert → snapshot 確定で二重排除。  
    15-14. 失敗時フォールバック: 購読失敗（権限変更等）時は一度 getDocs で静的読み込みに切り替え、エラーバナー表示。  
16. いいね機能  
    - ハートボタン押下 → likes ドキュメント (albumId+userId) 追加  
    - 解除 → 削除  
    - 件数表示: likes where albumId の count
17. プロフィール (/u/[id])  
    - 目的: ユーザーの活動概要を一覧化し、他ユーザーが閲覧できる情報カードを提供する（公開プロフィール）。  
    - 表示要素（最小構成）: 基本情報 / 作成アルバム一覧 / 参加アルバム一覧 / 投稿コメント一覧 / 簡易統計（総アルバム数 / 参加アルバム数 / コメント数 / いいねしたアルバム数(任意)）。  
    - 初期バージョンは全て同期取得（並列）。後でページネーションや遅延タブ読込へ拡張。  

    【具体的実装手順】  
    17-1. データ取得戦略:  
        - プロフィール本体 `getUser(uid)`。  
        - 作成アルバム: `listAlbumsByOwner(uid)` 新規追加 (orderBy createdAt desc)。  
        - 参加アルバム: `listAlbumIdsByUploader(uid)` で albumImages の albumId Distinct → その ID で `getAlbum` を並列取得（自分がオーナーのものは除外）。  
        - 投稿コメント: `listCommentsByUser(uid, { limit: 50 })` （後でページネーション要検討）。  
        - いいねしたアルバム数 (任意): likes where userId == uid → size （初期版は後回しでも可）。  
    17-2. リポジトリ拡張:  
        - `albumRepo.listAlbumsByOwner(ownerId: string): Promise<any[]>` → collection(albums) where ownerId==X orderBy(createdAt,'desc').  
        - `imageRepo.listAlbumIdsByUploader(userId: string): Promise<string[]>` → albumImages where uploaderId==X → albumId を Set で重複排除。  
        - `commentRepo.listCommentsByUser(userId: string, limitCount = 50): Promise<any[]>` → comments where userId==X orderBy(createdAt,'desc') limit(limitCount)。インデックス必要時はフォールバック。  
        - （任意）`likeRepo.countLikedAlbumsByUser(userId)`：likes where userId==X → albumId を Set.size（後工程）。  
    17-3. UI 構成案 (`app/u/[id]/page.tsx`):  
        - Header: displayName / UID / bio。本人なら編集ボタン（後工程）。  
        - Stats 行: 作成アルバム数 / 参加アルバム数 / コメント数 / (いいね数) を小さなカード表示。  
        - セクション:  
            (A) 作成アルバム: タイトル + 画像数(後で) / createdAt。リンク→ `/album/{id}`。  
            (B) 参加アルバム: 同上。自分がオーナーのものは除外。  
            (C) 投稿コメント: 先頭数十件を表示（body + 対象アルバムリンク）。  
        - ローディング: 全体で最初読み込み中 → 部分読み込みを分離する拡張余地。  
        - エラー: いずれか失敗時に個別セクション内へメッセージ表示 + 再試行ボタン。  
    17-4. 型/契約:  
        - `ProfileData { user, ownAlbums, joinedAlbums, comments, stats }`。stats: `{ ownCount:number; joinedCount:number; commentCount:number; likedCount?:number }`。  
    17-5. パフォーマンス注意: joinedAlbums 取得時に albumIds が多い場合は batch get が増える → 後で Cloud Function でユーザー参加アルバムリストを集計キャッシュ可能。  
    17-6. インデックス注意: comments where userId + orderBy(createdAt) は `userId+createdAt` の複合インデックスが必要。missing 時は orderBy を外してクライアントソート。  
    17-7. テストシナリオ:  
        1) 作成アルバムが表示される / 件数が stats と一致。  
        2) 参加アルバムに自分の作成アルバムが重複表示されない。  
        3) コメント一覧が最大50件表示される。  
        4) 空ユーザー（活動なし）で各セクションが空メッセージ表示。  
        5) エラー（ネットワーク遮断）でセクション単位再試行ボタン動作。  
    17-8. 拡張案:  
        - タブUI / Lazy load / Infinite scroll。  
        - プロフィール編集（アイコンアップロード / bio 編集）。  
        - 共通統計キャッシュ (likeCount 合計 / 最近の活動タイムライン)。  
        - SSR 化 & Edge キャッシュ（公開プロフィール高速表示）。  
        - アクセス制御: フレンド限定項目 (参加アルバムなど) の段階的非表示。  
    17-9. アクセシビリティ: セクション見出しを `<h2>`、統計カードに `aria-label="作成アルバム数"` など付与。  
    17-10. フォールバック: 参加アルバム取得で 0 件かエラーのときはメッセージ表示し UI 維持（他セクションへの影響なし）。  
18. アクセス制御（最初はフロントで簡易）  
    - 目的: 非公開ロジック強化前の暫定ガード。ビュー側で owner/friend/watch による可視性と操作権限を制御し、後段で Firestore ルールに反映するための土台を作る。  
    - 表示条件 (Album 詳細): `(isOwner || isFriend || isWatcher)` を満たす場合のみ本文表示。満たさない場合は簡易メッセージ「閲覧権限がありません」。未ログインならログイン誘導。  
    - 画像追加条件: `isOwner || isFriend`（watcher は閲覧のみ）。削除条件は既存通り `(isOwner || image.uploaderId == currentUser.uid)`。  
    - コメント/いいね条件: 閲覧許可がある場合はいいねボタン表示。コメント投稿は `isOwner || isFriend` に限定（暫定）。初期バージョンは緩めて watcher もコメント可としてもよいが後で絞る。  

    【具体的実装手順】  
    18-1. 判定取得: アルバム詳細ページで `album.ownerId` を基点に以下並列取得。  
        - フレンド判定: `getFriendStatus(viewerUid, ownerId)` および逆向き → どちらか accepted なら `isFriend = true`。  
        - ウォッチ判定: `isWatched(viewerUid, ownerId)` → true なら `isWatcher = true`。  
        - オーナー判定: `album.ownerId === viewerUid`。  
    18-2. Hook 化（任意）: `useAlbumAccess(albumOwnerId)` を作り、`{ isOwner, isFriend, isWatcher, loading }` を返却。再利用性向上。  
    18-3. UI ガード: 読み込み完了後に `(isOwner || isFriend || isWatcher)` が false → 権限メッセージを返して他要素レンダリングを中断。  
    18-4. 権限別表示:  
        - 画像追加フォーム: `isOwner || isFriend` のみ。  
        - コメント投稿フォーム: 同上（段階的公開を想定）。  
        - アルバム編集フォーム: `isOwner` のみ（既存）。  
    18-5. エラー戦略: 判定クエリ失敗時（ネットワーク等）は Conservative に表示を拒否しメッセージ + 再試行。  
    18-6. Firestore ルール拡張（後工程案）:  
        - albums 読み取り: 現在公開 (read: if true) → 将来 `(isOwner(request.auth.uid) || isFriendWithOwner(request.auth.uid, resource.data.ownerId) || isWatchedOwner(request.auth.uid, resource.data.ownerId))` に変更。  
        - comments create: `(isOwner || isFriend)` 条件へ。  
        - albumImages create: `(isOwner || isFriend)` 条件へ。  
        - Cloud Functions による friend/watch 判定キャッシュドキュメントを利用しルール式を簡潔化。  
    18-7. インデックス: 判定取得は単一ドキュメント参照か単純 where で複合インデックス不要。friends の accepted 状態は ID が `userId_targetId` 形式であれば doc.get 一回で判定可能（将来最適化）。  
    18-8. テストシナリオ:  
        1) オーナーが閲覧 → 全操作可。  
        2) フレンドが閲覧 → 画像追加/コメント可能。  
        3) ウォッチャーが閲覧 → 画像追加ボタン非表示 / コメントフォーム非表示（仕様選択に応じて）。  
        4) 非関係ユーザーが直接 URL アクセス → 権限メッセージ表示。  
        5) 未ログインユーザー → ログイン誘導表示。  
        6) 友達解除後リロード → 画像追加フォームが消える。  
    18-9. 拡張案:  
        - 公開/限定/非公開アルバムフラグによる柔軟アクセス。  
        - ミュート/ブロック機能で表示除外。  
        - SSR 時にアクセストークン検証 & 403 レスポンス。  
    18-10. セキュリティ注意: クライアント側制御のみでは改ざん可能。早期に Firestore ルールへ移植し二重防御。  
19. Firestore セキュリティルール（強化計画）  
        - 目的: フロント側ガード(18章)をデータ層で強制し不正操作/スパム/改ざんを阻止。公開/限定/非公開モードや rate limit 追加の足場。  
        - 当面の方針: Read は初期公開維持 / Write を厳格化 → 後で visibility 追加時に read 条件を切替。  
    
        【関数案】  
        ```
        function authed() { return request.auth != null; }
        function isOwner(albumId) {
            return get(/databases/$(db)/documents/albums/$(albumId)).data.ownerId == request.auth.uid;
        }
        // 双方向どちらか accepted ならフレンド扱い
        function isFriend(targetUid) {
            return (
                exists(/databases/$(db)/documents/friends/$(request.auth.uid + '_' + targetUid)) &&
                get(/databases/$(db)/documents/friends/$(request.auth.uid + '_' + targetUid)).data.status == 'accepted'
            ) || (
                exists(/databases/$(db)/documents/friends/$(targetUid + '_' + request.auth.uid)) &&
                get(/databases/$(db)/documents/friends/$(targetUid + '_' + request.auth.uid)).data.status == 'accepted'
            );
        }
        // ウォッチ: 一方向存在
        function isWatchedOwner(ownerUid) {
            return exists(/databases/$(db)/documents/watches/$(request.auth.uid + '_' + ownerUid));
        }
        ```
    
        【write 権限詳細】  
        - albums create: `authed()`  
        - albums update/delete: `authed() && resource.data.ownerId == request.auth.uid && resource.data.ownerId == request.resource.data.ownerId` (ownerId 改ざん禁止)  
        - albumImages create: `(authed() && (isOwner(request.resource.data.albumId) || isFriend(get(/databases/$(db)/documents/albums/$(request.resource.data.albumId)).data.ownerId)))`  
        - albumImages delete: `(authed() && (resource.data.uploaderId == request.auth.uid || isOwner(resource.data.albumId)))`  
        - comments create: `(authed() && (isOwner(request.resource.data.albumId) || isFriend(get(/databases/$(db)/documents/albums/$(request.resource.data.albumId)).data.ownerId)))`  
        - comments update/delete: `(authed() && (resource.data.userId == request.auth.uid || isOwner(resource.data.albumId)))`  
        - likes create: `authed() && request.resource.data.userId == request.auth.uid` / delete: `authed() && resource.data.userId == request.auth.uid`  
        - friends create: `authed() && request.resource.data.userId == request.auth.uid`  
        - friends update(承認): `authed() && (request.resource.data.userId == request.auth.uid || request.resource.data.targetId == request.auth.uid)`  
        - watches create: `authed() && request.resource.data.userId == request.auth.uid && request.resource.data.userId != request.resource.data.ownerId`  
        - watches delete: `authed() && resource.data.userId == request.auth.uid`  
    
        【フィールド制約 (必要時)】  
        - likes/comment: 余分フィールド禁止 → `request.resource.data.keys().hasOnly(['albumId','userId','createdAt'])`  
        - albums update: タイトル/場所URLのみ許可 → keys 差分チェック（初期は省略可）  
    
        【テスト (Emulator)】  
        1) オーナー更新 OK / 他ユーザー更新 DENY  
        2) フレンド画像追加 OK / 非フレンド DENY  
        3) ウォッチャー画像追加 DENY（閲覧のみ）  
        4) コメント投稿: フレンド OK / 非フレンド DENY  
        5) likes userId 偽造作成 DENY  
        6) SELF_WATCH DENY  
        7) ownerId 改ざん更新 DENY  
    
        【性能注意】  
        - exists/get 呼び出し増 → read コスト増。必要になったら `relations/{uid}` キャッシュドキュメントで friendIds / watchedOwnerIds をまとめる。  
    
        【拡張案】  
        - album に `visibility: 'public'|'social'|'private'` 追加して read 条件を切替  
        - rate limit: Cloud Functions + カウンタ (最近 N 分の書込み数) をルール参照  
        - ブロック機能: blocks コレクション存在時は isFriend/isWatched を上書き拒否  
    
        【導入手順】  
        1) 現行ルールバックアップ  
        2) Emulator に新ルール反映→テスト通過  
        3) 本番デプロイ→ deny ログ監視 24h  
        4) visibility / キャッシュ設計を次フェーズで導入  
20. 4枚/ユーザー判定実装例  
    【具体的実装手順】  
    20-1. Repository レイヤー: `lib/repos/imageRepo.ts` にて `albumImages` コレクションを `where('albumId','==',albumId)` + `where('uploaderId','==',uploaderId)` でクエリし、`snap.size >= 4` の場合は `throw new Error('LIMIT_4_PER_USER')` とする（実装済み確認／未導入なら追加）。  
    20-2. 追加前チェック: 画像アップロード開始前に `await canUploadMoreImages(albumId, currentUser.uid)` を呼び、false の場合は即座に UI で拒否。関数は上記クエリを再利用し boolean を返す。  
    20-3. UI 側 (`app/album/[id]/page.tsx` など): 現在の `images` 状態から `残り枚数 = 4 - 自分の投稿枚数` を算出し、0 以下ならファイル選択/追加ボタンを disabled にする。サーバー側チェックに引っかかった場合はエラートーストを表示し state をロールバック。  
    20-4. 新規アルバム作成フロー (`lib/services/createAlbumWithImages.ts`): 複数ファイルアップロード時は最初に `files.length > 4` を弾き、その後各ファイルをループする際に `addImage` 実行前に残枚数を確認（ownerId で 4 枚を超えるケースを防止）。  
    20-5. エラーメッセージ: `translateError` に `LIMIT_4_PER_USER` を追加し、「1つのアルバムに投稿できる画像は各ユーザー4枚までです」と表示。  
    20-6. 手動テスト: 自分のアルバムに 4 枚追加 → 5 枚目で UI が無効化されること / 別ユーザーで同アルバムに 4 枚追加 → 5 枚目でエラーが発生し Firestore に保存されないことを確認。  
    20-7. 将来拡張: Firestore 側でルールを追加し、`albumImages` 書き込み時に Cloud Functions またはセキュリティルールで 4 枚制限を二重に enforce する案も検討。
21. UI コンポーネント実装順  
    【具体的実装ロードマップ】  
    21-1. ボタン類（ログイン / アルバム作成）  
        - 目的: どのページからでも主要アクションへ遷移できる導線を確保。  
        - 対応ファイル: `components/Header.tsx`, `app/login/page.tsx`, `app/(timeline)/page.tsx` 等。  
        - 実装手順:  
            1) 共通 `PrimaryButton` / `SecondaryButton` を `components/ui/Button.tsx` に用意（variant, size, loading state を props で制御）。  
            2) ヘッダー内ログイン/ログアウト/アルバム作成ボタンを上記コンポーネントへ差し替え、`useRouter` で遷移。  
            3) `/album/new` へのリンクボタンは `disabled={!user}` とし、`aria-disabled` も設定。  
            4) Storybook もしくは簡易スナップショットテスト（任意）でデザイン崩れを検証。  
    21-2. アルバムカード（画像グリッド・場所URL表示）  
        - 目的: タイムライン/プロフィールで共通表示されるアルバム一覧 UI を整備。  
        - 対応ファイル: `components/AlbumCard.tsx`, `app/timeline/page.tsx`, `app/u/[id]/page.tsx`。  
        - 実装手順:  
            1) `AlbumCard` コンポーネントを新規作成し props で `{ id, title, owner, firstImageUrl, placeUrl, likeCount?, commentCount? }` を受け取る。  
            2) 画像は `next/image` を利用し、無い場合はプレースホルダーを表示。  
            3) 場所URLが存在する場合は外部リンクアイコン付きで `target="_blank" rel="noreferrer"`。  
            4) タイムライン/プロフィールでは Firestore から取得したデータを `AlbumCard` に map する。  
            5) スケルトン表示を導入し、読み込み中は `animate-pulse` なダミーカードを並べる。  
    21-3. コメントリスト / 入力欄  
        - 目的: アルバム詳細ページのコメント UI を再利用可能なブロックへ分離。  
        - 対応ファイル: `components/comments/CommentList.tsx`, `components/comments/CommentForm.tsx`, `app/album/[id]/page.tsx`。  
        - 実装手順:  
            1) 現在ページ内にあるコメント描画ロジックを `CommentList` へ切り出し（props: comments, currentUserId, onEdit, onDelete, isOwner）。  
            2) 投稿フォームは `CommentForm` として `value`, `onSubmit`, `busy`, `maxLength` 等を props で受け渡し。  
            3) Tailwind のフォームスタイルを統一し、`wrap-break-word` など共通ユーティリティを適用。  
            4) エラーメッセージ領域は `role="alert"` を付与しアクセシビリティを担保。  
            5) 将来リアルタイム購読を他ページで使い回せるよう、コメント関連ロジックをカスタムフック (`useAlbumComments`) に整理。  
    21-4. フレンド/ウォッチ操作ボタン  
        - 目的: プロフィールページでの関係操作を一元化し UX を統一。  
        - 対応ファイル: `components/profile/FriendActions.tsx`, `components/profile/WatchActions.tsx`, `lib/repos/friendRepo.ts`, `lib/repos/watchRepo.ts`。  
        - 実装手順:  
            1) それぞれのコンポーネントで `status` / `loading` / `onAction` を props で受け取る汎用ボタン群を作成。  
            2) `useFriendship(profileUid)` フックを実装し、`sendFriendRequest`, `cancel`, `accept`, `remove` を返却。  
            3) 同様に `useWatch(profileUid)` フックで `toggleWatch` を提供、楽観的更新とエラーリカバリを標準化。  
            4) プロフィールページではフックから得た状態をボタンコンポーネントへ渡して描画。  
            5) 状態ラベルと説明テキストを `i18n` 用 dictionary へ登録し翻訳対応しやすくする（任意）。  
    21-5. プロフィールタブ（作成 / 参加 / コメント）  
        - 目的: `/u/[id]` の情報をタブ UI で整理し、Lazy Load でパフォーマンスを確保。  
        - 対応ファイル: `components/profile/ProfileTabs.tsx`, `components/profile/ProfileStats.tsx`, `app/u/[id]/page.tsx`。  
        - 実装手順:  
            1) Headless UI の `Tab` もしくは自前のタブコンポーネントを用意し、`tabs = [{ key:'own', label:'作成したアルバム', count }, ...]` の配列で構成。  
            2) 各タブ内容は `AlbumCard` または `CommentList` を利用して一覧表示。  
            3) データ取得は初回はまとめて行い、将来的に `useDeferredValue` や Suspense chunk で遅延ロードできるよう API を分割。  
            4) レスポンシブ対応: モバイルでは水平スクロールタブ、デスクトップでは中央揃え。  
            5) アクセシビリティ: `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls` を設定。  
    21-6. 品質チェック  
        - Storybook があれば `npm run storybook` で各コンポーネントの見た目を確認。  
        - `npm run lint` / `npm run test` / `npm run build` を順に実行し型エラーやビルド崩れがないか確認。  
        - Lighthouse（Chrome DevTools）で主要画面のパフォーマンスとアクセシビリティをざっくり把握。  
    21-7. 今後の拡張メモ  
        - ボタンやカードにデザインシステムを適用し、色や影をトークン化。  
        - タブを含むプロフィールレイアウトを SSR + ISR に対応させ表示速度を向上。  
        - 富豪効果を防ぐため、Skeleton → 実データへのスムーズな遷移アニメーションを追加。
22. 簡易テスト（手動）  
    - 新規ユーザー → アルバム作成 → 画像4枚追加 → 5枚目不可  
    - フレンド申請/承認 → 相手アルバムに画像追加可確認  
    - ウォッチ登録 → タイムライン表示確認  
    - コメント投稿/削除権限確認  
    - いいね往復確認
23. PostgreSQL を使う場合（後で移行可能）  
    - prisma init → schema.prisma に同等モデル作成 (User, Album, AlbumImage, Comment, Like, Friend, Watch)  
    - npx prisma migrate dev → API ルートで Prisma Client 使用  
    - 画像URL は同じく Firebase Storage
24. 改善余地メモ  
    - タイムライン取得最適化 (複合インデックス / サーバ側フィルタ)  
    - コメント編集履歴 / 通知  
    - フレンド承認ワークフロー UI 整備

## 手順: スプリント２

### アクセス権限
- ログインしていない場合は、ルート以外にアクセスしようとした場合は、ログイン画面に遷移するようにする。

### GUI
#### ヘッダー
- instaVRam の文字列を左右中央に
- ログイン・ログアウトボタンと、ユーザーボタンと、アルバム作成ボタンは、ハンバーガーメニューに入れる。

#### ダークモードとライトモード
- 目的: OS の自動判定に加えてユーザーが任意にテーマ (ライト/ダーク) を切り替え可能にし、UI の一貫性と操作感を向上させる。
- 実装方針: CSS 変数を `.theme-light` / `.theme-dark` クラスで上書きし、`localStorage` に保存された選択を優先。未選択時は `prefers-color-scheme` を初期値として採用。
- 追加CSS: `app/globals.css` に以下を追加
    - `:root.theme-light { --background: #ffffff; --foreground: #171717; --accent: #0d9488; --accent-hover: #0f766e; --accent-fg: #ffffff; --accent-ring: rgba(13,148,136,.4); }`
    - `:root.theme-dark { --background: #0a0a0a; --foreground: #ededed; --accent: #14b8a6; --accent-hover: #0d9488; --accent-fg: #ffffff; --accent-ring: rgba(20,184,166,.5); }`
    - 既存の `@media (prefers-color-scheme: dark)` は初期自動切替のフォールバックとして温存。
- UI変更: ハンバーガーメニュー末尾にテーマ切替ボタンを追加。
    - ラベル: 現在がダークなら「ライトモードへ」、ライトなら「ダークモードへ」。
    - クラス: `.btn-accent` を利用しアクセント統一。
- ロジック (Header.tsx):
    1. 初期化: `localStorage.getItem('theme')` を読み取り `dark|light` を決定。無ければ `matchMedia('(prefers-color-scheme: dark)')`。
    2. `useEffect` で `document.documentElement.classList` を操作し `theme-light` / `theme-dark` を付与 (既存クラス除去後)。
    3. 切替: `setTheme(t => t === 'dark' ? 'light' : 'dark')`。保存後メニューを閉じる。
- 永続化: `localStorage.setItem('theme', theme)`。
- アクセシビリティ: 切替ボタンに `aria-label="テーマ切替"` を付与。視覚ラベルは日本語表示。
- リスク/注意点:
    - SSR 初回描画時はライトを暫定表示後にクライアントでダークへ反映する可能性 (FART: Flash After Render of Theme)。必要なら `_document` でインラインスクリプトを挿入し初期クラス付与する改善余地。
    - `@media` とクラスの競合: クラス定義が後勝ちのため問題なしだが、追加のテーマ変種導入時は順序確認。
- 拡張余地:
    - システム設定に再同期する「自動」モード (third state)。
    - `theme-[name]` を増やし将来ブランド別ダーク/ライト (例: high-contrast)。
    - `prefers-reduced-motion` やコントラストモード連動。

#### カラーパレット
- 目的: アクセントカラーを 1 箇所（CSS 変数）で差し替え可能にし、将来ブランド色変更時の影響を最小化する。
- 実装方針: `app/globals.css` の `:root` でアクセント系変数を宣言し、UI ではユーティリティクラス (`.btn-accent`, `.link-accent`) のみを使用する。色を変えたい場合は変数を書き換えるだけで再ビルド不要（HMR反映）。
- 変数一覧:
    - `--accent`: 基本ボタン/リンクの背景・文字色計算基点 (Light: `#0d9488` / Dark: `#14b8a6`)
    - `--accent-hover`: ホバー時の濃い/暗い色 (Light: `#0f766e` / Dark: `#0d9488`)
    - `--accent-fg`: アクセント上の前景色（通常白 `#ffffff`）
    - `--accent-ring`: フォーカスリング用半透明色 (Light rgba(13,148,136,0.4), Dark rgba(20,184,166,0.5))
- ユーティリティクラス:
    - `.btn-accent`: アクセントボタン。padding/rounded/transition/disabled/focus-visible 標準化。
    - `.link-accent`: テキストリンク色 + hover 下線。
    - `.accent-ring`: Tailwind の ring を使わない場面向け focus-visible box-shadow。
- 使い方ガイド:
    1. 既存ボタンを Tailwind の色クラスから `.btn-accent` に差し替える。
    2. リンク強調は `.link-accent` を付与（下線は hover 時のみ）。
    3. 別サイズが必要ならラッパクラスで `padding` のみ上書きし、色関連クラスは再利用。
- 将来色変更手順: `globals.css` の `--accent` / `--accent-hover` / `--accent-ring` を新しい HEX/RGBA に変更 → 保存。コンポーネント側修正不要。
- ダークモード調整: `@media (prefers-color-scheme: dark)` 内でライト時より一段明るいトーンへ差し替え、コントラストを確保。
- リスク/注意点:
    - 直接 `bg-teal-...` などを使った古いコードが残っている場合は色変更時にズレが出る → 追って `.btn-accent` / `.link-accent` へ集約するリファクタ TODO。
    - 多彩なバリアント（outline / subtle / destructive 等）が必要になったら `--accent` を中心にトークンセット拡張 (`--accent-subtle`, `--accent-outline` など) を検討。
- 拡張余地: Tailwind の `theme.extend.colors` に `brand` を追加し `text-brand` / `bg-brand` で統一する案は後工程。初期は素の CSS 変数で十分。

#### 入力欄
- 枠ではなく、下線にした。

### 新規登録時に ID を設定可能に
- 設定可能にした
- 不適切表現を弾けるような機能を実装した。

### 新規登録時にパスワード入力を2回させる
- 入力2回
- 一致確認
- 強度の表示
- 表示非表示ボタン
- firebase側の設定で、パスワードの要件を設定。小文字と数字を必須にした。

### 登録時のフロー（ここ）
- 未登録状態
  - / か /login にしかアクセスできない。その他にアクセスすると、/ に飛ばされる。
  - アドレスとパスワードを設定することで、二段階認証の連絡が飛ぶ
- 仮登録状態
  - ログイン画面にしかアクセスができない
  - メールで届いたリンクをクリックすることで、次のステップに行ける。
  - 次のステップとして、ユーザー名・ユーザーID・パスワードを設定できる
- 本登録状態
  - 以上を終えて初めてログイン画面以外にもアクセスが可能となる。
  - まず初めにプロフィール画面に遷移する。


【具体的実装手順（Firebase × Next.js）】
1) Auth 設定（Firebase Console）
    - Authentication → サインイン方法 → Email/Password 有効化。
    - 「メールリンク (passwordless)」は今回は使用しない（通常の Email+Password＋メール検証）。
    - 許可ドメインにローカルと本番（例: `localhost`, `instavram3.vercel.app`）を追加。

2) フロント実装（登録: 仮登録＋検証メール送信）
    - 画面: `/login`（トップ `/` をログインにする仕様なら `/`）。モード切替で「新規登録」と「ログイン」。
    - 新規登録ボタン押下時フロー:
      1. `createUserWithEmailAndPassword(auth, email, tempPassword)` を実行（初期は仮パスワードでも可）。
      2. 直後に `sendEmailVerification(currentUser)` を呼び出し、検証メール送信。
      3. UI に「仮登録です／メール内のリンクをクリックしてください／再送リンク」を表示。`sendEmailVerification` 再実行で再送。
      4. ユーザーはこの時点では `user.emailVerified === false`。アプリ内のアクセスは制限（次項のミドルウェアで保護）。

3) ページアクセス保護（未登録/仮登録のアクセス制限）
    - Next.js ミドルウェア `middleware.ts` を追加し、ルート以外への未認証・未検証ユーザーのアクセスを遮断。
      - 擬似ロジック:
         - `getAuth()` はミドルウェアで直接使えないため、Cookie ベースのセッション（`firebase-auth` の ID トークン検証 or クライアント側で `emailVerified` を見てリダイレクト）を採用。
         - 初期版はクライアントサイドガードで十分: 各ページの `useEffect` で `!user` なら `/login` へ、`user && !user.emailVerified` なら `/login` へ。
      - ガードポリシー:
         - 未登録（未ログイン）: `/` or `/login` のみ。
         - 仮登録（email 未検証）: `/` or `/login` のみ。その他へ遷移しようとしたら `/` に戻す。

4) 検証リンククリック後の遷移
    - ユーザーがメールのリンクをクリックすると Firebase 側で `emailVerified=true` になる。
    - 画面側では `onAuthStateChanged` の購読で `user.emailVerified` を検出し、次のステップページへ遷移。
    - 次ステップのページ（例: `/register/complete`）で「ユーザー名（displayName）」「ユーザーID（handle）」「パスワード設定/変更」を入力させる。

5) 次ステップページ（プロフィール基本設定）
    - 入力項目: displayName（40文字上限）, handle（英数字+_ 3〜20, 重複不可）, 新パスワード（2回入力＋強度表示）。
    - バリデーション:
      - handle 重複: `where('handle','==',value)` で存在チェック。失敗時は「使用不可」。
      - パスワード: 長さ>=6、強度メーターで可視化。2回一致必須。
    - 保存処理:
      1. `updateProfile(auth.currentUser, { displayName })` を呼び表示名更新。
      2. Firestore `users` に `{ uid, displayName, handle, createdAt }` を保存（`ensureUser` 相当の関数で作成/更新）。
      3. パスワードは `updatePassword(auth.currentUser, newPassword)` を実行。
    - 完了後 `/user/{handle}`（プロフィール）へ `router.push`。

6) 本登録状態の扱い
    - 判定: `user && user.emailVerified === true` かつ Firestore `users` に必要フィールド（handle）が存在。
    - 初回ログイン時に `users` に必要データが無ければ次ステップへ誘導。以後、通常画面（タイムライン/プロフィール/アルバム）へアクセス可能。

7) 再送・失敗時対処
    - 検証メールが届かない: `sendEmailVerification` を再度呼び出すための UI（「再送」ボタン）。
    - リンク期限切れ/無効: 再送を案内。
    - 強制更新: `await reload(auth.currentUser)` で `emailVerified` の反映を促す。

8) セキュリティ・注意点
    - ミドルウェア導入の本番版では ID トークンをサーバ側検証して SSR でも保護する（初期はクライアントガードでOK）。
    - プロフィール必須フィールド（handle）はユニーク制約（アプリ側）。同時登録競合は後で Cloud Functions による原子作成へ拡張可能。
    - パスワード更新は再認証が必要になる場合あり。エラーコードを `translateError` でユーザー向け文言に変換。

9) 画面遷移例まとめ
    - 新規登録押下 → 仮登録状態になり検証メール送信 → `/login` に「仮登録です／リンクをクリックしてください」を表示。
    - 検証リンククリック → `emailVerified=true` → 自動で `/register/complete`（次ステップ）へ遷移。
    - 次ステップで displayName/handle/新パスワードを設定 → 保存 → `/user/{handle}` に遷移。


### プロフィール拡充
- 自己紹介文
- VRChat のURLを１つまで
- その他URLを３つまで
- 言語
- 性別
- 年齢
- 住んでいる場所
- 生年月日
- 編集も可能に

### 検索
- ハンバーガーメニューにユーザー検索リンクを設定
- 検索画面を作成
  - 上部に検索窓
  - 入力ごとに候補を表示
- 検索する内容とリンク先は以下の通り
  - プロフィールへのリンク
    - ユーザー名
    - ハンドル(@名)
  - アルバムへのリンク
    - アルバム名
    - アルバムの説明
    - コメント
- それぞれを一列に、合計2列に表示する

実装手順（具体）
1) ルーティング/リンク追加
- `components/Header.tsx` のハンバーガーメニューに `検索` を追加し、遷移先を `/search` に設定。
- 将来案: 常時表示の検索アイコン（右上）に差し替え可能（本章のUIをそのまま流用）。

2) 画面構成 `app/search/page.tsx`
- クライアントコンポーネント。
- 画面上部: 検索入力（`<input>`）。入力は 250ms デバウンスし、空白はトリム、小文字化して検索クエリにする。
- 入力中は直下に候補（サジェスト）を即時表示。Enter で確定、または入力確定でも随時更新。
- 下段は結果表示エリア（2カラムレイアウト）。

3) 検索仕様（クエリ）
- 前処理: `q = input.trim().toLowerCase()`。`q.length === 0` の場合は何も検索せず、最近検索やヒントを表示。
- ハンドルショートカット: 入力が `@` から始まる場合は handle 優先検索（`q = q.slice(1)`）。
- ユーザー検索（プロフィールにリンク）
    - 目的フィールド: `displayNameLower`（表示名の小文字）/ `handleLower`。
    - 実装: Firestore 単一フィールドの前方一致疑似検索（`orderBy(field)`, `startAt(q)`, `endAt(q + '\uf8ff')`）。
    - 上限: 各 20 件まで取得し、マージ・重複排除（handle を主キーに）。
    - リンク先: `/user/{handle}`。
- アルバム検索（アルバムにリンク）
    - 目的フィールド: `titleLower`, `descriptionLower`。
    - 同様の前方一致で最大 20 件ずつ取得し、IDでマージ・重複排除。
    - リンク先: `/album/{albumId}`。
- コメント経由のアルバムヒット
    - 目的フィールド: `bodyLower`（コメント本文の小文字）。
    - 前方一致で最大 20 件取得 → `albumId` を抽出し、重複排除 → 不足アルバムは `getDoc` でまとめて取得。
    - UIでは説明の代わりに「💬 コメント抜粋」をスニペット表示（適宜 `...` 省略）。

4) データ準備（小文字フィールド）
- 既存コレクションに以下の小文字フィールドを保持する方針：
    - `users`: `displayNameLower`, `handleLower`
    - `albums`: `titleLower`, `descriptionLower`
    - `comments`: `bodyLower`
- 新規作成/更新時にリポジトリ層で自動付与（保存時に `.toLowerCase()` して格納）。
- 既存データ移行は一度きりのスクリプト/管理画面でバッチ適用（後回し可、徐々に自然更新でも実用可能）。

5) UIレイアウト/表示
- 2カラム（`sm:` 以上）: 左「ユーザー」、右「アルバム」。`xs` では縦積み。
- 各アイテムは一行表示で省略（`truncate`）。
    - ユーザー: `displayName @handle`（`/user/{handle}` にリンク）。
    - アルバム: `title — description（またはコメント抜粋）`（`/album/{id}` にリンク）。
- セクション見出しに件数表示、0件時は「該当なし」。
- 候補（サジェスト）は入力欄直下に最大5件（ユーザー/アルバム混在でもOK、またはタブ切替）。

6) パフォーマンス/UX
- 入力は 250ms デバウンス。直前の検索はキャンセル（stale 応答は破棄）。
- 各カテゴリ 20件上限・合計 60件程度まで。必要なら「さらに表示」リンクで詳細ページへ（後続）。
- ローディングインジケータ、No Results、エラー表示（`translateError`）。
- '@' から開始した場合は handle  prefix のみ検索し高速化。

7) Firestore ルール/インデックス
- 全て公開情報の読み取り想定（現行ルール準拠）。
- 前方一致は単一フィールド `orderBy` で可能。基本は単一フィールドインデックスで足りる想定。Firestore からインデックス作成リンクが提示された場合はそれに従う。
    - 例: users: `displayNameLower`, `handleLower` の単一フィールドインデックス
                albums: `titleLower`, `descriptionLower`
                comments: `bodyLower`

8) テスト観点
- 大文字/小文字混在、`@handle` 検索、前後空白、記号混入。
- 0件時表示、候補選択での遷移、Enter確定、モバイルレイアウト。
- コメント由来ヒットでアルバムが重複せず表示されること。
- 連打・連続入力でもフリーズやレート制限が起きないこと（デバウンス/キャンセル確認）。

9) 実装タスク（最小）
- ルーティング/リンク: Header 修正（`/search`）。
- 画面: `app/search/page.tsx` 作成（入力/候補/結果2カラム）。
- リポジトリ: `lib/repos/searchRepo.ts` 追加（ユーザー/アルバム/コメント検索）; 既存 save/update に lower フィールド付与。
- スタイル: トランケート、2カラムグリッド、ローディング/空状態。
- 追加（任意）: 既存データ移行スクリプト（小文字フィールド投入）。


### ハンバーガーメニューではなく、端にアイコンで常時表示（TODO）


### プロフィールアイコン設定（TODO）


### ユーザーの削除
- 目的: 本人が自分のアカウントと関連データを安全に削除できるようにする。
- スコープ:
  - Firebase Auth ユーザー本体
  - Firestore: `users/{uid}`、当人が作成/関与したデータ（albums, albumImages, comments, likes, friends, watches, notifications など）
  - Storage: （将来 Storage を使う場合）当人がアップロードしたファイル

【設計方針】
1) セーフティレイヤ
    - 二重確認モーダル（「この操作は取り消せません」）。
    - 直前の再認証（Re-auth）。パスワード/Google それぞれの再認証フローに対応。
    - 進捗表示と部分失敗時のリトライ/再開可能性（ページ離脱の抑止）。

2) 実装戦略（2択）
    - A. クライアント主導削除（最小実装）
      - 手順: Firestore で当人のドキュメント群をクエリ→分割削除→最後に Auth ユーザーを `deleteUser`。
      - 前提: Firestore ルールが本人の削除を許可（本プロジェクトの現行ルールは概ね許容。`notifications` の delete は不可＝残置でOK）。
      - 注意: 500 件/バッチ制限あり。コレクションごとにページングして削除。
    - B. Cloud Functions（Admin）で一括削除（推奨）
      - `functions:callable` or HTTPS で `deleteUserData` を実装。Admin SDK で横断削除 + Auth 削除まで行う。
      - 利点: ルール制約を受けず確実・高速。クライアントのネットワーク/拡張機能の影響を受けにくい。
      - 追加: App Check/ロール制御で濫用防止。再認証済みトークンの検証。

【削除対象とクエリ】
- users: `users/{uid}`（本人）
- albums: `where('ownerId','==', uid)` → ドキュメント削除
- albumImages: `where('uploaderId','==', uid)` → 削除
- comments: `where('userId','==', uid)` → 削除
- likes: `where('userId','==', uid)` → 削除
- friends: 当人が `userId` の行、当人が `targetId` の行 → いずれも削除
- watches: `where('userId','==', uid)` と `where('ownerId','==', uid)` → 双方向で削除
- notifications:
  - 当人宛（`where('userId','==', uid)`）は削除したいが、現行ルールは `delete:false`。方針:
     - クライアント実装Aの場合: 残置（履歴として保持）。
     - Functions実装Bの場合: Admin SDK で削除可（後述の関数で対応）。
- Storage（将来）: パス設計に応じて `listAll`→`delete`。現状は DataURL 保存のため対象外。

【クライアント主導の削除フロー（A）】
1. UI
    - 場所: プロフィール画面（`/user/{handle}`）または「設定」ページに「アカウントを削除」ボタン。
    - クリック → 確認モーダル（チェックボックス「理解しました」+ 二重確認）
2. 再認証
    - Email/Password: `reauthenticateWithCredential`
    - Google: `reauthenticateWithPopup`
3. Firestore 削除（順序）
    - likes → comments → watches → friends → albumImages → albums → users の順でページング削除（1回 max 300〜450 件単位で安全に）。
    - 各コレクション: `query(..., limit(300))` → `getDocs` → `writeBatch` → `commit` をループ。
4. Auth 削除
    - `deleteUser(auth.currentUser)` を呼ぶ。
5. 完了
    - トースト「アカウントを削除しました」表示 → `/` へ遷移。
6. エラー復旧
    - 途中失敗は再試行可能。idempotent に設計（同じ削除を繰り返しても整合性が崩れない）。

【Cloud Functions（B）の削除フロー】
1. 関数
    - `functions/src/index.ts` に `exports.deleteUserData = onCall(...)` を実装。
    - サーバ側で以下を実施:
      - 上記「削除対象とクエリ」を Admin SDK で並列/分割削除（バッチ上限に注意）。
      - Admin Auth で `deleteUser(uid)`。
    - セキュリティ: `context.auth.uid` が対象 uid と一致すること、App Check 検証、レート制限。
2. クライアント
    - 再認証後、`httpsCallable('deleteUserData')({})` を呼ぶ → 成功ならサインアウト＆リダイレクト。
3. 進捗
    - callable の返り値で件数サマリを返す or ログID を返して進捗ポーリング。

【UI仕様（最小）】
- ボタン文言: 「アカウントを削除」
- モーダル本文: 「この操作は元に戻せません。作成したアルバム/コメント/いいね/フレンド/ウォッチは削除（通知は履歴として残る場合があります）。本当に削除しますか？」
- 確認操作: チェックボックス + 「削除」ボタン（二重確認）
- 完了後: トースト + `/` へ遷移

【ルール/権限の確認】
- comments/likes/watches/friends は本人なら delete 可（現行ルールでOK）。
- albums は ownerId == auth.uid のみ delete 可（OK）。
- users は `users/{uid}` を本人が delete 可（OK）。
- notifications は delete: false（残置方針 or Functionsでのみ削除）。

【擬似コード（A: クライアント）】
```
await reauthenticate();
for (const spec of [likes, comments, watchesUser, watchesOwner, friendsUser, friendsTarget, images, albums]) {
  while (true) {
     const qs = await getDocs(query(spec.base, spec.where, limit(300)));
     if (qs.empty) break;
     const batch = writeBatch(db);
     qs.forEach(d => batch.delete(d.ref));
     await batch.commit();
  }
}
await deleteDoc(doc(db, 'users', uid));
await deleteUser(auth.currentUser);
```

【テスト観点】
- データ件数 0/少量/大量での動作、途中失敗時の再実行、再認証必須フロー、ルール拒否が無いこと。
- friends 双方向の削除、watches の双方向削除確認。
- 通知が残る前提の文言整合（プライバシー方針）。

【将来拡張】
- 完全削除（notifications も含め Admin で完全抹消）。
- Soft delete（`users.deletedAt` を先に立てて UI 非表示→バックグラウンドで物理削除）。
- エクスポート機能（削除前にデータをダウンロード）。


### アルバムの削除
- 削除ボタンと、本当に？モーダルの実装


### 不具合の報告（TODO）
- メールアドレスを置いておく？ツイッターのDMでもいいか？

### issue: 画像をアップロードできない
- アルバムの作成は成功する。
- firebase のルールを修正し解決。

### ログイン画面の改修
- /login ではなく / をログイン画面にする
- ワンページで、左半分にそれっぽいワード、右半分に現状のログイン・新規登録の欄を


### タイムラインをツイッターに似せる
- タイムライン自体は1列の表示にする
- アルバムに表示する画像サムネイルは、画像の枚数によって、表示を変える
  - 1枚: 1枚だけ
  - 2枚: 1行2列で表示
  - 3枚: 2行に列だが、左1枚で右2枚
  - 4枚: 2行2列(田んぼの田状)
- 最新のコメントを下に表示
- いいね数を表示、いいね可能
- その場でコメント可能

【実装手順】
1) ページ構成
    - ルート: `app/timeline/page.tsx`（client）。1カラムの縦並びでカードを列挙（Tailwind: `max-w-2xl mx-auto space-y-6`）。
    - データ取得: `getLatestAlbums(50)` + 各アルバムの画像・コメント・likes を必要最小でまとめ取得。
      - 画像: `imageRepo.listImages(albumId)` → 枚数と先頭〜最大4枚のURLを得る。
      - 最新コメント: `commentRepo.listComments(albumId)` の末尾1件（昇順なら最後）または降順1件。
      - いいね数: `likeRepo.countLikes(albumId)`。

2) コンポーネント
    - `components/timeline/TimelineItem.tsx`
      - props: `{ album: AlbumDoc, images: { url:string; uploaderId:string }[], likeCount:number, latestComment?: { body:string; userId:string }, onLike:()=>void, liked:boolean, onCommentSubmit:(text:string)=>Promise<void>, submitting:boolean }`
      - レイアウト: ヘッダー（タイトル/owner/日時）→ 画像グリッド → アクション行（♡ と件数）→ コメント入力 → 最新コメント表示。

3) 画像グリッドレイアウト（枚数に応じた配置）
    - 1枚: `grid-cols-1` で1枚全幅（ratioはオブジェクトカバー）。
    - 2枚: `grid grid-cols-2 gap-1`。
    - 3枚: 左1枚・右2枚構成（CSS: 親を `grid grid-cols-3 gap-1` にし、左 `col-span-2 row-span-2` で大きく、右側に上下2枚）。
    - 4枚: `grid grid-cols-2 gap-1` を2行で均等（田状）。
    - 実装: 枚数を判定しスロットを埋めるヘルパー `renderGrid(images)` を作成。`next/image` を利用し `sizes` を適切に指定。

4) アクション & 状態
    - いいね: ボタンは `aria-pressed` を設定。未ログインは disabled。押下時は楽観的更新→`likeRepo.toggleLike` 実行→失敗時ロールバック。
    - コメント: 各アイテムに小さな入力欄を配置。enter送信 or ボタン押下で `commentRepo.addComment(album.id, user.uid, text)`。送信中は `submitting` 表示。
    - 最新コメント: 最も新しい1件をカード下部に小さく表示（ユーザー名は後工程で解決）。

5) スタイル指針（Tailwind）
    - カード: `rounded border p-3 surface`。画像は `overflow-hidden rounded`。
    - ボタン: `.btn-accent` を再利用。いいねは押下時ピンク系（独自クラスでも可）。
    - アクセシビリティ: `aria-label` を画像群/ボタンに付与、コメント入力に `aria-label="コメント入力"`。

6) 依存・ルール前提
    - Read は公開（`allow read: if true`）を想定。Write は認証必須。未ログインはボタン disabled。
    - 画像 URL は現状 DataURL、Storage 移行後は公開 read または署名URLで対応。

7) 実装の最小ステップ（タスク）
    - [A] `TimelineItem` を新規作成（ダミーデータで描画）
    - [B] `app/timeline/page.tsx` で albums を取得 → 画像/最新コメント/いいね数取得を `Promise.all` で並列化
    - [C] 画像グリッドヘルパーを導入し 1〜4 枚のパターンを実装
    - [D] いいねボタン（楽観的 + エラー復元）、コメント入力（送信中状態）を接続
    - [E] レスポンシブ確認（モバイル幅想定）と軽微な調整

8) 後工程（任意）
    - 画像の比率統一（サムネイル生成）
    - 最新コメントのユーザー名表示（`getUser(userId)` 併用）
    - likes のリアルタイム購読APIを `likeRepo.subscribeLikes(albumId)` で用意し件数の自動更新
    - 無限スクロール / ページネーション

### アルバム詳細画面の UI (TODO)
- 左半面が画像一覧、右に情報

### 通知
- ハンバーガーメニューにリンク
- 以下を通知
  - 他ユーザーのコメント
  - 他ユーザーのいいね
  - 他ユーザーのリポスト
  - 他ユーザーの写真追加
  - 他ユーザーのフレンド申請
  - 他ユーザーのウォッチ登録
- 通知画面は、以上の通知を1列に発生時刻の新しい順に並べる
- 未確認の通知は背景を少し色付けて
- 確認済みの通知は背景は特にいじらず
- 一度通知画面を開いたら、未確認の通知は確認済みに変更する
- 通知を確認できるのは本人だけ
- URL は /notification

#### 実装手順
1) コレクション定義
        - Firestore コレクション名: `notifications`
        - ドキュメント構造例:
            ```jsonc
            {
                "id": "auto id (doc.id)",
                "userId": "受信者ユーザーUID",          // 通知を受け取るユーザー
                "type": "comment|like|repost|image|friend_request|watch", // 種別
                "actorId": "行為者UID",                 // 誰が行ったか
                "albumId": "関連アルバムID (任意)",
                "imageId": "関連画像ID (任意)",
                "commentId": "関連コメントID (任意)",
                "friendRequestId": "フレンド申請ID (任意)",
                "watchId": "ウォッチID (任意)",
                "message": "UI表示用の短い文 (冗長ロジック回避)", 
                "createdAt": "Timestamp",              // 作成時刻
                "readAt": "Timestamp|null"             // 未読は null
            }
            ```
        - 最低限: `userId`,`type`,`actorId`,`createdAt` があれば表示は可能。関連 ID は type に応じて付与。

2) Firestore ルール追加（概念）
        ```
        match /notifications/{nid} {
            allow read: if request.auth != null && resource.data.userId == request.auth.uid; // 本人のみ閲覧
            allow create: if request.auth != null && request.resource.data.userId == request.auth.uid; // サーバレスでクライアントが直接書く場合
            allow update: if request.auth != null && resource.data.userId == request.auth.uid; // 既読化
            // delete: 原則不要 (履歴保持)。必要なら本人のみ許可。
        }
        ```
        - 実際には通知生成はフロントイベント後にクライアントから直接 `addDoc` する方式で十分（信頼が必要なら Cloud Functions 移行可）。

3) Repository レイヤー (`lib/repos/notificationRepo.ts` 新規)
        - `addNotification(payload)` → 種別に応じて message を生成し `addDoc`。
        - `listNotifications(limit = 100)` → `query(collection(db, COL.notifications), where('userId','==', uid), orderBy('createdAt','desc'), limit(limit))`。
        - `markAllRead()` → 未読のクエリをまとめて batched write で `readAt = new Date()` 設定。
        - `subscribeNotifications(onChange)` → 上記クエリに `onSnapshot` でリアルタイム購読し、ヘッダーの未読数バッジ更新。

4) イベント発生地点への組み込み
        - コメント追加 (`addComment`) 完了後: 対象アルバムの `ownerId != actorId` なら通知。
        - いいね追加 (`likeRepo` create) 完了後: 同様にアルバムオーナーへ通知（既に通知済み判定は不要。重複許容）。
        - リポスト（仕様に応じた処理後）: 原アルバムのオーナーへ。
        - 画像追加 (`addImage`) 後: アルバムオーナーと画像追加者が異なる場合に通知。
        - フレンド申請 (`friends` 作成) 後: 申請された側 (`targetId`) に通知。
        - ウォッチ登録 (`watches` 作成) 後: ウォッチされた側に通知。
        - これらをサービス層（例: `createAlbumWithImages` や各 UI ハンドラ）で非同期並列に実行。

5) 通知メッセージ生成ポリシー
        - シンプルな静的テンプレ: `actorHandle` を取得できる場合は利用。
        - 例:
            - コメント: `"@{actor} があなたのアルバムにコメントしました"`
            - いいね: `"@{actor} がアルバムをいいねしました"`
            - 画像追加: `"@{actor} がアルバムに画像を追加しました"`
            - フレンド申請: `"@{actor} からフレンド申請"`
            - ウォッチ: `"@{actor} があなたをウォッチしました"`
        - メッセージを保存しておくことで、表示時に追加クエリが不要 ⇒ パフォーマンス向上。

6) UI 実装 `/notification` ページ
        - クライアントコンポーネント: `NotificationsPage`
        - 初期ロード: `listNotifications()` で取得 → `useEffect` で `subscribeNotifications` を設定し差分反映。
        - レンダリング: 1列リスト（flex / space-y）。未読は `bg-yellow-50 dark:bg-gray-800` など薄い背景。
        - 各行クリックで関連画面へ遷移（アルバム/プロフィールなど）。
        - ページ初回マウント時に `markAllRead()` 実行（未読をまとめて既読化）。
        - 項目フォーマット: 時刻 + メッセージ + アイコン（typeごと）

7) ヘッダーへのバッジ
        - `useNotificationsBadge` フック新規: `subscribeNotifications` で未読件数を state に保持。
        - ハンバーガーメニューの通知リンクにバッジ `<span class="badge">{count}</span>` を条件表示。
        - 未読 0 件なら非表示。

8) インデックス最適化
        - 多頻度クエリ: `where('userId','==', uid) orderBy('createdAt','desc')` の複合インデックスを Firebase Console で確認し必要なら追加（自動提案に従う）。

9) パフォーマンス/負荷
        - 通知は多くても 1 日数十～数百と想定。古い通知はページ下部で「さらに読み込む」(次ページ) に切り替える余地あり。
        - 大量化したら: Cloud Functions で集約・`readAt == null` の件数を別フィールドにキャッシュ（`unreadCount`）。現段階は不要。

10) 将来拡張の余地
        - 通知分類タブ（コメント / ソーシャル / システム）
        - Web Push (FCM) 連携 → `type` 拡張 + トークン管理 + Functions トリガ。
        - 既読/未読の手動切替ボタン、全削除機能。

11) 実装順序推奨
        1. コレクションとルール追加
        2. `notificationRepo` 作成
        3. 生成ポイント（コメント・いいね等）にフック挿入
        4. `/notification` ページ UI
        5. サブスク + ヘッダーバッジ
        6. 既読化処理（ページ初回表示時）
        7. インデックス確認 & 微調整

12) エラーハンドリング指針
        - 通知生成失敗は本体操作（コメント投稿など）を阻害しない: `catch` して `console.warn`。
        - 未読化/既読化失敗時は再試行ボタン、あるいは次回ページアクセス時に再度試行。

#### 最低限必要ファイル（案）
```
lib/repos/notificationRepo.ts
app/notification/page.tsx
lib/hooks/useNotificationsBadge.ts
```

#### notificationRepo.ts 関数案（擬似コード）
```ts
export async function addNotification(n: NotificationInput) { /* addDoc */ }
export async function listNotifications(limit=100) { /* query */ }
export async function markAllRead() { /* batch update readAt */ }
export function subscribeNotifications(onChange) { /* onSnapshot */ }
```

#### 型案
```ts
export interface NotificationDoc {
    id: string;
    userId: string;
    type: 'comment'|'like'|'repost'|'image'|'friend_request'|'watch';
    actorId: string;
    albumId?: string; imageId?: string; commentId?: string;
    friendRequestId?: string; watchId?: string;
    message: string;
    createdAt: Date | any; // Firestore Timestamp
    readAt: Date | null | any;
}
```

### プロフィールにハッシュタグをつけて検索できる
- 検索の条件に増やせる

### リアクション絵文字（ここ）
- アルバムに対するいいねは、絵文字を選択することができます。
- WindowsやiOSで標準に装備する絵文字をいいねできます。
- DiscordやMiskyの機能が近いです。
- ひとりで複数の絵文字をいいねすることができます

実装手順（具体）
1) データモデル/コレクション
- `reactions` コレクションを追加（既存 `likes` はそのまま/将来統合）。
    - フィールド: `id`, `albumId`, `userId`, `emoji`, `createdAt`
    - 制約: 同一ユーザーは同一アルバムに対し同一絵文字を複数回は押せない（1件/emoji）。別絵文字は複数可。

2) Firestore ルール
- `reactions`:
    - create: `request.auth.uid == userId` かつ `(album.owner が閲覧可能)` 前提（公開アルバムなら可）。
    - delete: `request.auth.uid == userId` の本人のみ。update は不可（削除→再作成で対応）。
    - 重複防止はクライアントでIDに `albumId:userId:emoji` を採用し、既存時はエラーに。

3) リポジトリ `lib/repos/reactionRepo.ts`
- `toggleReaction(albumId, userId, emoji)`:
    - 事前に `docId = `${albumId}:${userId}:${emoji}`` を生成。
    - `getDoc` で存在チェック → あれば `deleteDoc`、無ければ `setDoc`（`createdAt: new Date()`）。
- `listReactionsByAlbum(albumId)`:
    - 該当アルバムの全リアクションを取得し、`emoji` ごとに `count` 集計＋自分が押したかフラグを返す。

4) UI（アルバム詳細 `app/album/[id]/page.tsx`）
- 既存「いいね」周辺に絵文字ピッカーを追加。
    - Webネイティブ絵文字の簡易ピッカー（例: よく使う数種をプリセット: 👍❤️🎉😆😮🙏⭐️ など）
    - 押下時に `toggleReaction` 実行、楽観的更新（即時 UI 反映、失敗時ロールバック）。
- 表示: 絵文字ごとのカウントバッジ + 自分が押した絵文字にはハイライト。

5) アクセシビリティ/入力方法
- PC: ボタン群クリック（ホバーでラベル表示）。
- モバイル: タップで追加/削除。長押しでピッカー展開（任意実装）。
- キーボード: Tab 移動＋Enterで反応可能。aria-label を付与。

6) パフォーマンス
- アルバム詳細表示時に `listReactionsByAlbum` を1回取得。
- サブスクライブ（任意）: `onSnapshot` で同アルバムのリアクションを購読し、リアルタイム更新。
- カウントはクライアント集計（上限問題が出たら Cloud Functions で集計キャッシュを検討）。

7) テスト観点
- 同一ユーザーが同一絵文字を二重に押せないこと（docId 衝突）。
- 複数絵文字は押せること（docId が異なる）。
- 削除でカウント減少＆ハイライト解除。
- 未ログイン時は押下不可（ログイン誘導）。
- 多端末で同時更新時に UI が正しく同期する。

8) 実装タスク（最小）
- `lib/repos/reactionRepo.ts` 追加（toggle/list）。
- アルバム詳細UIにピッカーとカウント表示を追加。
- Firestore ルールに `reactions` セクション追加。
- 任意: よく使う絵文字セットの定義を `lib/constants/reactions.ts` に用意。


## スプリント３：テストケースを考える・テストする
###


## 機能
- ユーザーは「アルバム」を作成できる。作成したユーザーはアルバムの「オーナー」と呼ばれる
- アルバムには画像を投稿できる。4枚/ユーザー。
- アルバムには、撮影場所（URL）を追加できる。
- オーナーは、たとえフレンドが追加した画像でも、削除することができる。
- アルバムにはオーナーがコメントを付けたり、編集したり、削除したりできる。
- アルバムにはフレンドがコメントを付けたり、削除したりできる。
- ユーザー間は「フレンド」という関係で関連付けることができる
- フレンドのアルバムには、画像を追加することができる
- 自分で追加した画像だけは、自分で削除できる。
- ユーザーは特定ユーザーのアルバムをタイムラインに表示できる。これを「ウォッチ」という。
- フレンドのアルバムに対して「コメント」と「いいね」ができる
- ユーザーは「タイムライン」「プロフィール」「アルバム作成・編集」「通知」の４つのウィンドウを遷移する
- タイムラインには、フレンド・ウォッチしているアルバムが更新されると、表示される
- プロフィールは、ユーザーのアイコン、自己紹介文、作成したアルバム、参加したアルバム、投稿したコメントを閲覧できる
- タイムライン・プロフィールのいずれの画面にも、アルバム投稿ボタンが常駐していて、それを押すと、新規アルバムを作成できる。
- 通知には、アルバムに画像が追加されたこと




## 展望
- 画像投稿
  - 撮影場所を設定可能
    - VRChat API を使用して、ワールド検索を可能に
    - VRChat API を使用して、フレンドの紐づけを可能に
- お気に入り機能
- リポスト機能
- プロフィール
  - アルバム機能
  - オンライン状況
  -