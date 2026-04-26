"use client";

import { useEffect, useState } from "react";
import PageContainer from "@/components/layout/PageContainer";
import SectionCard from "@/components/common/SectionCard";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/api-client";

function getQrBaseUrl() {
  const configuredBase = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configuredBase) {
    return configuredBase.replace(/\/$/, "");
  }

  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/$/, "");
  }

  return "";
}

export default function QrCodePage() {
  const { token, user, loading, isGuest } = useAuth();
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingQr, setIsLoadingQr] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadQr() {
      if (!token || !user || user.id === 0 || isGuest) {
        setQrUrl(null);
        return;
      }

      try {
        setIsLoadingQr(true);
        setError(null);

        const response = await fetch(`${API_BASE.replace(/\/$/, "")}/api/qr/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error("Failed to create QR code.");
        }

        const data = await response.json();
        const slug = data.slug as string;
        const qrBase = getQrBaseUrl();

        if (!qrBase) {
          throw new Error("No public QR base URL available.");
        }

        if (!cancelled) {
          setQrUrl(`${qrBase}/qr/${slug}`);
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(
            nextError instanceof Error ? nextError.message : "Could not generate your QR code.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingQr(false);
        }
      }
    }

    if (!loading) {
      void loadQr();
    }

    return () => {
      cancelled = true;
    };
  }, [isGuest, loading, token, user]);

  const qrImageUrl = qrUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(
        qrUrl,
      )}`
    : null;

  return (
    <PageContainer>
      <SectionCard
        title="Volunteer QR Code"
        subtitle="Manual QR page for outreach scan tracking."
      >
        {!loading && (!token || !user || user.id === 0 || isGuest) ? (
          <p style={{ fontSize: 13, color: "#8A8780", lineHeight: 1.6 }}>
            Sign in with a full account to generate your personal QR code.
          </p>
        ) : null}

        {isLoadingQr ? (
          <p style={{ fontSize: 13, color: "#8A8780" }}>Generating your QR code...</p>
        ) : null}

        {error ? (
          <p style={{ fontSize: 13, color: "#b91c1c", lineHeight: 1.6 }}>{error}</p>
        ) : null}

        {qrImageUrl ? (
          <div
            style={{
              display: "grid",
              justifyItems: "center",
              gap: 16,
            }}
          >
            <img
              src={qrImageUrl}
              alt="Your Volun-Tiers QR code"
              style={{
                width: 260,
                height: 260,
                borderRadius: 2,
                background: "#F8F6F0",
                border: "1px solid rgba(11, 11, 10,0.10)",
              }}
            />
            <p
              style={{
                maxWidth: 480,
                textAlign: "center",
                fontSize: 12,
                color: "#8A8780",
                wordBreak: "break-all",
              }}
            >
              {qrUrl}
            </p>
            <p style={{ fontSize: 13, color: "#8A8780", textAlign: "center" }}>
              Anyone who scans this code will count as a scan on your volunteer stats.
            </p>
          </div>
        ) : null}
      </SectionCard>
    </PageContainer>
  );
}
