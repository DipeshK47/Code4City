"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import PageContainer from "@/components/layout/PageContainer";
import SectionCard from "@/components/common/SectionCard";
import GuestGate from "@/components/auth/GuestGate";
import { useAuth } from "@/context/AuthContext";
import { createOrGetThread, getThreads } from "@/lib/messages-api";
import type { DMThread } from "@/lib/social-types";
import DMChatWindow from "./DMChatWindow";
import DMThreadList from "./DMThreadList";

export default function MessagesPageClient({
  threadId: initialThreadId,
}: {
  threadId?: number;
}) {
  const { token, user, isGuest, logout } = useAuth();
  const searchParams = useSearchParams();
  const [isMobile, setIsMobile] = useState(false);
  const [threads, setThreads] = useState<DMThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeThreadId, setActiveThreadId] = useState<number | undefined>(initialThreadId);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 980px)");
    const syncViewport = () => setIsMobile(mediaQuery.matches);
    syncViewport();
    mediaQuery.addEventListener("change", syncViewport);

    return () => {
      mediaQuery.removeEventListener("change", syncViewport);
    };
  }, []);

  // Load threads once on mount
  useEffect(() => {
    let cancelled = false;

    async function hydrateThreads() {
      if (!token || isGuest) {
        setLoading(false);
        return;
      }

      try {
        const composeUserId = searchParams.get("compose");
        if (composeUserId) {
          const createdThread = await createOrGetThread(token, Number(composeUserId));
          if (!cancelled) {
            setActiveThreadId(createdThread.data.id);
          }
        }

        const response = await getThreads(token);
        if (!cancelled) {
          setThreads(response.data);
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Could not load DMs.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void hydrateThreads();

    return () => {
      cancelled = true;
    };
  }, [token, isGuest, searchParams]);

  // Poll threads in background
  useEffect(() => {
    if (!token || isGuest) return;

    let cancelled = false;

    const intervalId = window.setInterval(async () => {
      try {
        const response = await getThreads(token);
        if (!cancelled) {
          setThreads(response.data);
        }
      } catch {
        return;
      }
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [token, isGuest]);

  if (isGuest) {
    return (
      <GuestGate
        message="Login or sign up to send direct messages to other volunteers."
        onGoToLogin={logout}
      />
    );
  }

  return (
    <PageContainer style={{ padding: "24px 26px 40px" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile
            ? "1fr"
            : "minmax(290px, 0.9fr) minmax(0, 1.4fr)",
          gap: 18,
        }}
      >
        <SectionCard title="Direct Messages" subtitle="Private volunteer coordination threads.">
          {loading ? (
            <p style={{ margin: 0, fontSize: 13, color: "#8a7a50" }}>Loading threads...</p>
          ) : error ? (
            <p style={{ margin: 0, fontSize: 13, color: "#b91c1c" }}>{error}</p>
          ) : (
            <DMThreadList
              threads={threads}
              token={token}
              activeThreadId={activeThreadId}
              onSelectThread={setActiveThreadId}
            />
          )}
        </SectionCard>

        <div style={{ display: "grid", gap: 18 }}>
          <SectionCard
            title="Conversation"
            subtitle={
              activeThreadId
                ? "Live thread"
                : "Open a thread from the list or start one from a meetup or post."
            }
          >
            <DMChatWindow
              threadId={activeThreadId}
              token={token}
              currentUserId={user?.id}
            />
          </SectionCard>
        </div>
      </div>
    </PageContainer>
  );
}
