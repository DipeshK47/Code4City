"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { getThread, getThreadMessages, sendThreadMessage } from "@/lib/messages-api";
import { formatDateTime, formatDisplayName } from "@/lib/social-format";
import type { DMMessage, DMThread } from "@/lib/social-types";
import UserIdentity from "../community/UserIdentity";
import { primaryButtonStyle } from "../community/CreatePostForm";

export default function DMChatWindow({
  threadId,
  token,
  currentUserId,
}: {
  threadId?: number;
  token?: string | null;
  currentUserId?: number | null;
}) {
  const [thread, setThread] = useState<DMThread | null>(null);
  const [messages, setMessages] = useState<DMMessage[]>([]);
  const [messageText, setMessageText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  const loadThread = useEffectEvent(async () => {
    if (!token || !threadId) {
      setThread(null);
      setMessages([]);
      setIsLoading(false);
      return;
    }

    try {
      const [threadResponse, messagesResponse] = await Promise.all([
        getThread(token, threadId),
        getThreadMessages(token, threadId),
      ]);

      setThread(threadResponse.data);
      setMessages(messagesResponse.data);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load messages.");
    } finally {
      setIsLoading(false);
    }
  });

  useEffect(() => {
    setIsLoading(true);
    void loadThread();
  }, [threadId, token]);

  useEffect(() => {
    if (!token || !threadId) return;

    const intervalId = window.setInterval(() => {
      void loadThread();
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [threadId, token]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    if (!token || !threadId || !messageText.trim()) return;

    setIsSending(true);
    setError(null);

    try {
      const response = await sendThreadMessage(token, threadId, messageText);
      setMessages((current) => [...current, response.data]);
      setMessageText("");
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Could not send message.");
    } finally {
      setIsSending(false);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  }

  if (!threadId) {
    return (
      <div style={placeholderStyle}>
        <svg
          width="36"
          height="36"
          viewBox="0 0 24 24"
          fill="none"
          stroke="rgba(190,155,70,0.35)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <div style={{ marginTop: 12, fontSize: 14, fontWeight: 600, color: "#5f502d" }}>
          No conversation open
        </div>
        <div style={{ marginTop: 4, fontSize: 12.5, color: "#9a8a60", maxWidth: 260, lineHeight: 1.5 }}>
          Pick a thread from the left, or start a new one from a post or meetup.
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        borderRadius: 22,
        border: "1px solid rgba(190,155,70,0.18)",
        background: "#fffef9",
        overflow: "hidden",
        minHeight: 560,
        display: "grid",
        gridTemplateRows: "auto 1fr auto",
      }}
    >
      <div
        style={{
          padding: 16,
          borderBottom: "1px solid rgba(190,155,70,0.16)",
          background: "#ffffff",
        }}
      >
        {thread ? (
          <UserIdentity
            user={thread.otherUser}
            subtitle={`Chatting with ${formatDisplayName(thread.otherUser)}`}
          />
        ) : (
          <p style={{ margin: 0, fontSize: 13, color: "#8a7a50" }}>
            Loading thread...
          </p>
        )}
      </div>

      <div
        style={{
          padding: 16,
          overflowY: "auto",
          display: "grid",
          gap: 4,
          alignContent: "start",
          background:
            "linear-gradient(180deg, rgba(255,254,249,1) 0%, rgba(255,252,240,1) 100%)",
        }}
      >
        {isLoading ? (
          <p style={{ margin: 0, fontSize: 12.5, color: "#8a7a50" }}>Loading messages...</p>
        ) : messages.length > 0 ? (
          messages.map((message, index) => {
            const isMine = Number(message.senderUserId) === Number(currentUserId);
            const prev = index > 0 ? messages[index - 1] : null;
            const next = index < messages.length - 1 ? messages[index + 1] : null;
            const sameSenderAsPrev = prev?.senderUserId === message.senderUserId;
            const sameSenderAsNext = next?.senderUserId === message.senderUserId;
            const isLastInGroup = !sameSenderAsNext;

            return (
              <div
                key={message.id}
                style={{
                  justifySelf: isMine ? "end" : "start",
                  maxWidth: "76%",
                  marginTop: sameSenderAsPrev ? 0 : 8,
                }}
              >
                {!sameSenderAsPrev && (
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#8a7a50",
                      marginBottom: 4,
                      textAlign: isMine ? "right" : "left",
                      padding: "0 4px",
                    }}
                  >
                    {isMine ? "You" : formatDisplayName(message.sender)}
                  </div>
                )}
                <div
                  style={{
                    borderRadius: sameSenderAsPrev
                      ? 14
                      : isMine
                        ? "14px 14px 4px 14px"
                        : "14px 14px 14px 4px",
                    padding: "10px 13px",
                    background: isMine ? "rgba(245,200,66,0.14)" : "#ffffff",
                    border: isMine
                      ? "1px solid rgba(245,200,66,0.22)"
                      : "1px solid rgba(190,155,70,0.14)",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
                  }}
                >
                  <div style={{ fontSize: 13, color: "#1f1a0b", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                    {message.messageText}
                  </div>
                </div>
                {isLastInGroup && (
                  <div
                    style={{
                      fontSize: 10.5,
                      color: "#9a8a60",
                      marginTop: 3,
                      textAlign: isMine ? "right" : "left",
                      padding: "0 4px",
                    }}
                  >
                    {formatDateTime(message.createdAt)}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>👋</div>
            <div style={{ fontSize: 13, color: "#8a7a50" }}>
              No messages yet. Say hello!
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div
        style={{
          borderTop: "1px solid rgba(190,155,70,0.16)",
          padding: 14,
          display: "flex",
          gap: 10,
          alignItems: "flex-end",
          background: "#ffffff",
        }}
      >
        <textarea
          value={messageText}
          onChange={(event) => setMessageText(event.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder="Type a message..."
          style={{
            flex: 1,
            borderRadius: 14,
            border: "1px solid rgba(190,155,70,0.22)",
            background: "#faf9f6",
            padding: "10px 14px",
            fontSize: 13,
            resize: "none",
            outline: "none",
            minHeight: 40,
            maxHeight: 120,
            lineHeight: 1.5,
          }}
        />
        <button
          type="button"
          disabled={isSending || !messageText.trim()}
          onClick={() => void handleSend()}
          style={{
            ...primaryButtonStyle,
            opacity: isSending || !messageText.trim() ? 0.55 : 1,
            flexShrink: 0,
            padding: "10px 18px",
          }}
        >
          {isSending ? "..." : "Send"}
        </button>
      </div>
      {error ? (
        <div style={{ padding: "0 14px 10px", fontSize: 12, color: "#b91c1c" }}>{error}</div>
      ) : null}
    </div>
  );
}

const placeholderStyle: React.CSSProperties = {
  minHeight: 560,
  borderRadius: 22,
  border: "1px dashed rgba(190,155,70,0.20)",
  background: "rgba(255,253,245,0.72)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
  textAlign: "center",
};
