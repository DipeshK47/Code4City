"use client";

import { useEffect, useRef, useState } from "react";
import { formatDisplayName, formatRelativeTime } from "@/lib/social-format";
import { searchUsers, createOrGetThread } from "@/lib/messages-api";
import type { SearchUser } from "@/lib/messages-api";
import type { DMThread } from "@/lib/social-types";
import UserIdentity from "../community/UserIdentity";

export default function DMThreadList({
  threads,
  token,
  activeThreadId,
  onSelectThread,
}: {
  threads: DMThread[];
  token?: string | null;
  activeThreadId?: number;
  onSelectThread: (id: number) => void;
}) {
  const [showCompose, setShowCompose] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!token || !showCompose) return;
    if (query.trim().length === 0) {
      // Show all users when empty
      let cancelled = false;
      setIsSearching(true);
      searchUsers(token, "")
        .then((res) => {
          if (!cancelled) setResults(res.data);
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setIsSearching(false);
        });
      return () => { cancelled = true; };
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await searchUsers(token, query.trim());
        if (!controller.signal.aborted) setResults(res.data);
      } catch {
        // ignore
      } finally {
        if (!controller.signal.aborted) setIsSearching(false);
      }
    }, 200);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [token, query, showCompose]);

  useEffect(() => {
    if (showCompose) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [showCompose]);

  async function handleSelectUser(userId: number) {
    if (!token || isCreating) return;
    setIsCreating(true);
    try {
      const res = await createOrGetThread(token, userId);
      setShowCompose(false);
      setQuery("");
      onSelectThread(res.data.id);
    } catch {
      // ignore
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <button
        type="button"
        onClick={() => setShowCompose((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          padding: "10px 14px",
          borderRadius: 2,
          border: "1px solid rgba(212, 74, 18,0.22)",
          background: showCompose ? "rgba(212, 74, 18,0.12)" : "rgba(212, 74, 18,0.06)",
          color: "#7a5200",
          fontSize: 12.5,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
        New message
      </button>

      {showCompose && (
        <div
          style={{
            borderRadius: 2,
            border: "1px solid rgba(212, 74, 18,0.20)",
            background: "#F8F6F0",
            padding: 12,
            display: "grid",
            gap: 8,
          }}
        >
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or username..."
            style={{
              width: "100%",
              borderRadius: 2,
              border: "1px solid rgba(11, 11, 10,0.20)",
              background: "#F8F6F0",
              padding: "9px 12px",
              fontSize: 13,
              outline: "none",
              color: "#0B0B0A",
            }}
          />
          <div style={{ maxHeight: 200, overflowY: "auto", display: "grid", gap: 2 }}>
            {isSearching ? (
              <div style={{ padding: "10px 4px", fontSize: 12, color: "#8A8780" }}>
                Searching...
              </div>
            ) : results.length > 0 ? (
              results.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => void handleSelectUser(user.id)}
                  disabled={isCreating}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "9px 10px",
                    borderRadius: 2,
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    textAlign: "left",
                    width: "100%",
                    opacity: isCreating ? 0.6 : 1,
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "rgba(212, 74, 18,0.08)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "transparent";
                  }}
                >
                  <div
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 2,
                      background: "#D44A12",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#0B0B0A",
                      flexShrink: 0,
                    }}
                  >
                    {(user.fullName || user.username || "?")[0].toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#0B0B0A" }}>
                      {user.fullName || user.username}
                    </div>
                    <div style={{ fontSize: 11, color: "#8A8780" }}>
                      @{user.username}
                    </div>
                  </div>
                </button>
              ))
            ) : (
              <div style={{ padding: "10px 4px", fontSize: 12, color: "#8A8780" }}>
                No users found.
              </div>
            )}
          </div>
        </div>
      )}

      {threads.length === 0 && !showCompose ? (
        <div
          style={{
            borderRadius: 2,
            border: "1px dashed rgba(11, 11, 10,0.24)",
            background: "rgba(255,255,255,0.72)",
            padding: "24px 18px",
            color: "#8A8780",
            textAlign: "center",
            fontSize: 13,
            lineHeight: 1.6,
          }}
        >
          No conversations yet. Click <strong>New message</strong> above to start one.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 6 }}>
          {threads.map((thread) => {
            const isActive = activeThreadId === thread.id;

            return (
              <button
                key={thread.id}
                type="button"
                onClick={() => onSelectThread(thread.id)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  borderRadius: 2,
                  border: isActive
                    ? "1px solid rgba(212, 74, 18,0.30)"
                    : "1px solid rgba(11, 11, 10,0.12)",
                  background: isActive ? "rgba(212, 74, 18,0.10)" : "#F8F6F0",
                  boxShadow: "none",
                  padding: "10px 12px",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                  <UserIdentity
                    user={thread.otherUser}
                    subtitle={`@${thread.otherUser.username}`}
                    size={30}
                  />
                  {thread.unreadCount > 0 ? (
                    <div
                      style={{
                        minWidth: 22,
                        height: 22,
                        borderRadius: 2,
                        background: "#D44A12",
                        color: "#F8F6F0",
                        fontSize: 11,
                        fontWeight: 800,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "0 7px",
                      }}
                    >
                      {thread.unreadCount}
                    </div>
                  ) : null}
                </div>
                <div style={{ marginTop: 6, fontSize: 12, color: "#4b5563", lineHeight: 1.45, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {thread.lastMessageText || `Start a conversation with ${formatDisplayName(thread.otherUser)}.`}
                </div>
                <div style={{ marginTop: 4, fontSize: 10.5, color: "#8A8780" }}>
                  {thread.lastMessageAt ? formatRelativeTime(thread.lastMessageAt) : "New thread"}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
