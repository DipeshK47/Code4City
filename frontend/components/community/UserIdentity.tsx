"use client";

import Image from "next/image";
import type { UserSummary } from "@/lib/social-types";
import { formatDisplayName } from "@/lib/social-format";

function getInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "?";
}

export default function UserIdentity({
  user,
  subtitle,
  size = 38,
}: {
  user: UserSummary;
  subtitle?: string;
  size?: number;
}) {
  const displayName = formatDisplayName(user);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.35),
          background: "linear-gradient(135deg, #f5c842 0%, #b9cf51 100%)",
          color: "#233012",
          fontSize: size * 0.38,
          fontWeight: 800,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        {user.profilePhotoUrl ? (
          <Image
            src={user.profilePhotoUrl}
            alt={displayName}
            width={size}
            height={size}
            unoptimized
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          getInitial(displayName)
        )}
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "#1f2b12",
            lineHeight: 1.1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {displayName}
        </div>
        {subtitle ? (
          <div style={{ fontSize: 11.5, color: "#8a7a50", marginTop: 2 }}>
            {subtitle}
          </div>
        ) : null}
      </div>
    </div>
  );
}
