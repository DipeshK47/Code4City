"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import PageContainer from "@/components/layout/PageContainer";
import SectionCard from "@/components/common/SectionCard";
import GetFlyersWithQr from "@/components/getstarted/GetFlyersWithQr";

const steps = [
  {
    step: "01", emoji: "📖",
    title: "Learn About Flyering",
    desc: "Understand what food resource flyering is and how it connects neighbors to free food programs, pantries, and community fridges near them.",
    action: "Read the Guide", href: "/guide",
    bg: "#fef9c3", border: "#fde68a", accent: "#d97706",
  },
  {
    step: "02", emoji: "📄",
    title: "Download Your Flyers",
    desc: "Get printable flyers customized for your neighborhood. Available in English and Spanish. Just enter your area and we'll generate the right flyer.",
    action: "Get Flyers", href: "https://www.foodhelpline.org/share",
    bg: "#ede9fe", border: "#ddd6fe", accent: "#7c3aed",
  },
  {
    step: "03", emoji: "🖨️",
    title: "Find a Nearby Printer",
    desc: "Use our printer locator to find the cheapest and most convenient place to print your flyers, from Staples to your local library.",
    action: "Find Printers", href: "/printers",
    bg: "#dcfce7", border: "#bbf7d0", accent: "#16a34a",
  },
  {
    step: "04", emoji: "🚶",
    title: "Start Volunteering",
    desc: "Head out to your assigned zone, distribute flyers to residents, businesses, and community boards. Log your activity to earn points!",
    action: "View the Map", href: "/map",
    bg: "#fee2e2", border: "#fecaca", accent: "#dc2626",
  },
];

const faqs = [
  { q: "Do I need any experience?",               a: "No experience needed! All you need is enthusiasm. Download the flyers, print them at a nearby shop, and we'll guide you from there." },
  { q: "How much time does it take?",              a: "Most volunteers spend 1–2 hours per session, on their own schedule." },
  { q: "How much does it cost to print flyers?",   a: "Printing costs vary by shop, typically $0.09–$0.15 per page. Use our Nearby Printers tab to find the most affordable option close to you." },
  { q: "How do I prove my volunteering hours?",    a: "We automatically track your activity. You can export a PDF certificate at any time to share with colleges, employers, or anyone who needs proof of your work." },
  { q: "Can I volunteer with friends or family?",  a: "Absolutely, it's actually more fun that way. Routes go faster and it's a great activity to do together." },
  { q: "What if someone asks me a question I can't answer?", a: "Just point them to the flyer. It has the key info and a link to find resources near them. You don't need to be an expert, the flyer does the heavy lifting." },
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
          position: "relative", borderRadius: 20, overflow: "hidden",
          background: "linear-gradient(130deg, #f5c842 0%, #fbbf24 60%, #f59e0b 100%)",
          boxShadow: "0 8px 32px rgba(245,200,66,0.35)",
          padding: "clamp(28px, 5vw, 48px) clamp(20px, 5vw, 56px)", textAlign: "center", marginBottom: 28,
        }}
      >
        <div style={{ position: "absolute", top: -40, right: -40, width: 200, height: 200, borderRadius: "50%", background: "rgba(255,255,255,0.12)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -50, left: -30, width: 160, height: 160, borderRadius: "50%", background: "rgba(255,255,255,0.08)", pointerEvents: "none" }} />
        <div className="anim-float" style={{ fontSize: 52, marginBottom: 14, lineHeight: 1 }}>🍋</div>
        <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: "clamp(24px, 5vw, 34px)", fontWeight: 700, color: "#1a1000", letterSpacing: "-0.8px", marginBottom: 10 }}>
          Welcome to the Hub
        </h2>
        <p style={{ fontSize: 14.5, color: "rgba(60,40,0,0.65)", maxWidth: 480, margin: "0 auto" }}>
          Flyering is one of the simplest ways to help. A single flyer can connect a family to food.
          Here&apos;s how to get started in 4 easy steps.
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
              padding: "24px 26px", borderRadius: 18,
              background: s.bg,
              border: `1.5px solid ${s.border}`,
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0, boxShadow: "0 2px 8px rgba(0,0,0,0.07)" }}>
                {s.emoji}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: s.accent, marginBottom: 5 }}>
                  STEP {s.step}
                </p>
                <h3 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 16.5, fontWeight: 700, color: "#1a1600", letterSpacing: "-0.3px", marginBottom: 8 }}>
                  {s.title}
                </h3>
                <p style={{ fontSize: 13, color: "#5a4a20", lineHeight: 1.6, marginBottom: 14 }}>
                  {s.desc}
                </p>
                {s.step === "02" ? (
                  <GetFlyersWithQr />
                ) : s.href.startsWith("http") ? (
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: 13, fontWeight: 600, color: s.accent, textDecoration: "none" }}
                  >
                    {s.action} &rarr;
                  </a>
                ) : (
                  <Link href={s.href} style={{ fontSize: 13, fontWeight: 600, color: s.accent, textDecoration: "none" }}>
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
            <div key={faq.q} style={{ padding: "14px 0", borderBottom: i < 4 ? "1px solid rgba(190,155,70,0.12)" : "none" }}>
              <p style={{ fontSize: 13.5, fontWeight: 600, color: "#1a1600", marginBottom: 5 }}>{faq.q}</p>
              <p style={{ fontSize: 13, color: "#7a6a40", lineHeight: 1.6 }}>{faq.a}</p>
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
          borderRadius: 12,
          background: "rgba(245,200,66,0.10)",
          border: "1px solid rgba(245,200,66,0.18)",
        }}
      >
        <span style={{ fontSize: 16 }}>&#x2728;</span>
        <span style={{ fontSize: 13, color: "#7a6a40" }}>
          <strong style={{ color: "#5f502d" }}>Tip:</strong> Lost or have questions? Click the <strong style={{ color: "#d97706" }}>🍋 chatbot</strong> in the bottom-right corner anytime.
        </span>
      </div>

    </PageContainer>
  );
}
