// 基本データモデル (Firestore / Prisma 両対応の最低限版)
// Firestore 保存時は Date をそのまま入れると Timestamp に変換される。

export interface UserDoc { uid: string; displayName: string; iconURL?: string; bio?: string; createdAt: Date }
export interface AlbumDoc { id: string; ownerId: string; title?: string; placeUrl?: string; createdAt: Date; updatedAt: Date }
export interface AlbumImageDoc { id: string; albumId: string; uploaderId: string; url: string; createdAt: Date }
export interface CommentDoc { id: string; albumId: string; userId: string; body: string; createdAt: Date }
export interface LikeDoc { id: string; albumId: string; userId: string; createdAt: Date }
export type FriendStatus = 'pending' | 'accepted'
export interface FriendDoc { id: string; userId: string; targetId: string; status: FriendStatus; createdAt: Date }
export interface WatchDoc { id: string; userId: string; ownerId: string; createdAt: Date }

// エラーコード用定数
export const ERR = {
  LIMIT_4_PER_USER: 'LIMIT_4_PER_USER',
  TOO_LONG: 'TOO_LONG',
  EMPTY: 'EMPTY',
} as const
