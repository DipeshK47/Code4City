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
          <p style={{ fontSize: 16, color: "#1A1917", lineHeight: 1.5, marginBottom: 24 }}>
            {message}
          </p>
          <button
            type="button"
            onClick={onGoToLogin}
            style={{
              padding: "12px 24px",
              borderRadius: 2,
              border: "1px solid rgba(212, 74, 18,0.4)",
              background: "#D44A12",
              fontSize: 14,
              fontWeight: 600,
              color: "#0B0B0A",
              cursor: "pointer",
              boxShadow: "none",
            }}
          >
            Login or Sign up
          </button>
        </div>
      </SectionCard>
    </PageContainer>
  );
}
