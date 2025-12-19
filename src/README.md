## テスト (Jest + Testing Library)

このプロジェクトは Jest と React Testing Library を使ってコンポーネントのユニットテストを行えます。

セットアップ済みのファイル:

- `jest.config.js`: Next.js 用の設定ラッパ（`next/jest`）＋ jsdom 環境、有用なモジュールマッパー
- `jest.setup.ts`: `@testing-library/jest-dom` の読み込みと `next/navigation` の最小モック
- `tests/__mocks__/fileMock.js`: 画像等のアセットをテスト時にスタブ化
- `__tests__/HeartIcon.test.tsx`: サンプルテスト（アイコンの fill/stroke 切り替え）

インストール（開発依存）:

```bash
npm i -D jest@^29 jest-environment-jsdom@^29 @testing-library/react@^16 @testing-library/jest-dom@^6 @testing-library/user-event@^14 @types/jest@^29 identity-obj-proxy
```

実行:

```bash
npm run test
# 監視モード
npm run test:watch
```

補足:

- App Router のフック（`next/navigation`）は `jest.setup.ts` で最低限モックしています。必要に応じて各テストで上書きしてください。
- Firebase や外部 API を利用するコンポーネントは、テストで対象外にするか、モジュールモック（`jest.mock()`）をご利用ください。

This src/ tree hosts the layered architecture:

- app/ (Next.js App Router: views + controllers via route handlers/server actions)
- components/ (UI components: common + feature-sliced)
- constants/ (global constants)
- libs/ (library initializations/config, e.g., Firebase)
- models/ (domain models and view models)
- repositories/ (infrastructure adapters to DB/SaaS)
- services/ (application/use-case layer)
- utils/ (shared utility functions)

Migration will proceed feature-by-feature to avoid breaking changes.

Current services/ViewModels:

- Timeline
	- models: `src/models/timeline.ts`
	- service: `src/services/timeline/listLatestAlbums.ts`
	- usage: `app/timeline/page.tsx` 初期データ取得に利用、リアルタイム購読はページ側で維持

- Album Detail
	- models: `src/models/album.ts`
	- service: `src/services/album/getAlbumDetail.ts`
	- usage: `app/album/[id]/page.tsx` 初期データ取得に利用、コメント/いいね購読はページ側で維持

Route Handlers (server-side controllers):
- Images
	- `app/api/images/add/route.ts`：画像追加。Bearer トークン検証、オーナー/フレンドのみ許可、ユーザー上限（例: 4枚/人/アルバム）をサーバーで判定。
	- `app/api/images/delete/route.ts`：画像削除。Bearer トークン検証、オーナーは全削除可／フレンドは自分の画像のみ。
	- 使用箇所：`app/album/[id]/page.tsx`

- Likes
	- `app/api/likes/toggle/route.ts`：いいねのトグル。簡易レート制限（IPあたり 10req/分）＋フォールバックは既存リポジトリ側
	- 使用箇所：`app/timeline/page.tsx` / `app/album/[id]/page.tsx`

- Comments
	- `app/api/comments/add/route.ts`：コメント追加。簡易レート制限（IPあたり 10req/分）＋フォールバックは既存リポジトリ側
	- 使用箇所：`app/timeline/page.tsx` / `app/album/[id]/page.tsx`

- Reactions
	- `app/api/reactions/toggle/route.ts`：リアクショントグル。簡易レート制限（IPあたり 20req/分）＋フォールバックは既存リポジトリ側。APIは `{ added: boolean }` を返す（通知制御用）
	- 使用箇所：`app/timeline/page.tsx` / `app/album/[id]/page.tsx`

Auth

- サーバー側検証：`src/libs/firebaseAdmin.ts` で Firebase Admin を初期化し、Route Handler で Bearer トークンを検証（UID一致を確認）。
- クライアント送信：ページ側の fetch では `user.getIdToken()` を取得し `Authorization: Bearer <token>` を付与。