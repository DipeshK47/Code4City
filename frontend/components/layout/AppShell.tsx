"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Header from "./Header";
import Sidebar from "./Sidebar";
import ChatbotWidget from "../chat/ChatbotWidget";
import { useAuth } from "@/context/AuthContext";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const showSidebar =
    !!user &&
    (pathname !== "/onboarding" || !!user.agreed_to_terms || !!user.isGuest);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 960px)");

    const updateLayout = (event?: MediaQueryListEvent) => {
      const matches = event?.matches ?? mediaQuery.matches;
      setIsMobile(matches);

      if (!matches) {
        setSidebarOpen(false);
      }
    };

    updateLayout();
    mediaQuery.addEventListener("change", updateLayout);

    return () => {
      mediaQuery.removeEventListener("change", updateLayout);
    };
  }, []);

  function handleTouchStart(event: React.TouchEvent<HTMLDivElement>) {
    if (!isMobile) {
      return;
    }

    const touch = event.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }

  function handleTouchEnd(event: React.TouchEvent<HTMLDivElement>) {
    if (!isMobile || !touchStartRef.current) {
      return;
    }

    const start = touchStartRef.current;
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    touchStartRef.current = null;

    if (Math.abs(deltaX) < 48 || Math.abs(deltaX) < Math.abs(deltaY)) {
      return;
    }

    if (!sidebarOpen && start.x <= 28 && deltaX > 0) {
      setSidebarOpen(true);
    }

    if (sidebarOpen && deltaX < 0) {
      setSidebarOpen(false);
    }
  }

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{
        display: "flex",
        minHeight: "100dvh",
        height: "100dvh",
        overflow: "hidden",
        background: "var(--bg-base)",
        fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
        position: "relative",
        touchAction: "pan-y",
      }}
    >
      {showSidebar ? (
        <>
          <Sidebar
            isMobile={isMobile}
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />
          {isMobile && sidebarOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            backdropFilter: "blur(2px)",
            border: "none",
            zIndex: 999,
          }}
        />
          ) : null}
        </>
      ) : null}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          overflow: "hidden",
          minWidth: 0,
          width: "100%",
        }}
      >
        <Header
          isMobile={isMobile}
          showSidebarToggle={showSidebar}
          onToggleSidebar={() => setSidebarOpen((current) => !current)}
        />
        <main
          style={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            width: "100%",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {children}
        </main>
      </div>
      <ChatbotWidget />
    </div>
  );
}
