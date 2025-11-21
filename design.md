# Instavram 設計
## 概要
- ツイッター・インスタグラムライクにする

## 技術
- Next.js
- Firebase/PostgreSQL
- Tailwind CSS
- TypeScript

## 手順
### 初心者向け全体手順
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
            storageBucket: "instavram3.firebasestorage.app",
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

7. 共通レイアウト  
   - ヘッダー: ログイン状態 / プロフィール遷移 / アルバム作成ボタン常駐
8. アルバム作成フロー  
   - モーダル: コメント（200文字以内）+ 撮影場所URL（任意）+ 画像選択（最大4枚）  
   - 画像アップロード順: Storage へ put → ダウンロードURL → albumImages に保存 → albums 作成  
   - 同一 uploader がその album に既に 4 枚なら追加ボタン disabled
9. アルバム編集  
   - オーナーのみ: コメント編集 / 撮影場所編集 / 全画像削除可  
   - フレンド: 新規画像追加可（自分が追加した画像のみ削除可能）  
   - 画像削除条件: (owner) または (image.uploaderId === currentUser.uid)
10. フレンド機能  
    - プロフィールに「フレンド申請」ボタン → friends に {status:"pending"}  
    - 相手が承認すると status:"accepted"  
    - フレンド判定: 双方向 accepted (簡易) か一方向 accepted (ルール決めて実装)
11. ウォッチ機能  
    - 他ユーザーのプロフィールに「ウォッチ」ボタン → watches に保存  
    - タイムライン取得時: (自分がウォッチしている ownerId) + (自分のフレンドの ownerId) の albums を並べる
12. タイムライン表示 (/timeline)  
    - Firestore クエリ簡略版: 最初は全 albums orderBy(createdAt desc) → クライアント側で対象 (friends + watches + 自分) にフィルタ  
    - 後で最適化: ownerId in [...] クエリ（必要なら分割取得）
13. コメント機能  
    - アルバム詳細カードにコメント一覧表示 (comments where albumId)  
    - 投稿: フレンド or オーナーのみフォーム表示  
    - 削除: 自分のコメント or オーナー（仕様に合わせる）
14. いいね機能  
    - ハートボタン押下 → likes ドキュメント (albumId+userId) 追加  
    - 解除 → 削除  
    - 件数表示: likes where albumId の count
15. プロフィール (/u/[id])  
    - users 取得 → アイコン / 自己紹介  
    - 作成アルバム: albums where ownerId == id  
    - 参加アルバム: albumImages where uploaderId == id → albumId 一覧 → 重複除去して表示  
    - 投稿コメント: comments where userId == id  
16. アクセス制御（最初はフロントで簡易）  
    - アルバム詳細表示条件: (owner) or (friend) or (watch)  
    - 画像追加条件: owner or friend  
17. Firestore セキュリティルール（後で強化）  
    - request.auth != null を基本  
    - albums 書き込み: request.auth.uid == ownerId  
    - albumImages 追加: owner か friends コレクションで関係確認（最初は緩く→後カスタム）  
18. 4枚/ユーザー判定実装例  
    - albumImages where albumId == X and uploaderId == currentUser.uid を取得して length >= 4 ならアップロード拒否
19. UI コンポーネント実装順  
    - ボタン類（ログイン / アルバム作成）  
    - アルバムカード（画像グリッド・場所URL表示）  
    - コメントリスト / 入力欄  
    - フレンド/ウォッチ操作ボタン  
    - プロフィールタブ（作成 / 参加 / コメント）
20. 簡易テスト（手動）  
    - 新規ユーザー → アルバム作成 → 画像4枚追加 → 5枚目不可  
    - フレンド申請/承認 → 相手アルバムに画像追加可確認  
    - ウォッチ登録 → タイムライン表示確認  
    - コメント投稿/削除権限確認  
    - いいね往復確認
21. PostgreSQL を使う場合（後で移行可能）  
    - prisma init → schema.prisma に同等モデル作成 (User, Album, AlbumImage, Comment, Like, Friend, Watch)  
    - npx prisma migrate dev → API ルートで Prisma Client 使用  
    - 画像URL は同じく Firebase Storage
22. 改善余地メモ  
    - タイムライン取得最適化 (複合インデックス / サーバ側フィルタ)  
    - コメント編集履歴 / 通知  
    - フレンド承認ワークフロー UI 整備

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
  - ここじゃない？投稿
  - 私もいたよ！/私はいないよ投稿
  - リプライ機能
- お気に入り機能
- リポスト機能
- プロフィール
  - アルバム機能
  - オンライン状況
  -