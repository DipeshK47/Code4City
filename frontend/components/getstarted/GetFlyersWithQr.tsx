"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/api-client";

const FLYERS_URL = "https://www.foodhelpline.org/share";

export default function GetFlyersWithQr() {
  const { token, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    window.open(FLYERS_URL, "_blank", "noopener,noreferrer");

    if (!token || !user || user.id === 0) {
      setError("Sign in to get your personal QR code for scans.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const baseUrl = API_BASE;
      const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/qr/me`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error("Failed to create QR code.");
      }

      const data = await res.json();
      const slug = data.slug as string;
      const backendBase = baseUrl.replace(/\/api\/?$/, "");
      const fullUrl = `${backendBase.replace(/\/$/, "")}/qr/${slug}`;

      setQrUrl(fullUrl);
    } catch (e) {
      console.error(e);
      setError("Could not generate your QR code.");
    } finally {
      setLoading(false);
    }
  };

  const qrImageUrl = qrUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
        qrUrl,
      )}`
    : null;

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "#7c3aed",
          textDecoration: "none",
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
        }}
      >
        Get Flyers &rarr;
      </button>

      {qrUrl && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
          }}
        >
          <div
            style={{
              background: "#fffdf6",
              borderRadius: 18,
              padding: "20px 24px",
              maxWidth: 360,
              width: "90%",
              boxShadow: "0 12px 40px rgba(0,0,0,0.25)",
              textAlign: "center",
              border: "1px solid rgba(245,200,66,0.35)",
            }}
          >
            <h3
              style={{
                fontFamily: "'Fraunces', Georgia, serif",
                fontSize: 18,
                marginBottom: 6,
                color: "#1a1600",
              }}
            >
              Your Volunteer QR Code
            </h3>
            <p style={{ fontSize: 12.5, color: "#6b4f1f", marginBottom: 14 }}>
              Anyone who scans this code will count as a scan on your volunteer stats.
            </p>

            {loading && <p style={{ fontSize: 12, color: "#6b4f1f" }}>Generating…</p>}

            {!loading && qrImageUrl && (
              <div style={{ marginBottom: 12, display: "flex", justifyContent: "center" }}>
                <img
                  src={qrImageUrl}
                  alt="Your Lemontree QR code"
                  style={{ width: 220, height: 220, borderRadius: 12, background: "#fff" }}
                />
              </div>
            )}

            {!loading && (
              <p
                style={{
                  fontSize: 11,
                  color: "#7a6a40",
                  wordBreak: "break-all",
                  marginBottom: 10,
                }}
              >
                {qrUrl}
              </p>
            )}

            {error && (
              <p style={{ fontSize: 12, color: "#b91c1c", marginBottom: 8 }}>{error}</p>
            )}

            <button
              type="button"
              onClick={() => setQrUrl(null)}
              style={{
                marginTop: 4,
                fontSize: 12,
                fontWeight: 600,
                color: "#92400e",
                background: "#fef3c7",
                borderRadius: 999,
                padding: "6px 14px",
                border: "1px solid rgba(245,158,11,0.6)",
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
