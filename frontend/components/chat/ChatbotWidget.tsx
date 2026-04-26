"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

type Role = "bot" | "user";

interface Message {
  id: number;
  role: Role;
  text: string;
  link?: { label: string; href: string };
  streaming?: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SUGGESTED_CHIPS = [
  "How do I get started?",
  "Where can I print flyers?",
  "How do I flyer?",
  "How does the map work?",
];

const WELCOME: Message = {
  id: 0,
  role: "bot",
  text: "Hi! I'm Citrus 🍋 Ask me anything about volunteering, printing flyers, or using the map.",
};


// ── Sub-components ────────────────────────────────────────────────────────────

function BotBubble({ message, onLinkClick }: { message: Message; onLinkClick: () => void }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 12 }}>
      <div style={{
        width: 28, height: 28, borderRadius: 8, flexShrink: 0,
        background: "linear-gradient(135deg, #f5c842 0%, #e8a200 100%)",
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
      }}>
        🍋
      </div>
      <div style={{ maxWidth: "80%" }}>
        <div style={{
          background: "#ffffff",
          border: "1px solid rgba(190,155,70,0.18)",
          borderRadius: "4px 14px 14px 14px",
          padding: "10px 14px",
          fontSize: 13,
          color: "#3a2e10",
          lineHeight: 1.65,
          whiteSpace: "pre-wrap",
        }}>
          {message.text}
          {message.streaming && (
            <span style={{
              display: "inline-block",
              width: 8,
              height: 13,
              background: "#c9a84c",
              borderRadius: 2,
              marginLeft: 2,
              verticalAlign: "middle",
              animation: "blink 0.8s step-end infinite",
            }} />
          )}
        </div>
        {message.link && !message.streaming && (
          <Link
            href={message.link.href}
            onClick={onLinkClick}
            style={{
              display: "inline-block",
              marginTop: 6,
              padding: "4px 12px",
              borderRadius: 20,
              background: "rgba(245,200,66,0.15)",
              color: "#d97706",
              fontSize: 12,
              fontWeight: 600,
              textDecoration: "none",
              border: "1px solid rgba(245,200,66,0.3)",
            }}
          >
            {message.link.label} →
          </Link>
        )}
      </div>
    </div>
  );
}

function UserBubble({ message }: { message: Message }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
      <div style={{
        maxWidth: "80%",
        background: "linear-gradient(135deg, #f5c842, #f59e0b)",
        borderRadius: "14px 4px 14px 14px",
        padding: "10px 14px",
        fontSize: 13,
        fontWeight: 600,
        color: "#1a1000",
        lineHeight: 1.5,
      }}>
        {message.text}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 12 }}>
      <div style={{
        width: 28, height: 28, borderRadius: 8, flexShrink: 0,
        background: "linear-gradient(135deg, #f5c842 0%, #e8a200 100%)",
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
      }}>
        🍋
      </div>
      <div style={{
        background: "#ffffff",
        border: "1px solid rgba(190,155,70,0.18)",
        borderRadius: "4px 14px 14px 14px",
        padding: "12px 16px",
        display: "flex",
        gap: 4,
        alignItems: "center",
      }}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="pulse-dot"
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#c9a84c",
              display: "inline-block",
              animationDelay: `${i * 0.15}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ChatbotWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [fabHovered, setFabHovered] = useState(false);
  const [showNudge, setShowNudge] = useState(false);
  const [nudgeDismissed, setNudgeDismissed] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 600);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Conversation history for the API (role/content pairs)
  const historyRef = useRef<{ role: "user" | "assistant"; content: string }[]>([]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Show nudge bubble after 3s, auto-hide after 8s more
  useEffect(() => {
    if (nudgeDismissed || open) return;
    const showTimer = setTimeout(() => setShowNudge(true), 10000);
    const hideTimer = setTimeout(() => {
      setShowNudge(false);
      setNudgeDismissed(true);
    }, 18000);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [nudgeDismissed, open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  async function handleSend(text?: string) {
    const value = (text ?? input).trim();
    if (!value || isLoading) return;
    setInput("");

    const userMsg: Message = { id: Date.now(), role: "user", text: value };
    setMessages((prev) => [...prev, userMsg]);
    historyRef.current.push({ role: "user", content: value });

    setIsLoading(true);

    const botId = Date.now() + 1;
    let accumulated = "";

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: historyRef.current }),
      });

      if (!res.ok || !res.body) throw new Error("API error");

      // Add empty streaming bot message
      setMessages((prev) => [...prev, { id: botId, role: "bot", text: "", streaming: true }]);
      setIsLoading(false);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(chunk, { stream: true });
        // Show text portion only while streaming (hide __LINK__ suffix)
        const displayText = accumulated.split("\n\n__LINK__")[0];
        setMessages((prev) =>
          prev.map((m) => m.id === botId ? { ...m, text: displayText } : m)
        );
      }

      // Parse link from __LINK__ suffix
      const parts = accumulated.split("\n\n__LINK__");
      const text = parts[0];
      let link: { label: string; href: string } | undefined;
      if (parts[1]) {
        try { link = JSON.parse(parts[1]); } catch { /* ignore */ }
      }
      setMessages((prev) =>
        prev.map((m) => m.id === botId ? { ...m, text, streaming: false, link } : m)
      );
      historyRef.current.push({ role: "assistant", content: accumulated });

    } catch {
      setIsLoading(false);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === botId
            ? { ...m, text: "Sorry, something went wrong. Please try again.", streaming: false }
            : m
        )
      );
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const hasUserSpoken = messages.some((m) => m.role === "user");

  return (
    <>
      {/* Cursor blink keyframe */}
      <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>

      {/* ── Chat Panel ── */}
      {open && (
        <div style={{
          position: "fixed",
          bottom: isMobile ? 0 : 92,
          right: isMobile ? 0 : 28,
          width: isMobile ? "100%" : 400,
          height: isMobile ? "100%" : "min(70vh, 600px)",
          zIndex: 10001,
          borderRadius: isMobile ? 0 : 20,
          border: isMobile ? "none" : "1px solid rgba(190,155,70,0.22)",
          boxShadow: isMobile ? "none" : "0 12px 48px rgba(0,0,0,0.16)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          background: "#fdf8e8",
        }}>
          {/* Header */}
          <div style={{
            background: "linear-gradient(135deg, #1a1200 0%, #2c1e00 100%)",
            padding: "14px 18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}>
            <div>
              <div style={{
                fontFamily: "'Fraunces', Georgia, serif",
                fontSize: 15,
                fontWeight: 600,
                color: "#f5c842",
                letterSpacing: "-0.2px",
              }}>
                Citrus
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              style={{
                width: 32, height: 32, borderRadius: 9,
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(245,200,66,0.2)",
                color: "#ede5cc", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
              }}
            >
              ✕
            </button>
          </div>

          {/* Message list */}
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px 8px" }}>
            {messages.map((msg) =>
              msg.role === "bot" ? (
                <BotBubble key={msg.id} message={msg} onLinkClick={() => setOpen(false)} />
              ) : (
                <UserBubble key={msg.id} message={msg} />
              )
            )}
            {isLoading && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggestion chips */}
          {!hasUserSpoken && (
            <div style={{
              display: "flex",
              gap: 6,
              padding: "8px 14px",
              overflowX: "auto",
              flexShrink: 0,
              borderTop: "1px solid rgba(190,155,70,0.12)",
            }}>
              {SUGGESTED_CHIPS.map((chip, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(chip)}
                  style={{
                    whiteSpace: "nowrap",
                    padding: "6px 12px",
                    borderRadius: 20,
                    background: "#ffffff",
                    border: "1px solid rgba(190,155,70,0.22)",
                    color: "#7a6a40",
                    fontSize: 12,
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  {chip}
                </button>
              ))}
            </div>
          )}

          {/* Input row */}
          <div style={{
            display: "flex",
            gap: 8,
            padding: "10px 14px",
            borderTop: "1px solid rgba(190,155,70,0.12)",
            flexShrink: 0,
            background: "#fdf8e8",
          }}>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question…"
              disabled={isLoading}
              style={{
                flex: 1,
                padding: "9px 14px",
                borderRadius: 12,
                border: "1px solid rgba(190,155,70,0.22)",
                background: "#ffffff",
                fontSize: 13,
                color: "#1a1600",
                outline: "none",
              }}
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || isLoading}
              style={{
                padding: "9px 16px",
                borderRadius: 12,
                background: input.trim() && !isLoading
                  ? "linear-gradient(135deg, #f5c842 0%, #e8a200 100%)"
                  : "rgba(0,0,0,0.06)",
                color: input.trim() && !isLoading ? "#1a1000" : "#b0a070",
                fontSize: 13,
                fontWeight: 600,
                border: "none",
                cursor: input.trim() && !isLoading ? "pointer" : "not-allowed",
                transition: "background 0.15s",
              }}
            >
              Send
            </button>
          </div>
        </div>
      )}

      {/* ── Nudge bubble ── */}
      {showNudge && !open && (
        <div
          className="anim-fade-up"
          style={{
            position: "fixed",
            bottom: 88,
            right: 28,
            zIndex: 10002,
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 16px",
            borderRadius: "14px 14px 4px 14px",
            background: "#fffdf5",
            border: "1px solid rgba(245,200,66,0.25)",
            boxShadow: "0 8px 28px rgba(0,0,0,0.10), 0 2px 8px rgba(245,200,66,0.12)",
            cursor: "pointer",
          }}
          onClick={() => {
            setOpen(true);
            setShowNudge(false);
            setNudgeDismissed(true);
          }}
        >
          <span style={{ fontSize: 16 }}>🍋</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#5f502d", whiteSpace: "nowrap" }}>
            Need any help?
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowNudge(false);
              setNudgeDismissed(true);
            }}
            style={{
              marginLeft: 4,
              width: 18,
              height: 18,
              borderRadius: 99,
              border: "none",
              background: "rgba(0,0,0,0.06)",
              color: "#9a8a60",
              fontSize: 11,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            &times;
          </button>
        </div>
      )}

      {/* ── FAB ── */}
      <button
        onClick={() => {
          setOpen((v) => !v);
          setHasOpened(true);
          setShowNudge(false);
          setNudgeDismissed(true);
        }}
        onMouseEnter={() => setFabHovered(true)}
        onMouseLeave={() => setFabHovered(false)}
        aria-label="Open help chat"
        className={!open && !hasOpened ? "anim-fab-entrance" : undefined}
        style={{
          position: "fixed",
          bottom: 28,
          right: 28,
          zIndex: 10002,
          width: 52,
          height: 52,
          borderRadius: 16,
          background: "linear-gradient(135deg, #f5c842 0%, #e8a200 100%)",
          boxShadow: fabHovered
            ? "0 6px 24px rgba(245,200,66,0.65)"
            : "0 4px 18px rgba(245,200,66,0.45)",
          border: "none",
          cursor: "pointer",
          fontSize: 22,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: fabHovered ? "scale(1.07)" : undefined,
          transition: "transform 0.18s",
        }}
      >
        {open ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1a1000" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : "🍋"}
      </button>
    </>
  );
}
