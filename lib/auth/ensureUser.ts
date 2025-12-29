import { User } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Twitter (X) 認証後、Firestore の users コレクションにユーザーを登録
 * 既に存在する場合はスキップ
 */
export async function ensureUserInFirestore(firebaseUser: User): Promise<void> {
  const userRef = doc(db, 'users', firebaseUser.uid);
  const userSnap = await getDoc(userRef);
  
  // 既に登録済みの場合
  if (userSnap.exists()) {
    const existingData = userSnap.data();
    console.log('[ensureUser] ユーザーは既に登録済み:', firebaseUser.uid);
    console.log('[ensureUser] 既存データ:', {
      handle: existingData.handle,
      provider: existingData.provider,
      displayName: existingData.displayName
    });
    
    // Twitter 認証で handle が UID でない場合は更新
    if (existingData.provider === 'twitter' && existingData.handle !== firebaseUser.uid.toLowerCase()) {
      console.log('[ensureUser] Twitter ユーザーの handle を UID に更新:', {
        oldHandle: existingData.handle,
        newHandle: firebaseUser.uid.toLowerCase()
      });
      
      await setDoc(userRef, {
        handle: firebaseUser.uid.toLowerCase(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      
      console.log('[ensureUser] handle を更新しました');
    } else {
      console.log('[ensureUser] handle 更新不要:', {
        isTwitter: existingData.provider === 'twitter',
        handleMatchesUID: existingData.handle === firebaseUser.uid.toLowerCase(),
        currentHandle: existingData.handle
      });
    }
    
    return;
  }
  
  console.log('[ensureUser] 新規ユーザーを登録:', firebaseUser.uid);
  console.log('[ensureUser] Firebase User 情報:', {
    displayName: firebaseUser.displayName,
    email: firebaseUser.email,
    photoURL: firebaseUser.photoURL,
    providerData: firebaseUser.providerData
  });
  
  // Twitter から取得した情報
  const displayName = firebaseUser.displayName || 'Twitter User';
  const photoURL = firebaseUser.photoURL || '';
  const email = firebaseUser.email || ''; // Twitter はメールを提供しない場合がある
  
  // Twitter 認証の場合、handle は Firebase UID をそのまま使用
  // （Twitter のスクリーンネームは Firebase Auth から直接取得できないため）
  // handle は小文字で保存（getUserByHandle が toLowerCase() するため）
  const handle = firebaseUser.uid.toLowerCase();
  
  console.log('[ensureUser] Twitter 認証: handle を UID に設定:', handle);
  
  // Firestore にユーザーを登録
  await setDoc(userRef, {
    uid: firebaseUser.uid,
    email: email,
    displayName: displayName,
    handle: handle,
    photoURL: photoURL,
    bio: '',
    links: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    provider: 'twitter', // 認証プロバイダーを記録
  });
  
  console.log('[ensureUser] ユーザー登録完了:', { uid: firebaseUser.uid, handle });
}
