"use client";

import { useRouter } from "next/navigation";
import GuestGate from "@/components/auth/GuestGate";
import { useAuth } from "@/context/AuthContext";
import { createCommunityPost } from "@/lib/community-api";
import CommunityComposerShell from "./CommunityComposerShell";
import CreatePostForm from "./CreatePostForm";

export default function CreatePostPageClient() {
  const router = useRouter();
  const { token, isGuest, logout } = useAuth();

  if (!token || isGuest) {
    return (
      <GuestGate
        message="Login or sign up to create a community post."
        onGoToLogin={logout}
      />
    );
  }

  return (
    <CommunityComposerShell
      eyebrow="Create Post"
      title="Start a thread that helps volunteers move."
      subtitle="Ask for route advice, share what worked in a neighborhood, or post a clear call for help so others can jump in fast."
    >
      <CreatePostForm
        submitLabel="Publish post"
        onSubmit={async (input) => {
          await createCommunityPost(token, input);
          router.push("/community");
        }}
      />
    </CommunityComposerShell>
  );
}
