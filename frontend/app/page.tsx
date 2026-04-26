"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { HoverLink } from "@/components/common/HoverLink";
import RecentActivity from "@/components/home/RecentActivity";
import { getLeaderboard } from "@/lib/leaderboard-api";

const QUICK = [
  { href: "/map",         emoji: "🗺️", label: "Map",             desc: "Find high-need areas near you",        bg: "#fef9c3", border: "#fde68a" },
  { href: "/guide",        emoji: "📖", label: "Guide",           desc: "Tips for effective flyering",           bg: "#ede9fe", border: "#ddd6fe" },
  { href: "/leaderboard", emoji: "🏆", label: "Leaderboard",     desc: "See this month's top volunteers",      bg: "#dcfce7", border: "#bbf7d0" },
  { href: "/community",   emoji: "💬", label: "Community",       desc: "Posts, meetups, and coordination",     bg: "#fce7f3", border: "#fbcfe8" },
];

const card: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid rgba(190,155,70,0.18)",
  borderRadius: 16,
  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
};

export default function HomePage() {
  const [stats, setStats] = useState([
    { label: "Total Scans",        value: "—", change: "Loading...",       icon: "📄", iconBg: "#fef3c7" },
    { label: "Active Volunteers",   value: "—", change: "Loading...",      icon: "🙌", iconBg: "#dcfce7" },
    { label: "Locations Covered",   value: "12", change: "Across NYC",     icon: "📍", iconBg: "#ede9fe" },
    { label: "Total Hours",         value: "—", change: "Loading...",      icon: "⏱️", iconBg: "#fee2e2" },
  ]);

  useEffect(() => {
    getLeaderboard("all")
      .then((res) => {
        setStats([
          { label: "Total Scans",        value: (res.totalScans ?? 0).toLocaleString(), change: "All time",        icon: "📄", iconBg: "#fef3c7" },
          { label: "Active Volunteers",   value: (res.totalVolunteers ?? 0).toLocaleString(), change: "Registered users", icon: "🙌", iconBg: "#dcfce7" },
          { label: "Locations Covered",   value: "12",                                   change: "Across NYC",      icon: "📍", iconBg: "#ede9fe" },
          { label: "Total Hours",         value: String(res.totalHours ?? 0),            change: "All time",        icon: "⏱️", iconBg: "#fee2e2" },
        ]);
      })
      .catch(() => {});
  }, []);

  return (
    <div style={{ padding: "clamp(16px, 3vw, 32px) clamp(12px, 3vw, 36px)", width: "100%" }}>

      {/* ══ Hero Banner ══════════════════════════════════════════════ */}
      <div
        className="anim-fade-up d1"
        style={{
          position: "relative",
          borderRadius: 20,
          overflow: "hidden",
          background: "linear-gradient(130deg, #f5c842 0%, #fbbf24 55%, #f59e0b 100%)",
          boxShadow: "0 8px 32px rgba(245,200,66,0.38)",
          marginBottom: 24,
          minHeight: 175,
        }}
      >
        {/* Decorative circles */}
        <div style={{ position: "absolute", top: -50, right: 120, width: 200, height: 200, borderRadius: "50%", background: "rgba(255,255,255,0.12)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -60, right: -20, width: 180, height: 180, borderRadius: "50%", background: "rgba(255,255,255,0.08)", pointerEvents: "none" }} />

        {/* Floating lemon */}
        <div
          className="anim-float"
          style={{
            position: "absolute", right: 48, top: "50%", transform: "translateY(-50%)",
            fontSize: 72, lineHeight: 1,
            filter: "drop-shadow(0 8px 18px rgba(0,0,0,0.14))",
            pointerEvents: "none", userSelect: "none",
          }}
        >
          🍋
        </div>

        <div style={{ position: "relative", zIndex: 1, padding: "clamp(24px, 4vw, 36px) clamp(20px, 4vw, 44px)" }}>
          <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(90,60,0,0.65)", marginBottom: 8 }}>
            Community Food Access
          </p>
          <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 32, fontWeight: 700, color: "#1a1000", lineHeight: 1.15, letterSpacing: "-0.6px", marginBottom: 8 }}>
            Spread the Word.<br />
            <span style={{ fontStyle: "italic", fontWeight: 400 }}>Feed the Community.</span>
          </h2>
          <p style={{ fontSize: 13.5, color: "rgba(60,40,0,0.62)", marginBottom: 22, maxWidth: 380 }}>
            There&rsquo;s more than enough food to go around &mdash; we just have to help our neighbors find it.
          </p>
          {/* Static link — no hover handlers needed on hero CTA */}
          <Link
            href="/getstarted"
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "10px 22px", borderRadius: 11,
              background: "rgba(18,12,0,0.84)", color: "#f5c842",
              fontSize: 13, fontWeight: 600, letterSpacing: "-0.1px",
              textDecoration: "none", boxShadow: "0 3px 12px rgba(0,0,0,0.22)",
            }}
          >
            Start Volunteering
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
            </svg>
          </Link>
        </div>
      </div>

      {/* ══ Stats Row ════════════════════════════════════════════════ */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 16, marginBottom: 24 }}>
        {stats.map((s, i) => (
          <div
            key={s.label}
            className={`anim-fade-up d${i + 2}`}
            style={{ ...card, padding: "20px 22px" }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
              <span style={{ fontSize: 12, color: "#8a7a50", fontWeight: 500 }}>{s.label}</span>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: s.iconBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>
                {s.icon}
              </div>
            </div>
            <div
              className={`anim-num-pop d${i + 3}`}
              style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 30, fontWeight: 700, color: "#1a1600", letterSpacing: "-1px", lineHeight: 1, marginBottom: 5 }}
            >
              {s.value}
            </div>
            <p style={{ fontSize: 11.5, color: "#9a8a60" }}>{s.change}</p>
          </div>
        ))}
      </div>

      {/* ══ Quick Actions + Activity ═════════════════════════════════ */}
      <div
        className="anim-fade-up d5"
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20, marginBottom: 20 }}
      >
        {/* Quick Actions */}
        <div style={{ ...card, padding: "24px" }}>
          <h3 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 17, fontWeight: 700, color: "#1a1600", letterSpacing: "-0.3px" }}>
            Quick Actions
          </h3>
          <p style={{ fontSize: 12, color: "#9a8a60", marginTop: 3, marginBottom: 18 }}>Jump to what you need</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            {QUICK.map((q) => (
              <HoverLink
                key={q.href}
                href={q.href}
                baseStyle={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "14px 16px", borderRadius: 12,
                  background: q.bg, border: `1px solid ${q.border}`,
                  transition: "transform 0.18s, box-shadow 0.18s",
                }}
                hoverStyle={{
                  transform: "translateY(-2px)",
                  boxShadow: "0 6px 20px rgba(0,0,0,0.09)",
                }}
              >
                <span style={{ fontSize: 24, lineHeight: 1, flexShrink: 0 }}>{q.emoji}</span>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#1a1600", marginBottom: 2 }}>{q.label}</p>
                  <p style={{ fontSize: 11.5, color: "#7a6a40", lineHeight: 1.3 }}>{q.desc}</p>
                </div>
              </HoverLink>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div style={{ ...card, padding: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <div>
              <h3 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 17, fontWeight: 700, color: "#1a1600", letterSpacing: "-0.3px" }}>
                Recent Activity
              </h3>
              <p style={{ fontSize: 12, color: "#9a8a60", marginTop: 3 }}>Community updates</p>
            </div>
            <span style={{ fontSize: 12, color: "#9a8a60", cursor: "pointer" }}>View all →</span>
          </div>
          <RecentActivity />
        </div>
      </div>

      {/* ══ CTA Banner ═══════════════════════════════════════════════ */}
      <div
        className="anim-fade-up d6"
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap",
          gap: 16, padding: "22px clamp(16px, 3vw, 32px)", borderRadius: 18,
          background: "linear-gradient(120deg, #1a1200 55%, #2c1e00 100%)",
          border: "1px solid rgba(245,200,66,0.14)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.14)",
        }}
      >
        <div>
          <h4 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 16, fontWeight: 700, color: "#f5c842", letterSpacing: "-0.3px", marginBottom: 4 }}>
            Ready to make a real difference?
          </h4>
          <p style={{ fontSize: 12.5, color: "rgba(237,218,170,0.52)" }}>
            Join {stats[1].value} active volunteers and help connect your neighbors to free food resources.
          </p>
        </div>
        <HoverLink
          href="/getstarted"
          baseStyle={{
            flexShrink: 0, display: "flex", alignItems: "center", gap: 8,
            padding: "11px 24px", borderRadius: 12,
            background: "#f5c842", color: "#1a1000",
            fontSize: 13, fontWeight: 700,
            boxShadow: "0 4px 16px rgba(245,200,66,0.32)",
            letterSpacing: "-0.1px",
            transition: "transform 0.15s, box-shadow 0.15s",
          }}
          hoverStyle={{
            transform: "translateY(-1px)",
            boxShadow: "0 6px 24px rgba(245,200,66,0.45)",
          }}
        >
          🚀 Get Started
        </HoverLink>
      </div>

    </div>
  );
}
