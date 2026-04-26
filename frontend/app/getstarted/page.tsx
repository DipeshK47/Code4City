"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import PageContainer from "@/components/layout/PageContainer";
import SectionCard from "@/components/common/SectionCard";
import GetOutreachKitWithQr from "@/components/getstarted/GetOutreachKitWithQr";

const steps = [
  {
    step: "01", emoji: "READ",
    title: "Learn the Mission",
    desc: "Understand how Volun-Tiers helps neighbors find local support through simple, organized outreach.",
    action: "Read the Guide", href: "/guide",
    bg: "#F8F6F0", border: "#EBE7DE", accent: "#D44A12",
  },
  {
    step: "02", emoji: "KIT",
    title: "Download Your Outreach Kit",
    desc: "Get printable resource cards for your neighborhood. Enter an area and generate a ready-to-share kit.",
    action: "Get Kit", href: "https://www.foodhelpline.org/share",
    bg: "#EBE7DE", border: "#EBE7DE", accent: "#D64B14",
  },
  {
    step: "03", emoji: "PRT",
    title: "Find a Print Point",
    desc: "Use the printer locator to find a convenient place to print outreach cards, from copy shops to local libraries.",
    action: "Find Printers", href: "/printers",
    bg: "#EBE7DE", border: "#EBE7DE", accent: "#D44A12",
  },
  {
    step: "04", emoji: "GO",
    title: "Start a Mission",
    desc: "Head to a priority zone, share materials with nearby community spaces, and log your route to earn points.",
    action: "View the Map", href: "/map",
    bg: "#EBE7DE", border: "#EBE7DE", accent: "#EA580C",
  },
];

const faqs = [
  { q: "Do I need any experience?",               a: "No experience needed. Pick up the kit, choose a zone, and follow the mission checklist." },
  { q: "How much time does it take?",             a: "Most volunteers spend 1-2 hours per session, on their own schedule." },
  { q: "How much does printing cost?",            a: "Printing costs vary by shop, typically $0.09-$0.15 per page. Use Print Points to compare nearby options." },
  { q: "How do I prove my volunteering hours?",   a: "We automatically track your activity. You can export a PDF certificate whenever you need documentation." },
  { q: "Can I volunteer with friends or family?", a: "Absolutely. Missions move faster when you coordinate with a small team." },
  { q: "What if someone asks me a question I can't answer?", a: "Point them to the resource card. It includes the key details and a link to nearby support." },
];

export default function GetStartedPage() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 700px)");
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return (
    <PageContainer>

      {/* ── Hero ──────────────────────────────────────────────── */}
      <div
        className="anim-fade-up d1"
        style={{
          position: "relative", borderRadius: 2, overflow: "hidden",
          background: "#F8F6F0",
          border: "1px solid rgba(11, 11, 10, 0.16)",
          boxShadow: "none",
          padding: "clamp(34px, 5vw, 58px) clamp(20px, 5vw, 64px)", textAlign: "left", marginBottom: 28,
        }}
      >
        <div style={{ position: "absolute", right: 28, top: 28, width: 54, height: 54, border: "1px solid #D44A12", color: "#D44A12", display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 500, letterSpacing: "0.14em", lineHeight: 1 }}>VT</div>
        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", color: "#8A8780", marginBottom: 18 }}>Field Start</p>
        <h2 style={{ fontFamily: "'Instrument Serif', serif", fontSize: "clamp(48px, 7vw, 104px)", fontWeight: 400, color: "#0B0B0A", letterSpacing: "-0.045em", lineHeight: 0.9, marginBottom: 16 }}>
          Start With Volun-Tiers
        </h2>
        <p style={{ fontSize: "clamp(21px, 2vw, 32px)", color: "#1A1917", maxWidth: 700, margin: 0, lineHeight: 1.18 }}>
          <span style={{ fontStyle: "italic", color: "#D44A12" }}>Tagline placeholder goes here.</span> Use these four steps to move from interest to live mission.
        </p>
      </div>

      {/* ── Steps ─────────────────────────────────────────────── */}
      <div
        className="anim-fade-up d2"
        style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)", gap: 16, marginBottom: 24 }}
      >
        {steps.map((s) => (
          <div
            key={s.step}
            style={{
              padding: "24px 26px", borderRadius: 2,
              background: "#F8F6F0",
              border: "1px solid rgba(11, 11, 10, 0.16)",
              boxShadow: "none",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 0, background: "transparent", border: "1px solid rgba(212, 74, 18, 0.22)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 500, letterSpacing: "0.08em", color: "#D44A12", flexShrink: 0, boxShadow: "none" }}>
                {s.emoji}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 400, letterSpacing: "0.22em", textTransform: "uppercase", color: "#D44A12", marginBottom: 8 }}>
                  STEP {s.step}
                </p>
                <h3 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 30, fontWeight: 400, color: "#0B0B0A", letterSpacing: "-0.035em", lineHeight: 1, marginBottom: 10 }}>
                  {s.title}
                </h3>
                <p style={{ fontSize: 18, color: "#8A8780", lineHeight: 1.32, marginBottom: 16 }}>
                  {s.desc}
                </p>
                {s.step === "02" ? (
                  <GetOutreachKitWithQr />
                ) : s.href.startsWith("http") ? (
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 400, color: "#D44A12", textDecoration: "none", letterSpacing: "0.14em", textTransform: "uppercase" }}
                  >
                    {s.action} &rarr;
                  </a>
                ) : (
                  <Link href={s.href} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 400, color: "#D44A12", textDecoration: "none", letterSpacing: "0.14em", textTransform: "uppercase" }}>
                    {s.action} &rarr;
                  </Link>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── FAQ ───────────────────────────────────────────────── */}
      <SectionCard
        title="Common Questions"
        subtitle="Everything you need to know before you start"
        style={{ marginBottom: 24 }}
      >
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)", gap: "12px 40px" }}>
          {faqs.map((faq, i) => (
            <div key={faq.q} style={{ padding: "14px 0", borderBottom: i < 4 ? "1px solid rgba(11, 11, 10,0.08)" : "none" }}>
              <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 500, color: "#0B0B0A", marginBottom: 6, letterSpacing: "0.08em", textTransform: "uppercase" }}>{faq.q}</p>
              <p style={{ fontSize: 18, color: "#8A8780", lineHeight: 1.3 }}>{faq.a}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* ── Tip bar ───────────────────────────────────────────── */}
      <div
        className="anim-fade-up d5"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          padding: "14px 20px",
          borderRadius: 2,
          background: "#F8F6F0",
          border: "1px solid rgba(212, 74, 18,0.18)",
        }}
      >
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 500, color: "#D44A12", letterSpacing: "0.16em" }}>TIP</span>
        <span style={{ fontSize: 18, color: "#8A8780" }}>
          <strong style={{ color: "#0B0B0A" }}>Tip:</strong> Need help? Click the <strong style={{ color: "#D44A12" }}>Relay assistant</strong> in the bottom-right corner anytime.
        </span>
      </div>

    </PageContainer>
  );
}
