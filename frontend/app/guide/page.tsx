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
    emoji: "01",
    title: "The Mission",
    body: "Volun-Tiers helps volunteers cover priority zones with clear outreach, useful resource cards, and measurable follow-through. The goal is simple: make local support easier to find, one mission at a time.",
    media: "image",
    mediaNote: "Photo - volunteers coordinating before an outreach route.",
    imageSrc: "/guide-mission.jpg",
  },
  {
    emoji: "02",
    title: "Getting Your Kit",
    body: <>Head to the <a href="/getstarted" style={{ color: "#D44A12", fontWeight: 700, textDecoration: "none" }}>Get Started</a> page or visit <a href="https://www.foodhelpline.org/share" target="_blank" rel="noreferrer" style={{ color: "#D44A12", fontWeight: 700, textDecoration: "none" }}>foodhelpline.org/share</a> to generate a local outreach kit. Print 50 to 100 cards at a nearby copy shop, FedEx, Staples, or your local library.</>,
    media: "image",
    mediaNote: "Photo - printing outreach cards at a copy shop.",
    imageSrc: "https://images.unsplash.com/photo-1562564055-71e051d33c19?w=960&h=540&fit=crop",
  },
  {
    emoji: "03",
    title: "Where to Go",
    body: "Think of places where neighbors naturally pause: laundromats, cafes, church lobbies, community boards, barbershops, libraries, and clinics. Use the Map to find priority areas near you. Always ask before leaving materials inside a business.",
    media: "image",
    mediaNote: "Photo - community board with resource cards pinned up.",
    imageSrc: "https://images.unsplash.com/photo-1572025442646-866d16c84a54?w=960&h=540&fit=crop",
  },
  {
    emoji: "04",
    title: "Talking to People",
    body: "Keep it short and kind: \"Hi, I'm volunteering with Volun-Tiers. This card points people to nearby support.\" You do not need to explain everything. The resource card carries the details.",
    media: "image",
    mediaNote: "Photo - volunteers talking to community members.",
    imageSrc: "https://images.unsplash.com/photo-1531206715517-5c0ba140b2b8?w=960&h=540&fit=crop",
  },
  {
    emoji: "05",
    title: "Know the Rules",
    body: "Public outreach is allowed in many shared spaces, but private property needs permission. Never put materials in mailboxes. When in doubt, ask first and move on respectfully.",
    media: "image",
    mediaNote: "Photo - public sidewalk and private-property boundary.",
    imageSrc: "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=960&h=540&fit=crop",
  },
  {
    emoji: "06",
    title: "Staying Safe",
    body: "Stick to daylight hours and busy streets. Bring a friend if you can. If a conversation turns uncomfortable, do not engage. Move on, log the route, and keep the mission steady.",
    media: "image",
    mediaNote: "Photo - two volunteers walking together on a well-lit street.",
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

      <div className="anim-fade-up d1" style={{ textAlign: "left", marginBottom: 32, borderBottom: "1px solid rgba(11, 11, 10, 0.16)", paddingBottom: 28 }}>
        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 400, letterSpacing: "0.28em", textTransform: "uppercase", color: "#8A8780", marginBottom: 14 }}>
          Volun-Tiers Guide
        </p>
        <h1 style={{ fontFamily: "'Instrument Serif', serif", fontSize: isMobile ? 56 : 104, fontWeight: 400, color: "#0B0B0A", letterSpacing: "-0.045em", lineHeight: 0.9, marginBottom: 16 }}>
          The Mission Guide
        </h1>
        <p style={{ fontSize: isMobile ? 22 : 32, color: "#1A1917", maxWidth: 720, margin: 0, lineHeight: 1.18 }}>
          Everything you need before heading into a volunteer route.
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
              padding: "10px 16px", borderRadius: 0,
              border: active === i ? "1px solid #D44A12" : "1px solid rgba(11, 11, 10,0.16)",
              background: active === i ? "#D44A12" : "transparent",
              color: active === i ? "#F8F6F0" : "#8A8780",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11, fontWeight: 400,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              cursor: "pointer", whiteSpace: "nowrap",
              boxShadow: "none",
            }}
          >
            {sec.emoji} {sec.title.split(" ").slice(0, 3).join(" ")}{sec.title.split(" ").length > 3 ? "…" : ""}
          </button>
        ))}
      </div>

      {/* Content panel */}
      <div className="anim-fade-up d3" style={{
        display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
        background: "#F8F6F0", borderRadius: 2,
        border: "1px solid rgba(11, 11, 10,0.16)",
        boxShadow: "none",
        overflow: "hidden", height: isMobile ? 620 : 420,
      }}>

        {/* Media side */}
        <div style={{ position: "relative", height: isMobile ? 160 : undefined, flexShrink: 0 }}>
          {s.media === "image" ? (
            s.imageSrc ? (
              <div style={{
                height: "100%",
                borderRight: isMobile ? "none" : "1px solid rgba(11, 11, 10,0.08)",
                borderBottom: isMobile ? "1px solid rgba(11, 11, 10,0.08)" : "none",
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
              background: "rgba(212, 74, 18,0.08)",
              borderRight: isMobile ? "none" : "1px dashed rgba(212, 74, 18,0.24)",
              borderBottom: isMobile ? "1px dashed rgba(212, 74, 18,0.24)" : "none",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              gap: 10, color: "#8A8780", padding: "0 24px", textAlign: "center",
            }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: "#D44A12" }}>MEDIA</span>
              <span style={{ fontSize: 12, fontWeight: 600 }}>Image placeholder</span>
              <span style={{ fontSize: 11.5, color: "#B8B3A7", lineHeight: 1.5 }}>{s.mediaNote}</span>
            </div>
            )
          ) : (
            <div style={{
              height: "100%",
              background: "#0B0B0A",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              gap: 10, padding: "0 24px", textAlign: "center",
            }}>
              <div style={{
                width: 52, height: 52, borderRadius: 0,
                background: "rgba(212, 74, 18,0.15)", border: "2px solid rgba(212, 74, 18,0.4)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 20, color: "#D44A12", cursor: "pointer",
              }}>▶</div>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#B8B3A7" }}>Video placeholder</span>
              <span style={{ fontSize: 11.5, color: "#8A8780", lineHeight: 1.5 }}>{s.mediaNote}</span>
            </div>
          )}
        </div>

        {/* Text side */}
        <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: isMobile ? "24px 20px" : "36px 32px", flex: 1, overflowY: "auto" }}>
            <span style={{ width: 44, height: 38, borderRadius: 0, background: "transparent", border: "1px solid rgba(212, 74, 18, 0.22)", color: "#D44A12", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 500, letterSpacing: "0.08em", marginBottom: 18 }}>{s.emoji}</span>
            <h2 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 48, fontWeight: 400, color: "#0B0B0A", letterSpacing: "-0.04em", lineHeight: 0.95, marginBottom: 18 }}>
              {s.title}
            </h2>
            <p style={{ fontSize: 22, color: "#1A1917", lineHeight: 1.3 }}>
              {s.body}
            </p>
          </div>
          <div style={{ padding: isMobile ? "14px 20px" : "14px 32px", borderTop: "1px solid rgba(11, 11, 10,0.08)", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => setActive((i) => Math.max(i - 1, 0))}
              disabled={active === 0}
              style={{
                padding: "9px 18px", borderRadius: 0,
                background: "transparent", border: "1px solid rgba(11, 11, 10,0.12)",
                color: "#8A8780", fontSize: 11, fontWeight: 400, letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer",
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
                padding: "9px 18px", borderRadius: 0,
                background: "transparent", border: "1px solid #D44A12",
                color: "#D44A12", fontSize: 11, fontWeight: 400, letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer",
                opacity: active === sections.length - 1 ? 0.4 : 1,
              }}
            >
              Next →
            </button>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#8A8780", marginLeft: "auto", letterSpacing: "0.14em" }}>
              {active + 1} of {sections.length}
            </span>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div style={{
        padding: isMobile ? "20px 18px" : "24px 32px", borderRadius: 2, marginTop: 24,
        background: "#0B0B0A",
        border: "1px solid rgba(212, 74, 18, 0.18)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: 16,
      }}>
        <div>
          <p style={{ fontFamily: "'Instrument Serif', serif", fontSize: 32, fontWeight: 400, color: "#F8F6F0", letterSpacing: "-0.035em", marginBottom: 6 }}>Ready to get started?</p>
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "rgba(248, 246, 240,0.58)", letterSpacing: "0.08em" }}>Download your kit and find a print point near you.</p>
        </div>
        <Link href="/getstarted" style={{ padding: "14px 24px", borderRadius: 0, background: "transparent", border: "1px solid #D44A12", color: "#D44A12", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 400, letterSpacing: "0.18em", textTransform: "uppercase", textDecoration: "none", whiteSpace: "nowrap" }}>
          Start Mission
        </Link>
      </div>

    </PageContainer>
  );
}
