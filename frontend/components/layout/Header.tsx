"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";

const META: Record<string, { title: string; sub: string }> = {
  "/": {
    title: "Welcome back",
    sub: "Here's what's happening in your community today.",
  },
  "/map": {
    title: "Resource Map",
    sub: "Explore flyering zones, hotspot layers, and volunteer meetups.",
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
    sub: "Track volunteer outreach sessions in real time.",
  },
  "/profile": {
    title: "Your Profile",
    sub: "Track your volunteer contributions and impact.",
  },
  "/leaderboard": {
    title: "Leaderboard",
    sub: "Top volunteers making a difference this month.",
  },
  "/printers": {
    title: "Nearby Printers",
    sub: "Find a printer close to you for your flyers.",
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
    sub: "Everything you need to know to start flyering.",
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
      new CustomEvent("lemontree:map-search", {
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
        background: "rgba(253,248,232,0.80)",
        backdropFilter: "blur(20px) saturate(160%)",
        WebkitBackdropFilter: "blur(20px) saturate(160%)",
        borderBottom: "1px solid rgba(190,155,70,0.16)",
        boxShadow: "0 1px 0 rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.03)",
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
              borderRadius: 12,
              background: "rgba(0,0,0,0.04)",
              border: "1px solid rgba(190,155,70,0.18)",
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
              stroke="#6a5a30"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        ) : null}
        <div style={{ minWidth: 0 }}>
          <h1
            style={{
              fontFamily: "'Fraunces', Georgia, serif",
              fontSize: isMobile ? 16 : 19,
              fontWeight: 600,
              color: "#1a1600",
              lineHeight: 1.2,
              letterSpacing: "-0.4px",
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
                color: "#9a8a60",
                marginTop: 1,
                whiteSpace: "nowrap",
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
              borderRadius: 12,
              background: "rgba(0,0,0,0.045)",
              border: "1px solid rgba(0,0,0,0.07)",
              width: 310,
            }}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#9a8a60"
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
                color: "#5f502d",
                fontSize: 12.5,
              }}
            />
            <button
              type="submit"
              style={{
                borderRadius: 10,
                padding: "7px 12px",
                background: "linear-gradient(135deg, #f5c842 0%, #e8a200 100%)",
                color: "#1a1000",
                fontSize: 12,
                fontWeight: 700,
                boxShadow: "0 2px 10px rgba(245,200,66,0.25)",
              }}
            >
              Go
            </button>
          </form>
        ) : null}

        <a
          href="https://www.foodhelpline.org/donate"
          target="_blank"
          rel="noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            minHeight: 36,
            padding: isMobile ? "0 12px" : "0 14px",
            borderRadius: 999,
            background: "linear-gradient(135deg, #22C55E, #16A34A)",
            color: "#ffffff",
            border: "1px solid rgba(34,197,94,0.24)",
            boxShadow: "var(--shadow-card)",
            fontSize: 12,
            fontWeight: 700,
            whiteSpace: "nowrap",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 18,
              height: 18,
              borderRadius: 999,
              background: "rgba(255,255,255,0.18)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 21s-6.716-4.35-9.428-8.036C.75 10.49 1.3 6.972 4.11 5.27c2.117-1.283 4.755-.68 6.39 1.182 1.635-1.862 4.273-2.465 6.39-1.182 2.81 1.702 3.36 5.22 1.538 7.694C18.716 16.65 12 21 12 21Z" />
            </svg>
          </span>
          Donate
        </a>

        <Link
          href="/messages"
          aria-label="Messages"
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: pathname === "/messages" ? "rgba(245,200,66,0.15)" : "rgba(0,0,0,0.04)",
            border: pathname === "/messages" ? "1px solid rgba(245,200,66,0.25)" : "1px solid rgba(190,155,70,0.18)",
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
            stroke={pathname === "/messages" ? "#d97706" : "#6a5a30"}
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
              borderRadius: 10,
              background: "linear-gradient(135deg, #f5c842 0%, #e8a200 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 700,
              color: "#1a1000",
              boxShadow: "0 2px 10px rgba(245,200,66,0.35)",
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
