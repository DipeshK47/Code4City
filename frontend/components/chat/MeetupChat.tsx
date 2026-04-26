"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { getMeetupMessages, sendMeetupMessage } from "@/lib/meetup-api";
import { formatDateTime, formatDisplayName } from "@/lib/social-format";
import type { MeetupMessage } from "@/lib/social-types";
import { primaryButtonStyle } from "../community/CreatePostForm";

export default function MeetupChat({
  meetupId,
  token,
  currentUserId,
  enabled,
}: {
  meetupId: number;
  token?: string | null;
  currentUserId?: number | null;
  enabled: boolean;
}) {
  const [messages, setMessages] = useState<MeetupMessage[]>([]);
  const [messageText, setMessageText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
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

    return () => {
      window.clearInterval(intervalId);
    };
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

  if (!enabled) {
    return (
      <div style={emptyStateStyle}>
        Join the meetup to unlock the group chat.
      </div>
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
          maxHeight: 380,
          minHeight: 220,
          overflowY: "auto",
          padding: 16,
          display: "grid",
          gap: 10,
          background:
            "#F8F6F0",
        }}
      >
        {isLoading ? (
          <p style={{ margin: 0, fontSize: 12.5, color: "#8A8780" }}>Loading chat...</p>
        ) : messages.length > 0 ? (
          messages.map((message) => {
            const isMine = currentUserId === message.userId;
            return (
              <div
                key={message.id}
                style={{
                  justifySelf: isMine ? "end" : "start",
                  maxWidth: "78%",
                  borderRadius: 2,
                  padding: "11px 13px",
                  background: isMine ? "rgba(217,249,157,0.9)" : "#F8F6F0",
                  border: "1px solid rgba(11, 11, 10,0.16)",
                  boxShadow: "none",
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 800, color: "#4b5563", marginBottom: 4 }}>
                  {formatDisplayName(message.sender)}
                </div>
                <div style={{ fontSize: 13, color: "#1f2b12", lineHeight: 1.5 }}>
                  {message.messageText}
                </div>
                <div style={{ fontSize: 10.5, color: "#7c8a67", marginTop: 6 }}>
                  {formatDateTime(message.createdAt)}
                </div>
              </div>
            );
          })
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
        <div>
          <button
            type="button"
            disabled={isSending}
            onClick={() => void handleSend()}
            style={{ ...primaryButtonStyle, opacity: isSending ? 0.72 : 1 }}
          >
            {isSending ? "Sending..." : "Send message"}
          </button>
        </div>
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
