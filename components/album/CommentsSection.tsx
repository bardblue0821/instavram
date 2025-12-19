import React from "react";
import { CommentList } from "../comments/CommentList";
import { CommentForm } from "../comments/CommentForm";

export interface CommentRecord { id: string; body: string; userId: string; createdAt?: any; [key: string]: any; }

export interface CommentsSectionProps {
  comments: CommentRecord[];
  currentUserId: string;
  albumOwnerId: string;
  canPostComment: boolean;
  editingCommentId: string | null;
  editingValue: string;
  commentText: string;
  commenting: boolean;
  onEditRequest: (id: string) => void;
  onEditChange: (_: string, value: string) => void;
  onEditSave: (id: string) => void;
  onEditCancel: () => void;
  onDelete: (id: string) => void;
  onSubmit: () => void;
  onChangeText: (v: string) => void;
}

export default function CommentsSection(props: CommentsSectionProps) {
  const { comments, currentUserId, albumOwnerId, canPostComment, editingCommentId, editingValue, commentText, commenting, onEditRequest, onEditChange, onEditSave, onEditCancel, onDelete, onSubmit, onChangeText } = props;

  return (
    <section>
      <CommentList
        comments={comments}
        currentUserId={currentUserId}
        albumOwnerId={albumOwnerId}
        onEditRequest={onEditRequest}
        onEditChange={onEditChange}
        onEditSave={onEditSave}
        onEditCancel={onEditCancel}
        onDelete={onDelete}
        editingCommentId={editingCommentId}
        editingValue={editingValue}
      />
      {canPostComment && (
        <div className="max-w-md">
          <CommentForm
            value={commentText}
            onChange={onChangeText}
            onSubmit={onSubmit}
            busy={commenting}
          />
        </div>
      )}
    </section>
  );
}
