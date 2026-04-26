"use client";

import PageContainer from "@/components/layout/PageContainer";
import SectionCard from "@/components/common/SectionCard";

export default function GuestGate({
  message,
  onGoToLogin,
}: {
  message: string;
  onGoToLogin: () => void;
}) {
  return (
    <PageContainer>
      <SectionCard>
        <div style={{ textAlign: "center", padding: "48px 32px", maxWidth: 400, margin: "0 auto" }}>
          <p style={{ fontSize: 16, color: "#5a4a20", lineHeight: 1.5, marginBottom: 24 }}>
            {message}
          </p>
          <button
            type="button"
            onClick={onGoToLogin}
            style={{
              padding: "12px 24px",
              borderRadius: 12,
              border: "1px solid rgba(245,200,66,0.4)",
              background: "linear-gradient(135deg, #f5c842, #e8a200)",
              fontSize: 14,
              fontWeight: 600,
              color: "#1a1000",
              cursor: "pointer",
              boxShadow: "0 2px 12px rgba(245,200,66,0.35)",
            }}
          >
            Login or Sign up
          </button>
        </div>
      </SectionCard>
    </PageContainer>
  );
}
