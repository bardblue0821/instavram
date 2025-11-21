"use client";
import React from "react";

export interface CommentViewModel {
  id: string;
  body: string;
  userId: string;
  createdAt?: any;
  isEditing?: boolean;
}

interface CommentListProps {
  comments: CommentViewModel[];
  currentUserId?: string | null;
  albumOwnerId?: string;
  onEditRequest?: (commentId: string) => void;
  onEditChange?: (commentId: string, value: string) => void;
  onEditSave?: (commentId: string) => void;
  onEditCancel?: () => void;
  onDelete?: (commentId: string) => void;
  editingCommentId?: string | null;
  editingValue?: string;
  canManage?: (comment: CommentViewModel) => boolean;
}

function formatTimestamp(ts: any): string {
  if (!ts) return "";
  try {
    let d: Date;
    if (ts instanceof Date) {
      d = ts;
    } else if (typeof ts.toDate === "function") {
      d = ts.toDate();
    } else {
      d = new Date(ts);
    }
    return d.toLocaleString();
  } catch {
    return "";
  }
}

export function CommentList({
  comments,
  currentUserId,
  albumOwnerId,
  onEditRequest,
  onEditChange,
  onEditSave,
  onEditCancel,
  onDelete,
  editingCommentId,
  editingValue,
  canManage,
}: CommentListProps) {
  const decideCanManage = (comment: CommentViewModel) => {
    if (typeof canManage === "function") return canManage(comment);
    return comment.userId === currentUserId || (!!albumOwnerId && currentUserId === albumOwnerId);
  };

  if (!comments || comments.length === 0) {
    return <p className="text-sm text-gray-500">コメントなし</p>;
  }

  return (
    <ul className="space-y-2 mb-3">
      {comments.map((comment) => {
        const isEditing = editingCommentId === comment.id;
        const manageable = decideCanManage(comment);
        return (
          <li key={comment.id} className="space-y-2 rounded border px-3 py-2 text-sm">
            {!isEditing && <p className="whitespace-pre-line wrap-break-word">{comment.body}</p>}
            {isEditing && (
              <textarea
                value={editingValue ?? ""}
                onChange={(e) => onEditChange?.(comment.id, e.target.value)}
                className="w-full rounded border px-2 py-1 text-sm"
                rows={3}
              />
            )}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] text-gray-500">by {comment.userId}{formatTimestamp(comment.createdAt) ? ` ・ ${formatTimestamp(comment.createdAt)}` : ""}</span>
              {manageable && (
                <div className="flex gap-2 text-xs">
                  {!isEditing && (
                    <>
                      <button onClick={() => onEditRequest?.(comment.id)} className="rounded bg-yellow-500 px-2 py-0.5 text-white">編集</button>
                      <button onClick={() => onDelete?.(comment.id)} className="rounded bg-red-600 px-2 py-0.5 text-white">削除</button>
                    </>
                  )}
                  {isEditing && (
                    <>
                      <button
                        onClick={() => onEditSave?.(comment.id)}
                        disabled={!editingValue?.trim()}
                        className="rounded bg-green-600 px-2 py-0.5 text-white disabled:opacity-50"
                      >保存</button>
                      <button onClick={() => onEditCancel?.()} className="rounded bg-gray-400 px-2 py-0.5 text-white">キャンセル</button>
                    </>
                  )}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
