"use client";

import type { CommunityPost } from "@/lib/social-types";
import PostCard from "./PostCard";

export default function CommunityFeed({
  posts,
  token,
  currentUserId,
  isGuest,
  isMobile,
  onPostUpdated,
  onPostDeleted,
}: {
  posts: CommunityPost[];
  token?: string | null;
  currentUserId?: number | null;
  isGuest?: boolean;
  isMobile?: boolean;
  onPostUpdated: (post: CommunityPost) => void;
  onPostDeleted: (postId: number) => void;
}) {
  if (posts.length === 0) {
    return (
      <div
        style={{
          borderRadius: 20,
          border: "1px dashed rgba(190,155,70,0.26)",
          padding: "28px 24px",
          textAlign: "center",
          background: "rgba(255,255,255,0.72)",
          color: "#8a7a50",
        }}
      >
        No community posts yet. Start with a route update, meetup plan, or volunteer question.
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {posts.map((post, index) => (
        <div
          key={post.id}
          className={`anim-fade-up d${Math.min(index + 1, 7)}`}
        >
          <PostCard
            post={post}
            token={token}
            currentUserId={currentUserId}
            isGuest={isGuest}
            isMobile={isMobile}
            onPostUpdated={onPostUpdated}
            onPostDeleted={onPostDeleted}
          />
        </div>
      ))}
    </div>
  );
}
