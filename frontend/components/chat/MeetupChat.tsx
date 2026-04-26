"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import {
  getMeetupMessages,
  sendMeetupMessage,
  triggerMeetupCoordinator,
} from "@/lib/meetup-api";
import { formatDateTime, formatDisplayName } from "@/lib/social-format";
import type { CoordinatorAssignment, MeetupMessage } from "@/lib/social-types";
import { primaryButtonStyle } from "../community/CreatePostForm";

const SERVICE_LABELS: Record<string, string> = {
  food: "Food",
  shelter: "Shelter",
  healthcare: "Healthcare",
  substance_use: "Recovery",
  mental_health: "Mental Health",
  youth: "Youth services",
  senior: "Senior services",
};

const SERVICE_COLORS: Record<string, string> = {
  food: "#D44A12",
  shelter: "#3B82F6",
  healthcare: "#16A34A",
  substance_use: "#9333EA",
  mental_health: "#0EA5E9",
  youth: "#F59E0B",
  senior: "#6B7280",
};

export default function MeetupChat({
  meetupId,
  token,
  currentUserId,
  enabled,
  meetupLat,
  meetupLng,
  meetupName,
}: {
  meetupId: number;
  token?: string | null;
  currentUserId?: number | null;
  enabled: boolean;
  meetupLat?: number;
  meetupLng?: number;
  meetupName?: string;
}) {
  const [messages, setMessages] = useState<MeetupMessage[]>([]);
  const [messageText, setMessageText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isCoordinating, setIsCoordinating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  const loadMessages = useEffectEvent(async () => {
    if (!token || !enabled) {
      setMessages([]);
      setIsLoading(false);
      return;
    }

    try {
      const response = await getMeetupMessages(token, meetupId);
      setMessages(response.data);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load chat.");
    } finally {
      setIsLoading(false);
    }
  });

  useEffect(() => {
    setIsLoading(true);
    void loadMessages();
  }, [meetupId, token, enabled]);

  useEffect(() => {
    if (!token || !enabled) return;
    const intervalId = window.setInterval(() => {
      void loadMessages();
    }, 5000);
    return () => window.clearInterval(intervalId);
  }, [token, enabled]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    if (!token || !messageText.trim()) return;
    setIsSending(true);
    setError(null);
    try {
      const response = await sendMeetupMessage(token, meetupId, messageText);
      setMessages((current) => [...current, response.data]);
      setMessageText("");
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Could not send message.");
    } finally {
      setIsSending(false);
    }
  }

  async function handleTriggerCoordinator() {
    if (!token) return;
    setIsCoordinating(true);
    setError(null);
    try {
      await triggerMeetupCoordinator(token, meetupId);
      await loadMessages();
    } catch (coordError) {
      setError(
        coordError instanceof Error ? coordError.message : "Could not generate plan.",
      );
    } finally {
      setIsCoordinating(false);
    }
  }

  async function generateFlyerForAssignment(assignment: CoordinatorAssignment) {
    if (!meetupLat || !meetupLng) return;
    const dropName = `${meetupName || "Meetup"} (${assignment.direction})`;
    try {
      const response = await fetch(`/api/flyers/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dropName,
          lat: meetupLat,
          lng: meetupLng,
          authToken: token,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || "Could not generate flyer");
      }
      window.open(`/flyers/${payload.data.id}`, "_blank", "noopener,noreferrer");
    } catch (flyerError) {
      setError(
        flyerError instanceof Error ? flyerError.message : "Could not generate flyer",
      );
    }
  }

  if (!enabled) {
    return (
      <div style={emptyStateStyle}>Join the meetup to unlock the group chat.</div>
    );
  }

  return (
    <div
      style={{
        borderRadius: 2,
        border: "1px solid rgba(11, 11, 10,0.18)",
        background: "#F8F6F0",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          maxHeight: 440,
          minHeight: 240,
          overflowY: "auto",
          padding: 16,
          display: "grid",
          gap: 10,
          background: "#F8F6F0",
        }}
      >
        {isLoading ? (
          <p style={{ margin: 0, fontSize: 12.5, color: "#8A8780" }}>Loading chat...</p>
        ) : messages.length > 0 ? (
          messages.map((message) =>
            message.isCoordinator ? (
              <CoordinatorBubble
                key={message.id}
                message={message}
                onGenerateFlyer={generateFlyerForAssignment}
                currentUserId={currentUserId ?? null}
              />
            ) : (
              <ChatBubble
                key={message.id}
                message={message}
                isMine={currentUserId === message.userId}
              />
            ),
          )
        ) : (
          <p style={{ margin: 0, fontSize: 12.5, color: "#8A8780" }}>
            No messages yet. Set the tone for the meetup.
          </p>
        )}
        <div ref={endRef} />
      </div>
      <div
        style={{
          borderTop: "1px solid rgba(11, 11, 10,0.16)",
          padding: 14,
          display: "grid",
          gap: 10,
          background: "#F8F6F0",
        }}
      >
        <textarea
          value={messageText}
          onChange={(event) => setMessageText(event.target.value)}
          rows={3}
          placeholder="Send a meetup message"
          style={{
            width: "100%",
            borderRadius: 2,
            border: "1px solid rgba(11, 11, 10,0.22)",
            background: "#F8F6F0",
            padding: "12px 14px",
            fontSize: 13,
            resize: "vertical",
            outline: "none",
          }}
        />
        {error ? (
          <p style={{ margin: 0, fontSize: 12, color: "#b91c1c" }}>{error}</p>
        ) : null}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            disabled={isSending}
            onClick={() => void handleSend()}
            style={{ ...primaryButtonStyle, opacity: isSending ? 0.72 : 1 }}
          >
            {isSending ? "Sending..." : "Send message"}
          </button>
          <button
            type="button"
            disabled={isCoordinating}
            onClick={() => void handleTriggerCoordinator()}
            style={{
              padding: "10px 14px",
              borderRadius: 2,
              border: "1px solid rgba(11,11,10,0.24)",
              background: "#0B0B0A",
              color: "#F8F6F0",
              fontSize: 12.5,
              fontWeight: 700,
              cursor: isCoordinating ? "wait" : "pointer",
              opacity: isCoordinating ? 0.7 : 1,
            }}
          >
            {isCoordinating ? "Building plan…" : "Re-run AI coordinator"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ChatBubble({ message, isMine }: { message: MeetupMessage; isMine: boolean }) {
  return (
    <div
      style={{
        justifySelf: isMine ? "end" : "start",
        maxWidth: "78%",
        borderRadius: 2,
        padding: "11px 13px",
        background: isMine ? "rgba(217,249,157,0.9)" : "#FFFFFF",
        border: "1px solid rgba(11, 11, 10,0.16)",
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 800, color: "#4b5563", marginBottom: 4 }}>
        {message.sender ? formatDisplayName(message.sender) : "Unknown"}
      </div>
      <div style={{ fontSize: 13, color: "#1f2b12", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
        {message.messageText}
      </div>
      <div style={{ fontSize: 10.5, color: "#7c8a67", marginTop: 6 }}>
        {formatDateTime(message.createdAt)}
      </div>
    </div>
  );
}

function CoordinatorBubble({
  message,
  onGenerateFlyer,
  currentUserId,
}: {
  message: MeetupMessage;
  onGenerateFlyer: (assignment: CoordinatorAssignment) => void;
  currentUserId: number | null;
}) {
  const lines = message.messageText.split("\n");
  const opener = lines.length > 0 ? lines[0] : "";
  const assignments = message.assignments || [];

  return (
    <div
      style={{
        justifySelf: "stretch",
        borderRadius: 6,
        padding: "14px 16px",
        background: "linear-gradient(180deg, #FFF7E8 0%, #FEEED1 100%)",
        border: "1.5px solid #D44A12",
        boxShadow: "0 6px 18px rgba(212,74,18,0.12)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 8,
          fontSize: 11,
          letterSpacing: "0.16em",
          fontWeight: 800,
          color: "#D44A12",
          textTransform: "uppercase",
        }}
      >
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: 999,
            background: "#D44A12",
            color: "#FFFFFF",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
          }}
        >
          AI
        </span>
        Coordinator · Citrus
      </div>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: "#1A1917" }}>{opener}</p>

      {assignments.length > 0 ? (
        <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
          {assignments.map((assignment, idx) => {
            const color = SERVICE_COLORS[assignment.focusCategory] || "#D44A12";
            const isMine =
              currentUserId !== null && String(currentUserId) === String(assignment.userId);
            return (
              <div
                key={`${assignment.userId}-${idx}`}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  padding: "10px 12px",
                  borderRadius: 4,
                  background: isMine ? `${color}1A` : "#FFFFFF",
                  border: `1px solid ${isMine ? color : "rgba(11,11,10,0.12)"}`,
                }}
              >
                <span
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 999,
                    background: color,
                    color: "#FFFFFF",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 800,
                    fontSize: 12,
                    flexShrink: 0,
                  }}
                >
                  {assignment.direction || "—"}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#1A1917" }}>
                    @{assignment.username} · {assignment.roleTitle}
                    {isMine ? (
                      <span
                        style={{
                          marginLeft: 6,
                          fontSize: 10,
                          fontWeight: 800,
                          color,
                          letterSpacing: "0.12em",
                          textTransform: "uppercase",
                        }}
                      >
                        You
                      </span>
                    ) : null}
                  </div>
                  <div style={{ fontSize: 12, color: "#3A3833", marginTop: 2 }}>
                    {assignment.task}
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 10.5,
                      color,
                      letterSpacing: "0.12em",
                      fontWeight: 700,
                      textTransform: "uppercase",
                    }}
                  >
                    Focus: {SERVICE_LABELS[assignment.focusCategory] || assignment.focusCategory}
                  </div>
                  {isMine ? (
                    <button
                      type="button"
                      onClick={() => onGenerateFlyer(assignment)}
                      style={{
                        marginTop: 8,
                        padding: "6px 10px",
                        borderRadius: 2,
                        border: `1px solid ${color}`,
                        background: color,
                        color: "#FFFFFF",
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Generate my flyer →
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
      <div style={{ fontSize: 10.5, color: "#8A8780", marginTop: 10 }}>
        {formatDateTime(message.createdAt)}
      </div>
    </div>
  );
}

const emptyStateStyle: React.CSSProperties = {
  borderRadius: 2,
  border: "1px dashed rgba(11, 11, 10,0.26)",
  padding: "24px 18px",
  textAlign: "center",
  color: "#8A8780",
  background: "rgba(255,255,255,0.72)",
};
