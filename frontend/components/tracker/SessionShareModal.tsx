"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import SessionRoutePreview from "@/components/tracker/SessionRoutePreview";
import { formatDistance } from "@/lib/distance";
import { formatDuration, formatStopType } from "@/lib/session";
import type { VolunteerSession } from "@/types/tracker";

interface SessionShareModalProps {
  isOpen: boolean;
  session: VolunteerSession | null;
  onClose: () => void;
  isGuest?: boolean;
  contained?: boolean;
  saveState?: "idle" | "saving" | "saved" | "error";
  saveError?: string | null;
}

type ShareState = "idle" | "sharing" | "shared" | "copied" | "downloaded" | "error";

export default function SessionShareModal({
  isOpen,
  session,
  onClose,
  isGuest = false,
  contained = false,
  saveState = "idle",
  saveError = null,
}: SessionShareModalProps) {
  const [shareState, setShareState] = useState<ShareState>("idle");
  const [shareError, setShareError] = useState<string | null>(null);

  const shareText = useMemo(() => {
    if (!session) {
      return "";
    }

    return [
      "Volunteer route completed with Lemontree.",
      `${formatDistance(session.totalDistanceMeters)} walked`,
      `${formatDuration(session.durationSeconds)} active time`,
      `${session.stops.length} stops logged`,
    ].join(" | ");
  }, [session]);

  if (!isOpen || !session) {
    return null;
  }

  const activeSession = session;

  async function handleNativeShare() {
    if (typeof navigator === "undefined" || !navigator.share) {
      setShareState("error");
      setShareError("Native share is not available on this device.");
      return;
    }

    setShareState("sharing");
    setShareError(null);

    try {
      const files = await getShareFiles(activeSession);
      if (files.length && navigator.canShare?.({ files })) {
        await navigator.share({
          title: "Volunteer route summary",
          text: shareText,
          files,
        });
      } else {
        await navigator.share({
          title: "Volunteer route summary",
          text: shareText,
        });
      }

      setShareState("shared");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        setShareState("idle");
        return;
      }

      setShareState("error");
      setShareError("Could not open the share sheet on this device.");
    }
  }

  async function handleCopySummary() {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      setShareState("error");
      setShareError("Clipboard access is not available here.");
      return;
    }

    try {
      await navigator.clipboard.writeText(shareText);
      setShareState("copied");
      setShareError(null);
    } catch {
      setShareState("error");
      setShareError("Could not copy the route summary.");
    }
  }

  function handleDownloadImage() {
    if (!activeSession.routeImageUrl || typeof document === "undefined") {
      setShareState("error");
      setShareError("No route image is available to download.");
      return;
    }

    const link = document.createElement("a");
    const timestamp = new Date(activeSession.endTime ?? activeSession.startTime).toISOString().slice(0, 10);
    link.href = activeSession.routeImageUrl;
    link.download = `lemontree-route-${timestamp}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShareState("downloaded");
    setShareError(null);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Share route summary"
      style={{
        position: contained ? "absolute" : "fixed",
        inset: 0,
        zIndex: contained ? 1200 : 120,
        background: "rgba(17, 12, 0, 0.52)",
        display: "flex",
        alignItems: contained ? "center" : "flex-end",
        justifyContent: "center",
        padding: 14,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 624,
          maxHeight: contained ? "min(70vh, 736px)" : "min(72vh, 752px)",
          display: "flex",
          flexDirection: "column",
          gap: 0,
          borderRadius: 20,
          overflow: "hidden",
          background: "linear-gradient(180deg, #fffef9 0%, #fff8e8 100%)",
          border: "1px solid rgba(190,155,70,0.16)",
          boxShadow: "0 18px 40px rgba(46,27,0,0.22)",
        }}
      >
        <div
          style={{
            padding: "12px 12px 8px",
            background: "linear-gradient(180deg, #201300 0%, #2b1800 100%)",
            color: "#fff8e8",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: 11.5,
                  fontWeight: 700,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "rgba(245,200,66,0.72)",
                }}
              >
                Share Route
              </p>
              <h3
                style={{
                  margin: "4px 0 0",
                  fontFamily: "'Fraunces', Georgia, serif",
                fontSize: 19,
                  lineHeight: 1.05,
                  letterSpacing: "-0.04em",
                  color: "#f7e3ad",
                }}
              >
                Session summary and sharing
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{
                width: 34,
                height: 34,
                borderRadius: 9,
                border: "1px solid rgba(245,200,66,0.16)",
                background: "rgba(255,255,255,0.06)",
                color: "#fff8e8",
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              X
            </button>
          </div>
          <p
            style={{
              margin: "8px 0 0",
              fontSize: 10.5,
              lineHeight: 1.45,
              color: "rgba(255,241,199,0.76)",
            }}
          >
            Review the finished route, then share or save it from one place.
          </p>
        </div>

        {isGuest ? (
          <div
            style={{
              padding: "8px 12px",
              background: "rgba(245,200,66,0.2)",
              borderBottom: "1px solid rgba(190,155,70,0.2)",
              fontSize: 11,
              color: "#5a4a20",
              textAlign: "center",
            }}
          >
            This session wasn’t saved. Create an account to save future sessions to your profile.
          </div>
        ) : null}

        <div
          style={{
            padding: 10,
            display: "grid",
            gap: 7,
            overflowY: "auto",
          }}
        >
          <div
            style={{
              borderRadius: 15,
              overflow: "hidden",
              border: "1px solid rgba(190,155,70,0.16)",
              background: "#f7f3df",
            }}
          >
            <SessionRoutePreview session={session} height={contained ? 280 : 304} />
          </div>

          {session.routeImageUrl ? (
            <div
              style={{
                position: "relative",
                borderRadius: 15,
                overflow: "hidden",
                border: "1px solid rgba(190,155,70,0.16)",
                background: "#f7f3df",
                minHeight: 130,
                height: 150,
              }}
            >
              <Image
                src={session.routeImageUrl}
                alt="Saved route snapshot"
                fill
                sizes="(max-width: 900px) 100vw, 780px"
                unoptimized
                style={{
                  objectFit: "cover",
                }}
              />
            </div>
          ) : null}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 5,
            }}
          >
            <SummaryCard label="Start time" value={new Date(session.startTime).toLocaleString()} />
            <SummaryCard
              label="End time"
              value={session.endTime ? new Date(session.endTime).toLocaleString() : "In progress"}
            />
            <SummaryCard label="Duration" value={formatDuration(session.durationSeconds)} />
            <SummaryCard label="Distance" value={formatDistance(session.totalDistanceMeters)} />
            <SummaryCard label="Route points" value={session.routePoints.length.toString()} />
            <SummaryCard label="Stops" value={session.stops.length.toString()} />
          </div>

          <div
            style={{
              padding: "8px 10px",
              borderRadius: 14,
              background: "#fffdf5",
              border: "1px solid rgba(190,155,70,0.14)",
              display: "grid",
              gap: 5,
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#7a5a10",
              }}
            >
              Stops made
            </p>
            {session.stops.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: "#8a7a50", lineHeight: 1.5 }}>
                No stops were recorded for this session.
              </p>
            ) : (
              <div style={{ display: "grid", gap: 8, maxHeight: 180, overflowY: "auto", paddingRight: 4 }}>
                {session.stops.map((stop) => (
                  <div
                    key={stop.id}
                    style={{
                      padding: "7px 9px",
                      borderRadius: 10,
                      background: "#fffaf0",
                      border: "1px solid rgba(190,155,70,0.14)",
                    }}
                  >
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#1a1600" }}>
                      {[formatStopType(stop.type), stop.label].filter(Boolean).join(" | ")}
                    </p>
                    <p style={{ margin: "3px 0 0", fontSize: 12, color: "#8a7a50" }}>
                      {`${new Date(stop.timestamp).toLocaleTimeString()} | ${stop.lat.toFixed(5)}, ${stop.lng.toFixed(5)}`}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div
            style={{
              fontSize: 12.5,
              color: saveState === "error" ? "#b91c1c" : "#8a7a50",
              minHeight: 18,
            }}
          >
            {saveState === "saving" && "Saving session to backend..."}
            {saveState === "saved" && "Session saved to backend."}
            {saveState === "error" && (saveError ?? "Saving failed.")}
            {saveState === "idle" && !saveError && !isGuest ? "Session completed locally." : null}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: 6,
            }}
          >
            <IconAction label="Share" icon={<ShareGlyph />} onClick={handleNativeShare} />
            <IconAction label="Insta" icon={<InstagramGlyph />} onClick={handleNativeShare} />
            <IconAction label="Files" icon={<FilesGlyph />} onClick={handleNativeShare} />
            <IconAction label="Copy" icon={<CopyGlyph />} onClick={handleCopySummary} />
          </div>

          <button
            type="button"
            onClick={() => {
              void handleNativeShare();
            }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
              padding: "9px 11px",
              borderRadius: 12,
              cursor: "pointer",
              border: "1px solid rgba(245,200,66,0.34)",
              background: "linear-gradient(135deg, #f5c842 0%, #f0b21f 100%)",
              color: "#1a1000",
              boxShadow: "0 14px 28px rgba(245,200,66,0.22)",
            }}
          >
            <span>
              <span style={{ display: "block", fontSize: 14, fontWeight: 700 }}>
                {shareState === "sharing" ? "Opening Share..." : "Open Share Sheet"}
              </span>
              <span
                style={{
                  display: "block",
                  marginTop: 2,
                  fontSize: 11.5,
                  color: "rgba(26,16,0,0.68)",
                }}
              >
                Instagram, Messages, Files, and more
              </span>
            </span>
            <span style={{ fontSize: 16, fontWeight: 700 }}>+</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadImage}
            disabled={!session.routeImageUrl}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
              padding: "8px 11px",
              borderRadius: 12,
              cursor: !session.routeImageUrl ? "not-allowed" : "pointer",
              border: "1px solid rgba(190,155,70,0.16)",
              background: !session.routeImageUrl ? "rgba(245,239,219,0.7)" : "#fffdf5",
              color: !session.routeImageUrl ? "#b7aa7f" : "#1a1600",
            }}
          >
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              <FilesGlyph />
              Save Route Image
            </span>
            <span style={{ fontSize: 15, fontWeight: 700 }}>+</span>
          </button>

          <div
            style={{
              fontSize: 11.5,
              color: shareState === "error" ? "#b91c1c" : "#8a7a50",
              minHeight: 16,
            }}
          >
            {shareState === "shared" && "Share sheet completed."}
            {shareState === "copied" && "Route summary copied."}
            {shareState === "downloaded" && "Route image download started."}
            {shareState === "error" && (shareError ?? "Sharing failed.")}
            {(shareState === "idle" || shareState === "sharing") && !shareError
              ? "Use the actions above to share the summary or save the route image."
              : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: "10px 12px",
        borderRadius: 12,
        background: "#fffdf5",
        border: "1px solid rgba(190,155,70,0.14)",
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 10.5,
          color: "#9a8a60",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        {label}
      </p>
      <p style={{ margin: "4px 0 0", fontSize: 13, fontWeight: 600, color: "#1a1600", lineHeight: 1.3 }}>
        {value}
      </p>
    </div>
  );
}

function IconAction({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void | Promise<void>;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        void onClick();
      }}
      style={{
        display: "grid",
        placeItems: "center",
        gap: 6,
        padding: "8px 6px 8px",
        borderRadius: 14,
        border: "1px solid rgba(190,155,70,0.16)",
        background: "#fffdf5",
        color: "#1a1600",
        cursor: "pointer",
      }}
    >
      <span
        style={{
          width: 34,
          height: 34,
          borderRadius: 12,
          display: "grid",
          placeItems: "center",
          background: "linear-gradient(135deg, #fff5cf 0%, #fffdf5 100%)",
          border: "1px solid rgba(245,200,66,0.16)",
        }}
      >
        {icon}
      </span>
      <span style={{ fontSize: 10.5, fontWeight: 700 }}>{label}</span>
    </button>
  );
}

function ShareGlyph() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#7a5a10"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.6 13.5l6.8 4" />
      <path d="M15.4 6.5l-6.8 4" />
    </svg>
  );
}

function InstagramGlyph() {
  return (
    <span
      style={{
        width: 22,
        height: 22,
        borderRadius: 7,
        display: "grid",
        placeItems: "center",
        background: "linear-gradient(135deg, #f9ce34 0%, #ee2a7b 52%, #6228d7 100%)",
      }}
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#ffffff"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" fill="#ffffff" stroke="none" />
      </svg>
    </span>
  );
}

function FilesGlyph() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#7a5a10"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M14 3v6h6" />
      <path d="M8 13h8" />
      <path d="M8 17h5" />
    </svg>
  );
}

function CopyGlyph() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#7a5a10"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="9" width="10" height="10" rx="2" />
      <path d="M5 15V7a2 2 0 0 1 2-2h8" />
    </svg>
  );
}

async function getShareFiles(session: VolunteerSession) {
  if (!session.routeImageUrl || typeof File === "undefined") {
    return [];
  }

  try {
    const response = await fetch(session.routeImageUrl);
    const blob = await response.blob();
    return [new File([blob], "lemontree-route.png", { type: blob.type || "image/png" })];
  } catch {
    return [];
  }
}
