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
13. タイムライン表示 (/timeline)  
    - Firestore クエリ簡略版: 最初は全 albums orderBy(createdAt desc) → クライアント側で対象 (friends + watches + 自分) にフィルタ  
    - 後で最適化: ownerId in [...] クエリ（必要なら分割取得）
14. コメント機能  
    - アルバム詳細カードにコメント一覧表示 (comments where albumId)  
    - 投稿: フレンド or オーナーのみフォーム表示  
    - 削除: 自分のコメント or オーナー（仕様に合わせる）
15. いいね機能  
    - ハートボタン押下 → likes ドキュメント (albumId+userId) 追加  
    - 解除 → 削除  
    - 件数表示: likes where albumId の count
16. プロフィール (/u/[id])  
    - users 取得 → アイコン / 自己紹介  
    - 作成アルバム: albums where ownerId == id  
    - 参加アルバム: albumImages where uploaderId == id → albumId 一覧 → 重複除去して表示  
    - 投稿コメント: comments where userId == id  
17. アクセス制御（最初はフロントで簡易）  
    - アルバム詳細表示条件: (owner) or (friend) or (watch)  
    - 画像追加条件: owner or friend  
18. Firestore セキュリティルール（後で強化）  
    - request.auth != null を基本  
    - albums 書き込み: request.auth.uid == ownerId  
    - albumImages 追加: owner か friends コレクションで関係確認（最初は緩く→後カスタム）  
19. 4枚/ユーザー判定実装例  
    - albumImages where albumId == X and uploaderId == currentUser.uid を取得して length >= 4 ならアップロード拒否
20. UI コンポーネント実装順  
    - ボタン類（ログイン / アルバム作成）  
    - アルバムカード（画像グリッド・場所URL表示）  
    - コメントリスト / 入力欄  
    - フレンド/ウォッチ操作ボタン  
    - プロフィールタブ（作成 / 参加 / コメント）
21. 簡易テスト（手動）  
    - 新規ユーザー → アルバム作成 → 画像4枚追加 → 5枚目不可  
    - フレンド申請/承認 → 相手アルバムに画像追加可確認  
    - ウォッチ登録 → タイムライン表示確認  
    - コメント投稿/削除権限確認  
    - いいね往復確認
22. PostgreSQL を使う場合（後で移行可能）  
    - prisma init → schema.prisma に同等モデル作成 (User, Album, AlbumImage, Comment, Like, Friend, Watch)  
    - npx prisma migrate dev → API ルートで Prisma Client 使用  
    - 画像URL は同じく Firebase Storage
23. 改善余地メモ  
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