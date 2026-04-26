"use client";

import { useState } from "react";
import type { CommunityComment } from "@/lib/social-types";
import { formatRelativeTime } from "@/lib/social-format";
import UserIdentity from "./UserIdentity";
import { primaryButtonStyle } from "./CreatePostForm";

export default function CommentThread({
  comments,
  currentUserId,
  canReply,
  onReply,
  onDelete,
  depth = 0,
}: {
  comments: CommunityComment[];
  currentUserId?: number | null;
  canReply: boolean;
  onReply: (commentId: number, body: string) => Promise<void>;
  onDelete: (commentId: number) => Promise<void>;
  depth?: number;
}) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {comments.map((comment) => (
        <CommentNode
          key={comment.id}
          comment={comment}
          currentUserId={currentUserId}
          canReply={canReply}
          onReply={onReply}
          onDelete={onDelete}
          depth={depth}
        />
      ))}
    </div>
  );
}

function CommentNode({
  comment,
  currentUserId,
  canReply,
  onReply,
  onDelete,
  depth,
}: {
  comment: CommunityComment;
  currentUserId?: number | null;
  canReply: boolean;
  onReply: (commentId: number, body: string) => Promise<void>;
  onDelete: (commentId: number) => Promise<void>;
  depth: number;
}) {
  const [replyBody, setReplyBody] = useState("");
  const [showReply, setShowReply] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleReply() {
    setIsReplying(true);
    setError(null);

    try {
      await onReply(comment.id, replyBody);
      setReplyBody("");
      setShowReply(false);
    } catch (replyError) {
      setError(replyError instanceof Error ? replyError.message : "Could not send reply.");
    } finally {
      setIsReplying(false);
    }
  }

  return (
    <div
      style={{
        marginLeft: depth > 0 ? 18 : 0,
        paddingLeft: depth > 0 ? 14 : 0,
        borderLeft: depth > 0 ? "2px solid rgba(190,155,70,0.18)" : "none",
        display: "grid",
        gap: 10,
      }}
    >
      <div
        style={{
          borderRadius: 16,
          background: "#fffdf7",
          border: "1px solid rgba(190,155,70,0.16)",
          padding: "14px 14px 12px",
        }}
      >
        <UserIdentity
          user={comment.author}
          size={34}
          subtitle={formatRelativeTime(comment.createdAt)}
        />
        <p
          style={{
            margin: "10px 0 0",
            fontSize: 13,
            color: comment.isDeleted ? "#9ca3af" : "#243112",
            lineHeight: 1.55,
          }}
        >
          {comment.isDeleted ? "Comment removed." : comment.body}
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
          {canReply && !comment.isDeleted ? (
            <button
              type="button"
              onClick={() => setShowReply((current) => !current)}
              style={textButtonStyle}
            >
              {showReply ? "Cancel reply" : "Reply"}
            </button>
          ) : null}
          {currentUserId === comment.userId && !comment.isDeleted ? (
            <button
              type="button"
              onClick={() => void onDelete(comment.id)}
              style={{ ...textButtonStyle, color: "#b91c1c" }}
            >
              Delete
            </button>
          ) : null}
        </div>
        {showReply ? (
          <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
            <textarea
              value={replyBody}
              onChange={(event) => setReplyBody(event.target.value)}
              rows={3}
              placeholder="Write a reply"
              style={{
                width: "100%",
                borderRadius: 14,
                border: "1px solid rgba(190,155,70,0.22)",
                background: "#ffffff",
                padding: "12px 14px",
                outline: "none",
                fontSize: 13,
                resize: "vertical",
              }}
            />
            {error ? (
              <p style={{ margin: 0, fontSize: 12, color: "#b91c1c" }}>{error}</p>
            ) : null}
            <div>
              <button
                type="button"
                onClick={() => void handleReply()}
                disabled={isReplying}
                style={{
                  ...primaryButtonStyle,
                  opacity: isReplying ? 0.72 : 1,
                }}
              >
                {isReplying ? "Sending..." : "Send reply"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
      {comment.replies.length > 0 ? (
        <CommentThread
          comments={comment.replies}
          currentUserId={currentUserId}
          canReply={canReply}
          onReply={onReply}
          onDelete={onDelete}
          depth={depth + 1}
        />
      ) : null}
    </div>
  );
}

const textButtonStyle: React.CSSProperties = {
  background: "transparent",
  color: "#7a5200",
  fontSize: 12,
  fontWeight: 800,
  padding: 0,
};
