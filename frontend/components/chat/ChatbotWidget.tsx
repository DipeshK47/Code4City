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
  "Where can I print cards?",
  "How do missions work?",
  "How does the map work?",
];

const WELCOME: Message = {
  id: 0,
  role: "bot",
  text: "Hi, I'm Relay. Ask me about missions, print points, outreach kits, or using the map.",
};


// ── Sub-components ────────────────────────────────────────────────────────────

function BotBubble({ message, onLinkClick }: { message: Message; onLinkClick: () => void }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 12 }}>
      <div style={{
        width: 28, height: 28, borderRadius: 0, flexShrink: 0,
        background: "transparent",
        border: "1px solid #D44A12",
        display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 500, letterSpacing: "0.08em", color: "#D44A12",
      }}>
        RL
      </div>
      <div style={{ maxWidth: "80%" }}>
        <div style={{
          background: "#F8F6F0",
          border: "1px solid rgba(11, 11, 10,0.16)",
          borderRadius: 2,
          padding: "10px 14px",
          fontSize: 18,
          color: "#1A1917",
          lineHeight: 1.35,
          whiteSpace: "pre-wrap",
        }}>
          {message.text}
          {message.streaming && (
            <span style={{
              display: "inline-block",
              width: 8,
              height: 13,
              background: "#D44A12",
              borderRadius: 0,
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
              padding: "6px 12px",
              borderRadius: 0,
              background: "transparent",
              color: "#D44A12",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              fontWeight: 400,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              textDecoration: "none",
              border: "1px solid rgba(212, 74, 18,0.24)",
            }}
          >
            {message.link.label} -&gt;
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
        background: "#0B0B0A",
        borderRadius: 2,
        padding: "10px 14px",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 12,
        fontWeight: 400,
        color: "#F8F6F0",
        lineHeight: 1.6,
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
        width: 28, height: 28, borderRadius: 0, flexShrink: 0,
        background: "transparent",
        border: "1px solid #D44A12",
        display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 500, letterSpacing: "0.08em", color: "#D44A12",
      }}>
        RL
      </div>
      <div style={{
        background: "#F8F6F0",
        border: "1px solid rgba(11, 11, 10,0.16)",
        borderRadius: 2,
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
              background: "#D44A12",
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
          borderRadius: isMobile ? 0 : 2,
          border: isMobile ? "none" : "1px solid rgba(11, 11, 10,0.12)",
          boxShadow: "none",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          background: "#F3F0E9",
        }}>
          {/* Header */}
          <div style={{
            background: "#0B0B0A",
            borderBottom: "1px solid rgba(212, 74, 18, 0.18)",
            padding: "14px 18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}>
            <div>
              <div style={{
                fontFamily: "'Instrument Serif', serif",
                fontSize: 26,
                fontWeight: 400,
                color: "#F8F6F0",
                letterSpacing: "-0.035em",
              }}>
                Relay
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              style={{
                width: 32, height: 32, borderRadius: 0,
                background: "transparent",
                border: "1px solid rgba(212, 74, 18,0.22)",
                color: "#D44A12", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
              }}
            >
              X
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
              borderTop: "1px solid rgba(11, 11, 10,0.08)",
            }}>
              {SUGGESTED_CHIPS.map((chip, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(chip)}
                  style={{
                    whiteSpace: "nowrap",
                    padding: "6px 12px",
                    borderRadius: 0,
                    background: "#F8F6F0",
                    border: "1px solid rgba(11, 11, 10,0.16)",
                    color: "#8A8780",
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 11,
                    letterSpacing: "0.08em",
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
            borderTop: "1px solid rgba(11, 11, 10,0.08)",
            flexShrink: 0,
            background: "#F3F0E9",
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
                borderRadius: 0,
                border: "1px solid rgba(11, 11, 10,0.12)",
                background: "#F8F6F0",
                fontSize: 13,
                color: "#0B0B0A",
                outline: "none",
              }}
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || isLoading}
              style={{
                padding: "9px 16px",
                borderRadius: 0,
                background: input.trim() && !isLoading
                  ? "transparent"
                  : "rgba(0,0,0,0.06)",
                color: input.trim() && !isLoading ? "#D44A12" : "#B8B3A7",
                fontSize: 11,
                fontWeight: 400,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                border: input.trim() && !isLoading ? "1px solid #D44A12" : "1px solid rgba(11, 11, 10,0.08)",
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
            borderRadius: 2,
            background: "#F8F6F0",
            border: "1px solid rgba(212, 74, 18,0.22)",
            boxShadow: "none",
            cursor: "pointer",
          }}
          onClick={() => {
            setOpen(true);
            setShowNudge(false);
            setNudgeDismissed(true);
          }}
        >
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 500, color: "#D44A12", letterSpacing: "0.08em" }}>RL</span>
          <span style={{ fontSize: 18, color: "#1A1917", whiteSpace: "nowrap" }}>
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
              borderRadius: 0,
              border: "none",
              background: "rgba(0,0,0,0.06)",
              color: "#8A8780",
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
          borderRadius: 0,
          background: fabHovered ? "#D44A12" : "#F8F6F0",
          boxShadow: "none",
          border: "1px solid #D44A12",
          cursor: "pointer",
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "0.06em",
          color: fabHovered ? "#F8F6F0" : "#D44A12",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: fabHovered ? "translateY(-2px)" : undefined,
          transition: "transform 0.25s, background 0.25s, color 0.25s",
        }}
      >
        {open ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={fabHovered ? "#F8F6F0" : "#D44A12"} strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : "RL"}
      </button>
    </>
  );
}
