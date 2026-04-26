"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    const isOnboarding = pathname === "/onboarding";
    const isGetStarted = pathname === "/onboarding";
    if (!user) {
      if (!isOnboarding && !isGetStarted) router.replace("/onboarding");
      return;
    }
    if (isOnboarding && (user.agreed_to_terms || user.isGuest)) {
      router.replace("/");
    }
  }, [loading, user, pathname, router]);

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          background: "radial-gradient(ellipse at 15% 0%, rgba(245,200,66,0.15) 0%, transparent 50%), #fdf8e8",
        }}
      >
        <div style={{ fontSize: 18, color: "#9a8a60" }}>Loading…</div>
      </div>
    );
  }

  return <>{children}</>;
}
