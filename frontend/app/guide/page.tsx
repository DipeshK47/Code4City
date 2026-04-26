"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import PageContainer from "@/components/layout/PageContainer";

interface Section {
  emoji: string;
  title: string;
  body: React.ReactNode;
  media: "image" | "video";
  mediaNote: string;
  imageSrc?: string;
}

const sections: Section[] = [
  {
    emoji: "🍋",
    title: "The Mission",
    body: "1 in 8 Americans need help with food. Not because there isn't enough, but because they don't know where to find it. Lemontree connects families to free pantries, fridges, and food programs nearby, and you're about to help us reach more. One flyer. One family. That's the math.",
    media: "image",
    mediaNote: "Photo — volunteer handing a flyer to a neighbor on the street.",
    imageSrc: "/guide-mission.jpg",
  },
  {
    emoji: "📄",
    title: "Getting Your Flyers",
    body: <>Head to the <a href="/getstarted" style={{ color: "#d97706", fontWeight: 600, textDecoration: "none" }}>Get Started</a> page or visit <a href="https://www.foodhelpline.org/share" target="_blank" rel="noreferrer" style={{ color: "#d97706", fontWeight: 600, textDecoration: "none" }}>foodhelpline.org/share</a> to generate a custom flyer for your area. Takes 30 seconds. Print 50 to 100 copies at a nearby copy shop — Staples, FedEx, or your local library. Usually under $10 total.</>,
    media: "image",
    mediaNote: "Photo — printing flyers at a copy shop.",
    imageSrc: "https://images.unsplash.com/photo-1562564055-71e051d33c19?w=960&h=540&fit=crop",
  },
  {
    emoji: "📍",
    title: "Where to Go",
    body: "Think: anywhere neighbors slow down. Laundromats, cafes, church lobbies, community boards, barbershops. Use the Map to find high-need areas near you. Always ask before leaving flyers inside a business — most people are happy to help.",
    media: "image",
    mediaNote: "Photo — community bulletin board or laundromat with flyers pinned up.",
    imageSrc: "https://images.unsplash.com/photo-1572025442646-866d16c84a54?w=960&h=540&fit=crop",
  },
  {
    emoji: "🤝",
    title: "Talking to People",
    body: "The whole pitch is three words: free food nearby. Just say: \"Hi, I'm volunteering with Lemontree. Here's a flyer about free food in the neighborhood.\" You don't have to explain everything. The flyer does the heavy lifting.",
    media: "image",
    mediaNote: "Photo — volunteers talking to community members.",
    imageSrc: "https://images.unsplash.com/photo-1531206715517-5c0ba140b2b8?w=960&h=540&fit=crop",
  },
  {
    emoji: "⚖️",
    title: "Know the Rules",
    body: "Good news: flyering in public is protected by the First Amendment. One hard rule though: never put anything in a mailbox. Federal offense, no exceptions. On private property, just ask. Most people say yes.",
    media: "image",
    mediaNote: "Photo — public sidewalk on one side, private property / 'no trespassing' sign contrast on the other.",
    imageSrc: "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=960&h=540&fit=crop",
  },
  {
    emoji: "🔒",
    title: "Staying Safe",
    body: "Stick to daylight hours and busy streets. Bring a friend if you can, it makes the route faster and more fun. If someone gets confrontational about the flyers, don't engage. Just move on. And dress for the weather. You'll be outside longer than you think.",
    media: "image",
    mediaNote: "Photo — two volunteers walking together on a well-lit street during the day.",
    imageSrc: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=960&h=540&fit=crop",
  },
];

export default function GuidePage() {
  const [active, setActive] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const s = sections[active];

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 700px)");
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return (
    <PageContainer>

      <div className="anim-fade-up d1" style={{ textAlign: "center", marginBottom: 32 }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#d97706", marginBottom: 10 }}>
          Volunteer Guide
        </p>
        <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: isMobile ? 24 : 34, fontWeight: 700, color: "#1a1000", letterSpacing: "-0.8px", marginBottom: 12 }}>
          The Volunteer Guide
        </h1>
        <p style={{ fontSize: 14.5, color: "#7a6a40", maxWidth: 480, margin: "0 auto" }}>
          Everything you need to know before heading out to flyer your neighborhood.
        </p>
      </div>

      {/* Tab bar */}
      <div className="anim-fade-up d2" style={{
        display: "flex", gap: 6, marginBottom: 24, overflowX: "auto",
        paddingBottom: 4,
      }}>
        {sections.map((sec, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setActive(i)}
            style={{
              flexShrink: 0,
              padding: "8px 16px", borderRadius: 10,
              border: active === i ? "none" : "1px solid rgba(190,155,70,0.22)",
              background: active === i ? "#f5c842" : "#ffffff",
              color: active === i ? "#1a1000" : "#7a6a40",
              fontSize: 12.5, fontWeight: 600,
              cursor: "pointer", whiteSpace: "nowrap",
              boxShadow: active === i ? "0 2px 8px rgba(245,200,66,0.3)" : "none",
            }}
          >
            {sec.emoji} {sec.title.split(" ").slice(0, 3).join(" ")}{sec.title.split(" ").length > 3 ? "…" : ""}
          </button>
        ))}
      </div>

      {/* Content panel */}
      <div className="anim-fade-up d3" style={{
        display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
        background: "#ffffff", borderRadius: 20,
        border: "1px solid rgba(190,155,70,0.18)",
        boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
        overflow: "hidden", height: isMobile ? 620 : 420,
      }}>

        {/* Media side */}
        <div style={{ position: "relative", height: isMobile ? 160 : undefined, flexShrink: 0 }}>
          {s.media === "image" ? (
            s.imageSrc ? (
              <div style={{
                height: "100%",
                borderRight: isMobile ? "none" : "1px solid rgba(190,155,70,0.12)",
                borderBottom: isMobile ? "1px solid rgba(190,155,70,0.12)" : "none",
                overflow: "hidden",
              }}>
                <img
                  src={s.imageSrc}
                  alt={s.mediaNote}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </div>
            ) : (
            <div style={{
              height: "100%",
              background: "rgba(245,200,66,0.08)",
              borderRight: isMobile ? "none" : "1px dashed rgba(190,155,70,0.25)",
              borderBottom: isMobile ? "1px dashed rgba(190,155,70,0.25)" : "none",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              gap: 10, color: "#b0a070", padding: "0 24px", textAlign: "center",
            }}>
              <span style={{ fontSize: 36 }}>📷</span>
              <span style={{ fontSize: 12, fontWeight: 600 }}>Image placeholder</span>
              <span style={{ fontSize: 11.5, color: "#c8b888", lineHeight: 1.5 }}>{s.mediaNote}</span>
            </div>
            )
          ) : (
            <div style={{
              height: "100%",
              background: "#1a1600",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              gap: 10, padding: "0 24px", textAlign: "center",
            }}>
              <div style={{
                width: 52, height: 52, borderRadius: "50%",
                background: "rgba(245,200,66,0.15)", border: "2px solid rgba(245,200,66,0.4)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 20, color: "#f5c842", cursor: "pointer",
              }}>▶</div>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#9a8a60" }}>Video placeholder</span>
              <span style={{ fontSize: 11.5, color: "#5a4a30", lineHeight: 1.5 }}>{s.mediaNote}</span>
            </div>
          )}
        </div>

        {/* Text side */}
        <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: isMobile ? "24px 20px" : "36px 32px", flex: 1, overflowY: "auto" }}>
            <span style={{ fontSize: 36, marginBottom: 16, display: "block" }}>{s.emoji}</span>
            <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 22, fontWeight: 700, color: "#1a1600", letterSpacing: "-0.4px", marginBottom: 14 }}>
              {s.title}
            </h2>
            <p style={{ fontSize: 14, color: "#5a4a20", lineHeight: 1.8 }}>
              {s.body}
            </p>
          </div>
          <div style={{ padding: isMobile ? "14px 20px" : "14px 32px", borderTop: "1px solid rgba(190,155,70,0.12)", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => setActive((i) => Math.max(i - 1, 0))}
              disabled={active === 0}
              style={{
                padding: "9px 18px", borderRadius: 10,
                background: "transparent", border: "1px solid rgba(190,155,70,0.3)",
                color: "#7a6a40", fontSize: 13, fontWeight: 600, cursor: "pointer",
                opacity: active === 0 ? 0.4 : 1,
              }}
            >
              ← Prev
            </button>
            <button
              type="button"
              onClick={() => setActive((i) => Math.min(i + 1, sections.length - 1))}
              disabled={active === sections.length - 1}
              style={{
                padding: "9px 18px", borderRadius: 10,
                background: "#f5c842", border: "none",
                color: "#1a1000", fontSize: 13, fontWeight: 600, cursor: "pointer",
                opacity: active === sections.length - 1 ? 0.4 : 1,
              }}
            >
              Next →
            </button>
            <span style={{ fontSize: 11.5, color: "#b0a070", marginLeft: "auto" }}>
              {active + 1} of {sections.length}
            </span>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div style={{
        padding: isMobile ? "20px 18px" : "22px 32px", borderRadius: 18, marginTop: 24,
        background: "linear-gradient(120deg, #1a1200 55%, #2c1e00 100%)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: 16,
      }}>
        <div>
          <p style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 16, fontWeight: 700, color: "#f5c842", marginBottom: 4 }}>Ready to get started?</p>
          <p style={{ fontSize: 12.5, color: "rgba(237,218,170,0.5)" }}>Download your flyers and find a printer near you.</p>
        </div>
        <Link href="/getstarted" style={{ padding: "11px 24px", borderRadius: 12, background: "#f5c842", color: "#1a1000", fontSize: 13, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" }}>
          🚀 Let&rsquo;s Go
        </Link>
      </div>

    </PageContainer>
  );
}
