"use client";

import { useRouter } from "next/navigation";
import GuestGate from "@/components/auth/GuestGate";
import { useAuth } from "@/context/AuthContext";
import CommunityComposerShell from "./CommunityComposerShell";
import CreateMeetupForm from "./CreateMeetupForm";

export default function CreateMeetupPageClient() {
  const router = useRouter();
  const { token, isGuest, logout } = useAuth();

  if (!token || isGuest) {
    return (
      <GuestGate
        message="Login or sign up to create a meetup."
        onGoToLogin={logout}
      />
    );
  }

  return (
    <CommunityComposerShell
      eyebrow="Create Meetup"
      title="Put a real place and time on the plan."
      subtitle="Create a meetup that appears in the feed, drops onto the map, and opens a group chat for everyone who joins."
    >
      <CreateMeetupForm
        token={token}
        onCreated={(meetupId) => {
          router.push(`/community/meetups/${meetupId}`);
        }}
      />
    </CommunityComposerShell>
  );
}
