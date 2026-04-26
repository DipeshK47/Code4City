"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createCommentReply,
  createPostComment,
  deleteCommunityPost,
  deletePostComment,
  getPostComments,
  likeCommunityPost,
  unlikeCommunityPost,
  updateCommunityPost,
} from "@/lib/community-api";
import { formatRelativeTime } from "@/lib/social-format";
import type { CommunityComment, CommunityPost } from "@/lib/social-types";
import CommentThread from "./CommentThread";
import MeetupCard from "./MeetupCard";
import UserIdentity from "./UserIdentity";
import { inputStyle, primaryButtonStyle } from "./CreatePostForm";

function countActiveComments(comments: CommunityComment[]): number {
  return comments.reduce((total, comment) => {
    const nextTotal = total + (comment.isDeleted ? 0 : 1);
    return nextTotal + countActiveComments(comment.replies);
  }, 0);
}

export default function PostCard({
  post,
  token,
  currentUserId,
  isGuest,
  isMobile,
  onPostUpdated,
  onPostDeleted,
}: {
  post: CommunityPost;
  token?: string | null;
  currentUserId?: number | null;
  isGuest?: boolean;
  isMobile?: boolean;
  onPostUpdated: (post: CommunityPost) => void;
  onPostDeleted: (postId: number) => void;
}) {
  const router = useRouter();
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(post.title);
  const [editBody, setEditBody] = useState(post.body);
  const [actionError, setActionError] = useState<string | null>(null);

  async function loadComments() {
    setIsLoadingComments(true);
    setActionError(null);

    try {
      const response = await getPostComments(post.id, token);
      setComments(response.data);
      setCommentsLoaded(true);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not load comments.");
    } finally {
      setIsLoadingComments(false);
    }
  }

  async function toggleComments() {
    const nextShow = !showComments;
    setShowComments(nextShow);

    if (nextShow && !commentsLoaded) {
      await loadComments();
    }
  }

  async function handleLikeToggle() {
    if (!token) return;

    setActionError(null);

    try {
      const response = post.viewerHasLiked
        ? await unlikeCommunityPost(token, post.id)
        : await likeCommunityPost(token, post.id);
      onPostUpdated(response.data);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not update like.");
    }
  }

  async function handleCreateComment() {
    if (!token) return;

    setIsSubmittingComment(true);
    setActionError(null);

    try {
      const response = await createPostComment(token, post.id, newComment);
      setComments(response.data);
      setCommentsLoaded(true);
      setShowComments(true);
      setNewComment("");
      onPostUpdated({
        ...post,
        commentCount: countActiveComments(response.data),
      });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not add comment.");
    } finally {
      setIsSubmittingComment(false);
    }
  }

  async function handleReply(commentId: number, body: string) {
    if (!token) return;

    const response = await createCommentReply(token, commentId, body);
    setComments(response.data);
    setCommentsLoaded(true);
    onPostUpdated({
      ...post,
      commentCount: countActiveComments(response.data),
    });
  }

  async function handleDeleteComment(commentId: number) {
    if (!token) return;

    const response = await deletePostComment(token, commentId);
    setComments(response.data);
    setCommentsLoaded(true);
    onPostUpdated({
      ...post,
      commentCount: countActiveComments(response.data),
    });
  }

  async function handleDeletePost() {
    if (!token) return;

    setActionError(null);

    try {
      await deleteCommunityPost(token, post.id);
      onPostDeleted(post.id);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not delete post.");
    }
  }

  async function handleSaveEdit() {
    if (!token) return;

    setActionError(null);

    try {
      const response = await updateCommunityPost(token, post.id, {
        title: editTitle,
        body: editBody,
      });
      onPostUpdated(response.data);
      setIsEditing(false);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not update post.");
    }
  }

  return (
    <article
      className="post-card anim-fade-up"
      style={{
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "68px minmax(0, 1fr)",
          alignItems: "start",
        }}
      >
        {!isMobile ? (
          <div
            style={{
              borderRight: "1px solid var(--border-subtle)",
              background: "#FCFCFA",
              minHeight: "100%",
              padding: "16px 10px",
              display: "grid",
              gap: 10,
              justifyItems: "center",
              alignContent: "start",
            }}
          >
            <button
              type="button"
              disabled={!token || Boolean(isGuest)}
              onClick={() => void handleLikeToggle()}
              style={{
                width: 42,
                height: 42,
                borderRadius: 14,
                border: `1px solid ${
                  post.viewerHasLiked ? "rgba(245,200,66,0.3)" : "var(--border-subtle)"
                }`,
                background: post.viewerHasLiked ? "rgba(255,248,230,0.92)" : "#ffffff",
                color: post.viewerHasLiked ? "#7a5200" : "var(--text-muted)",
                fontSize: 18,
                fontWeight: 900,
                opacity: !token || isGuest ? 0.6 : 1,
              }}
            >
              +
            </button>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#1f2b12" }}>
              {post.likeCount}
            </div>
            <button
              type="button"
              onClick={() => void toggleComments()}
              style={{
                width: 42,
                height: 42,
                borderRadius: 14,
                border: "1px solid var(--border-subtle)",
                background: showComments ? "rgba(255,244,214,0.9)" : "#ffffff",
                color: "var(--text-muted)",
                fontSize: 17,
                fontWeight: 900,
              }}
            >
              ...
            </button>
            <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 700 }}>
              {post.commentCount}
            </div>
          </div>
        ) : null}

        <div style={{ padding: isMobile ? "16px 16px 14px" : "18px 18px 16px", display: "grid", gap: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div style={{ minWidth: 0, display: "grid", gap: 8 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "5px 9px",
                    borderRadius: 999,
                    background: post.meetup ? "rgba(34,197,94,0.12)" : "var(--accent-amber-muted)",
                    color: post.meetup ? "#166534" : "#7a5200",
                    fontSize: 10.5,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  {post.meetup ? "Meetup Post" : "Community Post"}
                </span>
                <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                  {formatRelativeTime(post.createdAt)}
                </span>
              </div>
              <UserIdentity
                user={post.author}
                size={34}
                subtitle={`Posted by @${post.author.username}`}
              />
            </div>

            {currentUserId === post.userId ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => setIsEditing((current) => !current)}
                  style={ghostButtonStyle}
                >
                  {isEditing ? "Cancel" : "Edit"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleDeletePost()}
                  style={{ ...ghostButtonStyle, color: "#b91c1c" }}
                >
                  Delete
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => router.push(`/messages?compose=${post.author.id}`)}
                style={ghostButtonStyle}
              >
                DM
              </button>
            )}
          </div>

          {isEditing ? (
            <div style={{ display: "grid", gap: 10 }}>
              <input
                value={editTitle}
                onChange={(event) => setEditTitle(event.target.value)}
                style={inputStyle}
              />
              <textarea
                value={editBody}
                onChange={(event) => setEditBody(event.target.value)}
                rows={5}
                style={{ ...inputStyle, resize: "vertical", minHeight: 130 }}
              />
              <div>
                <button
                  type="button"
                  onClick={() => void handleSaveEdit()}
                  style={primaryButtonStyle}
                >
                  Save changes
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              <h2
                style={{
                  margin: 0,
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: isMobile ? 23 : 28,
                  lineHeight: 1.12,
                  letterSpacing: "-0.04em",
                  color: "var(--text-primary)",
                  fontWeight: 900,
                }}
              >
                {post.title}
              </h2>
              <p
                style={{
                  margin: 0,
                  fontSize: 14,
                  color: "var(--text-muted)",
                  lineHeight: 1.7,
                  whiteSpace: "pre-wrap",
                }}
              >
                {post.body}
              </p>
            </div>
          )}

          {post.meetup ? (
            <MeetupCard
              meetup={post.meetup}
              token={token}
              currentUserId={currentUserId}
              compact
              onMeetupUpdated={(meetup) => onPostUpdated({ ...post, meetup })}
            />
          ) : null}

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              alignItems: "center",
            }}
          >
            {isMobile ? (
              <button
                type="button"
                disabled={!token || Boolean(isGuest)}
                onClick={() => void handleLikeToggle()}
                style={{
                  ...reactionButtonStyle,
                  color: post.viewerHasLiked ? "#7a5200" : "#5f502d",
                  borderColor: post.viewerHasLiked
                    ? "rgba(245,200,66,0.3)"
                    : "rgba(190,155,70,0.18)",
                  background: post.viewerHasLiked ? "rgba(255,248,230,0.9)" : "#fffdf7",
                  opacity: !token || isGuest ? 0.55 : 1,
                }}
              >
                Like {post.likeCount}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void toggleComments()}
              style={reactionButtonStyle}
            >
              {showComments ? "Hide comments" : "Open comments"} {post.commentCount}
            </button>
            <button
              type="button"
              onClick={() => router.push(`/messages?compose=${post.author.id}`)}
              style={reactionButtonStyle}
            >
              Message author
            </button>
          </div>

          {actionError ? (
            <p style={{ margin: 0, fontSize: 12, color: "#b91c1c" }}>{actionError}</p>
          ) : null}

          {showComments ? (
            <section
              style={{
                borderTop: "1px solid rgba(190,155,70,0.12)",
                paddingTop: 14,
                display: "grid",
                gap: 14,
              }}
            >
              {token && !isGuest ? (
                <div
                  style={{
                    display: "grid",
                    gap: 10,
                    borderRadius: 18,
                    background: "#FCFCFA",
                    border: "1px solid var(--border-subtle)",
                    padding: 14,
                  }}
                >
                  <textarea
                    value={newComment}
                    onChange={(event) => setNewComment(event.target.value)}
                    rows={3}
                    placeholder="Add a comment"
                    style={{ ...inputStyle, resize: "vertical", minHeight: 90 }}
                  />
                  <div>
                    <button
                      type="button"
                      disabled={isSubmittingComment}
                      onClick={() => void handleCreateComment()}
                      style={{
                        ...primaryButtonStyle,
                        opacity: isSubmittingComment ? 0.72 : 1,
                      }}
                    >
                      {isSubmittingComment ? "Sending..." : "Post comment"}
                    </button>
                  </div>
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-muted)" }}>
                  Sign in with a full account to join the discussion.
                </p>
              )}

              {isLoadingComments ? (
                <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-muted)" }}>Loading comments...</p>
              ) : comments.length > 0 ? (
                <CommentThread
                  comments={comments}
                  currentUserId={currentUserId}
                  canReply={Boolean(token) && !isGuest}
                  onReply={handleReply}
                  onDelete={handleDeleteComment}
                />
              ) : (
                <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-muted)" }}>
                  No comments yet. Start the thread.
                </p>
              )}
            </section>
          ) : null}
        </div>
      </div>
    </article>
  );
}

const ghostButtonStyle: React.CSSProperties = {
  borderRadius: 8,
  border: "1px solid var(--border-subtle)",
  background: "transparent",
  color: "var(--text-muted)",
  padding: "9px 12px",
  fontSize: 12,
  fontWeight: 700,
};

const reactionButtonStyle: React.CSSProperties = {
  borderRadius: 8,
  border: "1px solid var(--border-subtle)",
  background: "transparent",
  color: "var(--text-muted)",
  padding: "10px 14px",
  fontSize: 12.5,
  fontWeight: 700,
};
