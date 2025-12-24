# Firestore セキュリティルール エラー対応

**日時**: 2025年12月24日  
**問題**: 画像アップロード時の "Missing or insufficient permissions" エラー  
**原因**: アルバム作成とセキュリティルールの処理順序の不一致

---

## 問題の詳細

### エラーメッセージ
```
FirebaseError: Missing or insufficient permissions.
[album:create] post-upload processing error {}
```

### 発生箇所
- `lib/services/createAlbumWithImages.ts` (81行目)
- `components/AlbumCreateModal.tsx` (189行目)

---

## 根本原因

### 元の処理順序（誤り）
```typescript
1. アルバムIDを生成
2. 画像をアップロード → addImage() 呼び出し ❌
3. アルバムドキュメントを作成
```

### Firestore セキュリティルール
```javascript
// albumImages/{imageId}
match /albumImages/{imageId} {
  allow create: if isSignedIn()
    && request.resource.data.uploaderId == request.auth.uid
    && canReadAlbum(request.resource.data.albumId);  // ← ここでアルバムの存在を確認
}

function canReadAlbum(albumId) {
  let a = get(/databases/$(database)/documents/albums/$(albumId)).data;
  // ↑ アルバムドキュメントが存在しないため失敗
  return (
    a.visibility != 'friends' ||
    (isSignedIn() && (a.ownerId == request.auth.uid || isFriendWith(a.ownerId)))
  );
}
```

### 問題点
- `addImage()` を呼び出す時点で、`albums/{albumId}` ドキュメントが存在しない
- セキュリティルールの `canReadAlbum()` 関数が `get(albums/...)` を実行
- ドキュメントが見つからず、エラーが発生

---

## 解決策

### 修正後の処理順序
```typescript
1. アルバムIDを生成
2. アルバムドキュメントを先に作成 ✅
3. 画像をアップロード → addImage() 呼び出し ✅
```

### コード変更

**ファイル**: `lib/services/createAlbumWithImages.ts`

#### Before
```typescript
export async function createAlbumWithImages(
  ownerId: string,
  files: File[],
  onProgress?: (p: AlbumCreateProgress) => void,
): Promise<string> {
  const albumRef = doc(collection(db, COL.albums));
  const albumId = albumRef.id;
  
  // 画像アップロード
  for (let i = 0; i < files.length; i++) {
    // ... upload ...
    await addImage(albumId, ownerId, url); // ❌ アルバムがまだない
  }
  
  // アルバム作成（遅すぎる）
  await setDoc(albumRef, { ... });
}
```

#### After
```typescript
export async function createAlbumWithImages(
  ownerId: string,
  files: File[],
  onProgress?: (p: AlbumCreateProgress) => void,
): Promise<string> {
  const albumRef = doc(collection(db, COL.albums));
  const albumId = albumRef.id;
  
  // ★ アルバムドキュメントを先に作成
  await setDoc(albumRef, {
    id: albumId,
    ownerId,
    title: opts.title || null,
    placeUrl: opts.placeUrl || null,
    visibility: (opts.visibility === 'friends' ? 'friends' : 'public'),
    createdAt: now,
    updatedAt: now,
  });
  
  try {
    // 画像アップロード
    for (let i = 0; i < files.length; i++) {
      // ... upload ...
      await addImage(albumId, ownerId, url); // ✅ アルバムが存在する
    }
    
    return albumId;
  } catch (error) {
    // エラー時はアルバムドキュメントを削除（クリーンアップ）
    await deleteDoc(albumRef);
    throw error;
  }
}
```

### 追加の改善点

1. **エラーハンドリングの追加**
   - 画像アップロードに失敗した場合、アルバムドキュメントを削除
   - 孤児アルバム（画像がないアルバム）の防止

2. **Import の追加**
   ```typescript
   import { doc, setDoc, collection, deleteDoc } from 'firebase/firestore';
   ```

---

## 代替案（検討したが採用せず）

### 案1: セキュリティルールを緩和

```javascript
// albumImages/{imageId}
match /albumImages/{imageId} {
  allow create: if isSignedIn()
    && request.resource.data.uploaderId == request.auth.uid;
    // canReadAlbum チェックを削除
}
```

**デメリット**:
- セキュリティが弱くなる
- friends 限定アルバムに誰でも画像を追加できる可能性

### 案2: exists() を使った存在チェック

```javascript
function canReadAlbum(albumId) {
  return exists(/databases/$(database)/documents/albums/$(albumId)) &&
    // ... 以下同じ
}
```

**デメリット**:
- `exists()` も同様にドキュメントがないと失敗
- 根本的な解決にならない

---

## 検証方法

### 1. テストケース
```typescript
// 新規アルバム作成
const albumId = await createAlbumWithImages(userId, [file1, file2]);

// アルバムドキュメントの確認
const albumSnap = await getDoc(doc(db, 'albums', albumId));
console.log('Album exists:', albumSnap.exists()); // true

// 画像ドキュメントの確認
const imagesSnap = await getDocs(
  query(collection(db, 'albumImages'), where('albumId', '==', albumId))
);
console.log('Images count:', imagesSnap.size); // 2
```

### 2. エラーケース
```typescript
// 画像アップロード失敗時
try {
  await createAlbumWithImages(userId, [invalidFile]);
} catch (error) {
  // アルバムドキュメントが削除されているか確認
  const albumSnap = await getDoc(doc(db, 'albums', albumId));
  console.log('Album cleaned up:', !albumSnap.exists()); // true
}
```

---

## 学んだこと

1. **Firestore セキュリティルールの評価タイミング**
   - ルールは **書き込み前** に評価される
   - `get()` や `exists()` は **現時点のデータ** を参照
   - トランザクション内の未確定データは参照できない

2. **処理順序の重要性**
   - 依存関係のあるドキュメントは正しい順序で作成
   - アルバム → 画像の順序が必須
   - セキュリティルールを考慮した設計

3. **エラーハンドリングのベストプラクティス**
   - 部分的に成功した状態を残さない
   - クリーンアップ処理でデータ整合性を保つ
   - try-catch で適切にロールバック

4. **Firebase Extensions の影響**
   - Resize Images Extension 自体はこのエラーの直接原因ではない
   - ただし、設定後にルールを見直すきっかけになった
   - 既存のセキュリティ問題が顕在化した

---

## 今後の対策

### 1. 統合テストの追加
```typescript
describe('createAlbumWithImages', () => {
  it('should create album before uploading images', async () => {
    // アルバム作成順序のテスト
  });
  
  it('should cleanup on error', async () => {
    // エラー時のクリーンアップテスト
  });
});
```

### 2. セキュリティルールのテスト
```javascript
// firestore.rules.test.js
it('should allow image upload if album exists', async () => {
  await firebase.assertSucceeds(/* ... */);
});

it('should deny image upload if album does not exist', async () => {
  await firebase.assertFails(/* ... */);
});
```

### 3. ドキュメント作成順序のガイドライン
- README に処理順序の依存関係を明記
- 新規開発者向けのオンボーディング資料

---

## 参考資料

- [Firestore Security Rules - Get and Exists](https://firebase.google.com/docs/firestore/security/rules-conditions#access_other_documents)
- [Firebase Storage - Resize Images Extension](https://firebase.google.com/products/extensions/storage-resize-images)
- [Firestore Transaction and Batched Writes](https://firebase.google.com/docs/firestore/manage-data/transactions)

---

**結論**: 処理順序を修正することで、セキュリティルールの制約を満たしながら安全に画像アップロードを実行できるようになった。エラーハンドリングの改善により、データ整合性も向上した。
