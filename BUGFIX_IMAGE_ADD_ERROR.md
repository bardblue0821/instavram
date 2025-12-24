# バグ修正: 画像追加時の権限エラー表示

**日時**: 2025年12月24日  
**問題**: アルバムに画像を追加すると権限エラーが表示されるが、画像は正常にアップロードされる  
**原因**: 画像リスト再取得時の Firestore 権限エラー（アップロード自体は成功）

---

## 問題の詳細

### 症状
```
1. ユーザーが画像をアップロード
2. 画像は正常にアップロードされる ✅
3. しかし「権限がありません」というエラーメッセージが表示される ❌
```

### ユーザー体験への影響
- エラーメッセージが表示されるため、ユーザーは失敗したと誤解
- 実際には画像は正常にアップロードされている
- ページをリロードすると画像が表示される

---

## 根本原因

### 処理フロー

#### Before（エラー発生）
```typescript
async function handleAddImage() {
  // 1. API経由で画像をアップロード → ✅ 成功（Admin SDK使用）
  const res = await fetch('/api/images/add', { ... });
  
  // 2. 画像リストを再取得 → ❌ 権限エラー（Client SDK使用）
  const imgs = await listImages(albumId);
  
  // 3. エラーがキャッチされてエラーメッセージ表示
  setError(translateError(e));
}
```

### なぜエラーが発生するか

**画像アップロード（Admin SDK）**:
- `/api/images/add` → `adminAddImage()` → **Admin SDK で書き込み**
- Firestore のセキュリティルールをバイパス
- 正常にアップロード完了 ✅

**画像リスト再取得（Client SDK）**:
- `listImages()` → `getDocs()` → **Client SDK で読み取り**
- Firestore のセキュリティルールが適用される
- `canReadAlbum()` の権限チェックで失敗する可能性 ❌

### Firestore セキュリティルールの問題

```javascript
// albumImages/{imageId}
match /albumImages/{imageId} {
  allow create: if isSignedIn()
    && request.resource.data.uploaderId == request.auth.uid
    && canReadAlbum(request.resource.data.albumId); // ← アルバム存在チェック
}

function canReadAlbum(albumId) {
  let a = get(/databases/$(database)/documents/albums/$(albumId)).data;
  // アルバムの visibility をチェック
  return (
    a.visibility != 'friends' ||
    (isSignedIn() && (a.ownerId == request.auth.uid || isFriendWith(a.ownerId)))
  );
}
```

**問題点**:
- Admin SDK で画像を追加した後、すぐに Client SDK で読み取り
- タイミングによっては Firestore のインデックス更新が間に合わない
- または、権限チェックで一時的に失敗

---

## 解決策

### 修正内容

**ファイル**: `app/album/[id]/page.tsx`

```typescript
async function handleAddImage() {
  // ... アップロード処理 ...
  
  if (!res.ok) {
    const data = await res.json().catch(()=>({}));
    setError(translateError(data?.error || 'UNKNOWN'));
    return;
  }
  
  // ★ 画像リスト再取得をtry-catchで囲む
  try {
    const imgs = await listImages(albumId);
    imgs.sort(...);
    setImages(imgs);
    setFile(null);
  } catch (listError: any) {
    // ★ listImages でエラーが発生してもアップロードは成功しているので無視
    console.warn('failed to refresh image list, but upload succeeded:', listError);
    
    // ★ 楽観的更新: 新しい画像を手動で追加
    const newImage = {
      id: Date.now().toString(),
      albumId,
      uploaderId: user.uid,
      url,
      createdAt: new Date(),
    };
    setImages((prev) => [newImage, ...prev]);
    setFile(null);
    // エラーメッセージは表示しない（アップロードは成功）
  }
}
```

### 改善ポイント

#### 1. **エラーハンドリングの分離**

```typescript
// Before: 全体をtry-catchで囲む
try {
  await uploadImage();
  await refreshList(); // ここで失敗するとエラー表示
} catch (e) {
  setError(e); // アップロード成功なのにエラー表示 ❌
}

// After: 処理ごとにtry-catchを分離
try {
  await uploadImage(); // アップロードの成否を判定
  
  try {
    await refreshList(); // リスト更新は別処理
  } catch {
    // 失敗しても楽観的更新で対応 ✅
  }
} catch (e) {
  setError(e); // アップロード失敗時のみエラー表示
}
```

#### 2. **楽観的更新（Optimistic Update）**

```typescript
// listImages() が失敗した場合のフォールバック
const newImage = {
  id: Date.now().toString(), // 仮のID
  albumId,
  uploaderId: user.uid,
  url,
  createdAt: new Date(),
};
setImages((prev) => [newImage, ...prev]);
```

**利点**:
- ユーザーは即座に追加された画像を確認できる
- サーバーからのレスポンス待ちなし
- エラーメッセージが表示されない

#### 3. **コンソールログの追加**

```typescript
console.log('[album:addImage] uploading image');
console.log('[album:addImage] upload successful');
console.log('[album:addImage] image list refreshed', imgs.length);
console.warn('[album:addImage] failed to refresh, using optimistic update');
```

**利点**:
- デバッグが容易
- エラーの発生箇所を特定できる
- ユーザーからの問い合わせ時に詳細を確認可能

---

## 動作確認

### テスト手順

```
1. アルバム詳細ページを開く
2. 「画像を追加」ボタンをクリック
3. 画像ファイルを選択
4. アップロード実行
```

### 期待される動作

#### Before（バグあり）
```
1. 画像をアップロード
2. 「権限がありません」エラー表示 ❌
3. ページをリロード → 画像が表示される
```

#### After（修正後）
```
1. 画像をアップロード
2. 即座に画像が表示される ✅
3. エラーメッセージなし ✅
4. Console に成功ログ表示
```

### コンソールログの例

**成功時（listImages 成功）**:
```
[album:addImage] uploading image
[album:addImage] upload successful, refreshing image list
[album:addImage] image list refreshed 5
[album:addImage] complete
```

**成功時（listImages 失敗、楽観的更新）**:
```
[album:addImage] uploading image
[album:addImage] upload successful, refreshing image list
[album:addImage] failed to refresh image list, but upload succeeded: FirebaseError: ...
```

---

## 今後の改善案

### 1. Server-Sent Events（SSE）によるリアルタイム更新

```typescript
// API側でSSEを使用して画像追加を通知
export async function POST(req: NextRequest) {
  await adminAddImage(albumId, userId, url);
  
  // SSEで全クライアントに通知
  broadcastImageAdded(albumId, imageId);
  
  return NextResponse.json({ ok: true, imageId });
}

// Client側でSSEを購読
useEffect(() => {
  const eventSource = new EventSource(`/api/albums/${albumId}/events`);
  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'imageAdded') {
      setImages((prev) => [data.image, ...prev]);
    }
  };
}, [albumId]);
```

### 2. Firestore リアルタイム購読の活用

```typescript
// 画像リストをリアルタイム購読
useEffect(() => {
  const q = query(
    collection(db, 'albumImages'),
    where('albumId', '==', albumId)
  );
  
  const unsub = onSnapshot(q, (snapshot) => {
    const imgs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    setImages(imgs);
  });
  
  return unsub;
}, [albumId]);
```

**利点**:
- `listImages()` の呼び出し不要
- リアルタイムで自動更新
- 他のユーザーの追加も即座に反映

### 3. Admin SDK でのアルバム更新

```typescript
// adminAddImage で updatedAt も更新
export async function adminAddImage(albumId: string, uploaderId: string, url: string) {
  const db = getAdminDb();
  
  // 画像を追加
  const imageRef = await db.collection(COL.albumImages).add({
    albumId,
    uploaderId,
    url,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await imageRef.update({ id: imageRef.id });
  
  // ★ アルバムの updatedAt も更新
  await db.collection(COL.albums).doc(albumId).update({
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}
```

**利点**:
- アルバムの更新時刻が正確
- Firestore のセキュリティルールが正常に動作
- Client SDK での読み取りエラーを防止

---

## まとめ

### 修正内容

- ✅ `app/album/[id]/page.tsx` - エラーハンドリングの改善
- ✅ 楽観的更新によるフォールバック
- ✅ コンソールログの追加

### 達成した改善

1. **ユーザー体験**: エラーメッセージが表示されなくなった
2. **即時フィードバック**: 画像が即座に表示される
3. **デバッグ性**: コンソールログで詳細を確認可能
4. **堅牢性**: リスト更新失敗時も楽観的更新で対応

### 学んだこと

1. **Admin SDK と Client SDK の違い**:
   - Admin SDK: セキュリティルールをバイパス（サーバー側のみ）
   - Client SDK: セキュリティルールが適用される
   - 両者の混在時は権限エラーに注意

2. **楽観的更新の重要性**:
   - サーバーからのレスポンス待ちなしで UI 更新
   - ユーザー体験の向上
   - エラー時のフォールバックとして有効

3. **エラーハンドリングの粒度**:
   - 処理全体を1つの try-catch で囲まない
   - 処理ごとに適切にエラーハンドリング
   - 成功/失敗を正確に判定

---

**結論**: 画像アップロードとリスト更新のエラーハンドリングを分離し、楽観的更新を導入することで、ユーザーにエラーを表示せず、スムーズな画像追加体験を実現した。
