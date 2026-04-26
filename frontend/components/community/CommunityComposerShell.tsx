"use client";

import Link from "next/link";
import PageContainer from "@/components/layout/PageContainer";

export default function CommunityComposerShell({
  eyebrow,
  title,
  subtitle,
  backHref = "/community",
  backLabel = "Back to community",
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  backHref?: string;
  backLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <PageContainer style={{ padding: "24px 20px 40px" }}>
      <div
        style={{
          maxWidth: 860,
          margin: "0 auto",
          display: "grid",
          gap: 18,
        }}
      >
        <Link
          href={backHref}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            width: "fit-content",
            borderRadius: 2,
            border: "1px solid rgba(11, 11, 10,0.16)",
            background: "#F8F6F0",
            color: "#1A1917",
            padding: "10px 14px",
            fontSize: 12.5,
            fontWeight: 800,
            textDecoration: "none",
          }}
        >
          <span aria-hidden="true">&lt;</span>
          {backLabel}
        </Link>

        <div
          className="anim-fade-up"
          style={{
            borderRadius: 2,
            border: "1px solid rgba(11, 11, 10,0.14)",
            background:
              "#F8F6F0",
            boxShadow: "none",
            padding: "24px 24px 22px",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 10px",
              borderRadius: 2,
              background: "rgba(212, 74, 18,0.15)",
              color: "#7a5200",
              fontSize: 11,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            {eyebrow}
          </div>
          <h1
            style={{
              margin: "12px 0 0",
              fontFamily: "'Instrument Serif', serif",
              fontSize: "clamp(2rem, 4vw, 2.25rem)",
              lineHeight: 1.02,
              letterSpacing: 0,
              color: "#18140b",
            }}
          >
            {title}
          </h1>
          <p
            style={{
              margin: "12px 0 0",
              maxWidth: 620,
              fontSize: 14,
              lineHeight: 1.7,
              color: "#1A1917",
            }}
          >
            {subtitle}
          </p>

          <div
            style={{
              marginTop: 20,
              borderRadius: 2,
              background: "rgba(255,255,255,0.9)",
              border: "1px solid rgba(11, 11, 10,0.12)",
              padding: "20px 18px 18px",
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
