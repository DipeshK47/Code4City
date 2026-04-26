"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: string;
  isNew?: boolean;
};

const NAV: NavItem[] = [
  {
    href: "/",
    label: "Home",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    href: "/getstarted",
    label: "Get Started",
    isNew: true,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 8 16 12 12 16" />
        <line x1="8" y1="12" x2="16" y2="12" />
      </svg>
    ),
  },
  {
    href: "/map",
    label: "Map",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
        <line x1="9" y1="3" x2="9" y2="18" />
        <line x1="15" y1="6" x2="15" y2="21" />
      </svg>
    ),
  },
  {
    href: "/events",
    label: "Events",
    isNew: true,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <path d="M8 14h4" />
        <path d="M8 18h8" />
      </svg>
    ),
  },
  {
    href: "/community",
    label: "Community",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    href: "/profile",
    label: "Profile",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
  {
    href: "/leaderboard",
    label: "Leaderboard",
    badge: "TOP",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
];

interface SidebarProps {
  isMobile: boolean;
  isOpen: boolean;
  onClose: () => void;
}

function getInitial(name: string): string {
  if (!name?.trim()) return "?";
  return name.trim()[0].toUpperCase();
}

export default function Sidebar({ isMobile, isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const displayName = user?.full_name?.trim() || user?.username;

  return (
    <aside
      style={{
        width: isMobile ? 280 : 232,
        flexShrink: 0,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#0B0B0A",
        borderRight: "1px solid rgba(212, 74, 18, 0.18)",
        boxShadow: "none",
        position: isMobile ? "fixed" : "relative",
        top: 0,
        left: 0,
        zIndex: 1000,
        overflow: "hidden",
        transform: isMobile ? `translateX(${isOpen ? "0" : "-100%"})` : "translateX(0)",
        transition: "transform 0.25s ease",
      }}
    >
      <div style={{
        position: "absolute",
        top: 0,
        left: 18,
        right: 18,
        height: 1,
        background: "rgba(248, 246, 240, 0.14)",
        pointerEvents: "none",
      }} />

      <div style={{
        position: "absolute",
        bottom: 0,
        left: 18,
        right: 18,
        height: 1,
        background: "rgba(212, 74, 18, 0.24)",
        pointerEvents: "none",
      }} />

      {/* ── Logo ── */}
      <div style={{ padding: "24px 20px 18px", position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 0,
              background: "transparent",
              border: "1px solid #D44A12",
              boxShadow: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 500,
              letterSpacing: "0.14em",
              color: "#D44A12",
              flexShrink: 0,
            }}>
              VT
            </div>
            <div>
              <div style={{
                fontFamily: "'Instrument Serif', serif",
                fontWeight: 400,
                fontSize: 22,
                color: "#F8F6F0",
                lineHeight: 0.95,
                letterSpacing: "-0.035em",
              }}>
                Volun-Tiers
              </div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "rgba(248, 246, 240,0.48)", marginTop: 5, letterSpacing: "0.18em", textTransform: "uppercase" }}>
                Civic Relay
              </div>
            </div>
          </div>
          {isMobile ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close navigation"
              style={{
                width: 34,
                height: 34,
                borderRadius: 0,
                border: "1px solid rgba(212, 74, 18,0.18)",
                background: "transparent",
                color: "#D44A12",
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              X
            </button>
          ) : null}
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: "rgba(248, 246, 240,0.14)", margin: "0 20px 18px" }} />

      {/* Section label */}
      <div style={{
        fontSize: 10,
        fontFamily: "'JetBrains Mono', monospace",
        fontWeight: 400,
        letterSpacing: "0.28em",
        textTransform: "uppercase",
        color: "rgba(248, 246, 240,0.38)",
        padding: "0 20px 10px",
        position: "relative",
        zIndex: 1,
      }}>
        Navigation
      </div>

      {/* ── Nav Items ── */}
      <nav style={{ flex: 1, padding: "0 10px", overflowY: "auto", position: "relative", zIndex: 1 }}>
        {NAV.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(`${item.href}/`));

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => {
                if (isMobile) onClose();
              }}
              className={`nav-item${isActive ? " active" : ""}`}
              style={{
                textDecoration: "none",
                marginBottom: 2,
                position: "relative",
              }}
            >
              {/* Active left bar */}
              {isActive && (
                <span style={{
                  position: "absolute",
                  left: 0,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: 1,
                  height: "55%",
                  borderRadius: 0,
                  background: "#D44A12",
                  boxShadow: "none",
                }} />
              )}

              <span style={{ display: "flex", flexShrink: 0 }}>{item.icon}</span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badge ? <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.08em" }}>{item.badge}</span> : null}
              {item.isNew && !isActive ? (
                <span
                  style={{
                    fontSize: 9.5,
                    fontFamily: "'JetBrains Mono', monospace",
                    fontWeight: 500,
                    letterSpacing: "0.12em",
                    padding: "2px 6px",
                    borderRadius: 0,
                    background: "transparent",
                    border: "1px solid rgba(212, 74, 18, 0.28)",
                    color: "#D44A12",
                  }}
                >
                  NEW
                </span>
              ) : null}
              {isActive && (
                <span
                  className="pulse-dot"
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "#D44A12",
                    flexShrink: 0,
                  }}
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Divider */}
      <div style={{ height: 1, background: "rgba(248, 246, 240,0.14)", margin: "10px 20px 12px" }} />

      {/* ── User Footer ── */}
      <div style={{ padding: "0 10px 20px", position: "relative", zIndex: 1 }}>
        <Link
          href={user?.isGuest ? "/" : "/profile"}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 12px",
            borderRadius: 0,
            background: "transparent",
            border: "1px solid rgba(248, 246, 240, 0.10)",
            textDecoration: "none",
            color: "inherit",
            transition: "background 0.18s",
          }}
        >
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 0,
              background: "transparent",
              border: "1px solid rgba(212, 74, 18, 0.44)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 500,
              color: "#D44A12",
              flexShrink: 0,
              overflow: "hidden",
            }}
          >
            {user?.profile_photo_url ? (
              <Image
                src={user.profile_photo_url}
                alt={displayName ?? user.username}
                width={30}
                height={30}
                unoptimized
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : user ? (
              getInitial(displayName ?? user.username)
            ) : (
              "?"
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                fontWeight: 400,
                color: "#F8F6F0",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {user ? (displayName ?? user.username) : "Guest"}
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "rgba(248, 246, 240,0.42)", marginTop: 3, letterSpacing: "0.12em", textTransform: "uppercase" }}>
              {user?.isGuest ? "Guest" : user ? "Volunteer" : "Log in to get started"}
            </div>
          </div>
        </Link>

        {user?.isGuest ? (
          <button
            type="button"
            onClick={() => logout()}
            style={{
              width: "100%",
              marginTop: 10,
              padding: "10px 12px",
              borderRadius: 0,
              border: "1px solid rgba(212, 74, 18,0.22)",
              background: "transparent",
              color: "#D44A12",
              fontSize: 12,
              fontWeight: 400,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              textAlign: "center",
              cursor: "pointer",
            }}
          >
            Login or Sign up
          </button>
        ) : null}
      </div>
    </aside>
  );
}
