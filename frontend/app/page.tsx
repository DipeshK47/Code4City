"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { HoverLink } from "@/components/common/HoverLink";
import RecentActivity from "@/components/home/RecentActivity";
import { getLeaderboard } from "@/lib/leaderboard-api";

const QUICK = [
  { href: "/map",         emoji: "MAP", label: "Map",             desc: "Find priority zones near you" },
  { href: "/guide",       emoji: "KIT", label: "Guide",           desc: "Run a clean outreach mission" },
  { href: "/leaderboard", emoji: "TOP", label: "Leaderboard",     desc: "See this month's top volunteers" },
  { href: "/community",   emoji: "COM", label: "Community",       desc: "Posts, meetups, and coordination" },
];

const card: React.CSSProperties = {
  background: "#F8F6F0",
  border: "1px solid rgba(11, 11, 10, 0.16)",
  borderRadius: 2,
  boxShadow: "none",
};

export default function HomePage() {
  const [stats, setStats] = useState([
    { label: "Total Scans",        value: "-", change: "Loading...",       icon: "SC", iconBg: "#EBE7DE" },
    { label: "Active Volunteers",  value: "-", change: "Loading...",       icon: "VT", iconBg: "#EBE7DE" },
    { label: "Locations Covered",  value: "12", change: "Across NYC",      icon: "ZN", iconBg: "#EBE7DE" },
    { label: "Total Hours",        value: "-", change: "Loading...",       icon: "HR", iconBg: "#EBE7DE" },
  ]);

  useEffect(() => {
    getLeaderboard("all")
      .then((res) => {
        setStats([
          { label: "Total Scans",        value: (res.totalScans ?? 0).toLocaleString(),      change: "All time",         icon: "SC", iconBg: "#EBE7DE" },
          { label: "Active Volunteers",  value: (res.totalVolunteers ?? 0).toLocaleString(), change: "Registered users", icon: "VT", iconBg: "#EBE7DE" },
          { label: "Locations Covered",  value: "12",                                        change: "Across NYC",       icon: "ZN", iconBg: "#EBE7DE" },
          { label: "Total Hours",        value: String(res.totalHours ?? 0),                 change: "All time",         icon: "HR", iconBg: "#EBE7DE" },
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
          borderRadius: 2,
          overflow: "hidden",
          background: "#F8F6F0",
          border: "1px solid rgba(11, 11, 10, 0.16)",
          boxShadow: "none",
          marginBottom: 24,
          minHeight: 315,
        }}
      >
        <div style={{ position: "absolute", left: 0, right: 0, top: 80, height: 1, background: "rgba(11, 11, 10, 0.08)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", left: "64%", top: 0, bottom: 0, width: 1, background: "rgba(11, 11, 10, 0.08)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", right: 34, bottom: 32, width: 132, height: 132, border: "1px solid rgba(212, 74, 18, 0.18)", borderRadius: "50%", pointerEvents: "none" }} />
        <div style={{ position: "absolute", right: 69, bottom: 67, width: 62, height: 62, border: "1px solid rgba(11, 11, 10, 0.16)", borderRadius: "50%", pointerEvents: "none" }} />

        <div
          style={{
            position: "absolute", right: 28, top: 24,
            width: 52, height: 52,
            border: "1px solid #D44A12",
            background: "transparent",
            color: "#D44A12",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11, fontWeight: 500, letterSpacing: "0.22em",
            boxShadow: "none",
            pointerEvents: "none", userSelect: "none",
          }}
        >
          VT
        </div>

        <div style={{ position: "relative", zIndex: 1, padding: "clamp(32px, 5vw, 58px) clamp(20px, 5vw, 64px)" }}>
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 400, letterSpacing: "0.28em", textTransform: "uppercase", color: "#8A8780", marginBottom: 20 }}>
            Civic Coordination
          </p>
          <h2 style={{ fontFamily: "'Instrument Serif', serif", fontSize: "clamp(54px, 9vw, 132px)", fontWeight: 400, color: "#0B0B0A", lineHeight: 0.9, letterSpacing: "-0.045em", marginBottom: 18 }}>
            Volun-Tiers<br />
            <span style={{ fontStyle: "italic", color: "#D44A12" }}>Find the gaps. Reach the people.</span>
          </h2>
          <p style={{ fontSize: "clamp(21px, 2.1vw, 34px)", color: "#1A1917", lineHeight: 1.18, marginBottom: 30, maxWidth: 720 }}>
            Coordinate outreach, cover priority zones, and turn volunteer energy into measurable local action.
          </p>
          <Link
            href="/getstarted"
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "18px 34px", borderRadius: 0,
              background: "transparent", color: "#D44A12",
              border: "1px solid #D44A12",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 12, fontWeight: 400, letterSpacing: "0.32em",
              textTransform: "uppercase",
              textDecoration: "none", boxShadow: "none",
            }}
          >
            Start a Mission
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
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#8A8780", fontWeight: 400, letterSpacing: "0.18em", textTransform: "uppercase" }}>{s.label}</span>
              <div style={{ width: 32, height: 32, borderRadius: 0, background: "#EBE7DE", border: "1px solid rgba(11, 11, 10, 0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 500, color: "#D44A12", flexShrink: 0 }}>
                {s.icon}
              </div>
            </div>
            <div
              className={`anim-num-pop d${i + 3}`}
              style={{ fontFamily: "'Instrument Serif', serif", fontSize: "clamp(38px, 4vw, 60px)", fontWeight: 400, color: "#0B0B0A", letterSpacing: "-0.04em", lineHeight: 0.92, marginBottom: 8 }}
            >
              {s.value}
            </div>
            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#8A8780", letterSpacing: "0.08em" }}>{s.change}</p>
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
          <h3 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 34, fontWeight: 400, color: "#0B0B0A", letterSpacing: "-0.035em", lineHeight: 1 }}>
            Quick Actions
          </h3>
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#8A8780", marginTop: 8, marginBottom: 22, letterSpacing: "0.14em", textTransform: "uppercase" }}>Jump to what you need</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            {QUICK.map((q) => (
              <HoverLink
                key={q.href}
                href={q.href}
                baseStyle={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "16px", borderRadius: 0,
                  background: "transparent", border: "1px solid rgba(11, 11, 10, 0.12)",
                  transition: "transform 0.25s, border-color 0.25s",
                }}
                hoverStyle={{
                  transform: "translateY(-2px)",
                  borderColor: "rgba(212, 74, 18, 0.55)",
                }}
              >
                <span style={{ width: 38, height: 32, borderRadius: 0, background: "transparent", border: "1px solid rgba(212, 74, 18, 0.18)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 500, letterSpacing: "0.12em", color: "#D44A12", lineHeight: 1, flexShrink: 0 }}>{q.emoji}</span>
                <div>
                  <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 500, color: "#0B0B0A", marginBottom: 4, letterSpacing: "0.12em", textTransform: "uppercase" }}>{q.label}</p>
                  <p style={{ fontSize: 18, color: "#8A8780", lineHeight: 1.18 }}>{q.desc}</p>
                </div>
              </HoverLink>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div style={{ ...card, padding: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <div>
              <h3 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 34, fontWeight: 400, color: "#0B0B0A", letterSpacing: "-0.035em", lineHeight: 1 }}>
                Recent Activity
              </h3>
              <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#8A8780", marginTop: 8, letterSpacing: "0.14em", textTransform: "uppercase" }}>Community updates</p>
            </div>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#D44A12", cursor: "pointer", letterSpacing: "0.14em", textTransform: "uppercase" }}>View all -&gt;</span>
          </div>
          <RecentActivity />
        </div>
      </div>

      {/* ══ CTA Banner ═══════════════════════════════════════════════ */}
      <div
        className="anim-fade-up d6"
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap",
          gap: 16, padding: "26px clamp(16px, 3vw, 32px)", borderRadius: 2,
          background: "#0B0B0A",
          border: "1px solid rgba(212, 74, 18, 0.18)",
          boxShadow: "none",
        }}
      >
        <div>
          <h4 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 30, fontWeight: 400, color: "#F8F6F0", letterSpacing: "-0.03em", marginBottom: 6 }}>
            Ready to move a mission forward?
          </h4>
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "rgba(248, 246, 240,0.60)", letterSpacing: "0.08em" }}>
            Join {stats[1].value} active volunteers and help cover the next priority zone.
          </p>
        </div>
        <HoverLink
          href="/getstarted"
          baseStyle={{
            flexShrink: 0, display: "flex", alignItems: "center", gap: 8,
            padding: "14px 24px", borderRadius: 0,
            background: "transparent", color: "#D44A12",
            border: "1px solid #D44A12",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 12, fontWeight: 400,
            boxShadow: "none",
            letterSpacing: "0.26em",
            textTransform: "uppercase",
            transition: "transform 0.25s, background 0.25s, color 0.25s",
          }}
          hoverStyle={{
            transform: "translateY(-1px)",
            background: "#D44A12",
            color: "#F8F6F0",
          }}
        >
          Launch Mission
        </HoverLink>
      </div>

    </div>
  );
}
