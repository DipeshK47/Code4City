"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";

const META: Record<string, { title: string; sub: string }> = {
  "/": {
    title: "Welcome back",
    sub: "Today's volunteer missions, signals, and community updates.",
  },
  "/map": {
    title: "Mission Map",
    sub: "Explore priority zones, coverage layers, and volunteer meetups.",
  },
  "/community": {
    title: "Community",
    sub: "Posts, meetups, and volunteer coordination in one feed.",
  },
  "/community/create-post": {
    title: "Create Post",
    sub: "Start a new community thread.",
  },
  "/community/create-meetup": {
    title: "Create Meetup",
    sub: "Create a meetup that lands in the feed and on the map.",
  },
  "/messages": {
    title: "Messages",
    sub: "Direct messages with other volunteers and organizers.",
  },
  "/tracker": {
    title: "Route Tracker",
    sub: "Track outreach sessions in real time.",
  },
  "/profile": {
    title: "Your Profile",
    sub: "Track your contributions, proofs, and impact.",
  },
  "/leaderboard": {
    title: "Leaderboard",
    sub: "Top volunteers moving missions forward this month.",
  },
  "/printers": {
    title: "Print Points",
    sub: "Find a nearby place to print outreach cards.",
  },
  "/getstarted": {
    title: "Get Started",
    sub: "Everything you need to begin volunteering.",
  },
  "/onboarding": {
    title: "Log in",
    sub: "Sign in or create an account to continue.",
  },
  "/guide": {
    title: "Volunteer Guide",
    sub: "Everything you need to know before your first mission.",
  },
};

function getInitial(name: string): string {
  if (!name?.trim()) return "?";
  return name.trim()[0].toUpperCase();
}

interface HeaderProps {
  isMobile: boolean;
  showSidebarToggle?: boolean;
  onToggleSidebar: () => void;
}

function getMeta(pathname: string) {
  if (META[pathname]) {
    return META[pathname];
  }

  if (pathname.startsWith("/community/meetups/")) {
    return {
      title: "Meetup Details",
      sub: "Attendees, logistics, and meetup chat.",
    };
  }

  if (pathname.startsWith("/messages/")) {
    return META["/messages"];
  }

  return META["/"];
}

export default function Header({
  isMobile,
  showSidebarToggle = true,
  onToggleSidebar,
}: HeaderProps) {
  const pathname = usePathname();
  const baseMeta = getMeta(pathname);
  const { user } = useAuth();
  const [mapSearch, setMapSearch] = useState("");
  const displayName = user?.full_name?.trim() || user?.username;
  const title =
    pathname === "/" && user
      ? `Welcome back, ${displayName ?? "there"}`
      : baseMeta.title;
  const meta = { ...baseMeta, title };
  const isMapPage = pathname === "/map";

  function submitMapSearch() {
    const query = mapSearch.trim();
    if (!query) return;

    window.dispatchEvent(
      new CustomEvent("voluntiers:map-search", {
        detail: query,
      }),
    );
  }

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: isMobile ? "0 16px" : "0 32px",
        minHeight: isMobile ? 72 : 64,
        flexShrink: 0,
        background: "#F3F0E9",
        borderBottom: "1px solid rgba(11, 11, 10, 0.16)",
        boxShadow: "none",
        position: "sticky",
        top: 0,
        zIndex: 40,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        {isMobile && showSidebarToggle ? (
          <button
            type="button"
            aria-label="Toggle navigation"
            onClick={onToggleSidebar}
            style={{
              width: 40,
              height: 40,
              borderRadius: 0,
              background: "transparent",
              border: "1px solid rgba(11, 11, 10,0.16)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#1A1917"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        ) : null}
        <div style={{
          width: 38,
          height: 38,
          borderRadius: 0,
          background: "#F8F6F0",
          border: "1px solid #D44A12",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          overflow: "hidden",
        }}>
          <img
            src="/logo.png"
            alt="Logo"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              padding: 3,
            }}
          />
        </div>
        <div style={{ minWidth: 0 }}>
          <h1
            style={{
              fontFamily: "'Instrument Serif', serif",
              fontSize: isMobile ? 24 : 30,
              fontWeight: 400,
              color: "#0B0B0A",
              lineHeight: 0.95,
              letterSpacing: "-0.035em",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {meta.title}
          </h1>
          {!isMobile && (
            <p
              style={{
                fontSize: 12,
                color: "#8A8780",
                marginTop: 4,
                whiteSpace: "nowrap",
                fontFamily: "'JetBrains Mono', monospace",
                letterSpacing: "0.08em",
              }}
            >
              {meta.sub}
            </p>
          )}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        {!isMobile && isMapPage ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              submitMapSearch();
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "5px 6px 5px 12px",
              borderRadius: 0,
              background: "rgba(11, 11, 10,0.045)",
              border: "1px solid rgba(11, 11, 10,0.16)",
              width: 310,
            }}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#8A8780"
              strokeWidth="2.2"
              strokeLinecap="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              value={mapSearch}
              onChange={(event) => setMapSearch(event.target.value)}
              placeholder="Search a NYC address or neighborhood"
              style={{
                flex: 1,
                minWidth: 0,
                border: "none",
                outline: "none",
                background: "transparent",
                color: "#0B0B0A",
                fontSize: 12.5,
              }}
            />
            <button
              type="submit"
              style={{
                borderRadius: 0,
                padding: "7px 12px",
                background: "transparent",
                color: "#D44A12",
                border: "1px solid #D44A12",
                fontSize: 11,
                fontWeight: 400,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                boxShadow: "none",
              }}
            >
              Go
            </button>
          </form>
        ) : null}

        <Link
          href="/messages"
          aria-label="Messages"
          style={{
            width: 36,
            height: 36,
            borderRadius: 0,
            background: pathname === "/messages" ? "rgba(212, 74, 18,0.12)" : "rgba(11, 11, 10,0.045)",
            border: pathname === "/messages" ? "1px solid rgba(212, 74, 18,0.26)" : "1px solid rgba(11, 11, 10,0.10)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke={pathname === "/messages" ? "#D44A12" : "#1A1917"}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </Link>

        <Link href="/profile">
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 0,
              background: "transparent",
              border: "1px solid #D44A12",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 500,
              color: "#D44A12",
              boxShadow: "none",
              textDecoration: "none",
              overflow: "hidden",
            }}
          >
            {user?.profile_photo_url ? (
              <Image
                src={user.profile_photo_url}
                alt={displayName ?? user.username}
                width={36}
                height={36}
                unoptimized
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : user ? (
              getInitial(displayName ?? user.username)
            ) : (
              "?"
            )}
          </div>
        </Link>
      </div>
    </header>
  );
}
