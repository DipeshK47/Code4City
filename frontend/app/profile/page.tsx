"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import PageContainer from "@/components/layout/PageContainer";
import SectionCard from "@/components/common/SectionCard";
import StatCard from "@/components/common/StatCard";
import { useAuth } from "@/context/AuthContext";
import GuestGate from "@/components/auth/GuestGate";
import { formatDistance } from "@/lib/distance";
import { formatDuration } from "@/lib/session";
import { uploadProfilePhoto } from "@/lib/auth-api";
import { getSessions } from "@/lib/session-api";
import { getBadges, type BadgesData } from "@/lib/badges-api";
import { getLeaderboard, type LeaderboardEntry } from "@/lib/leaderboard-api";
import {
  getMyCoverageProofs,
  submitProfileCoverageProof,
  type ProofRecord,
} from "@/lib/hotspot-proof-api";
import { extractGpsFromImageFile } from "@/lib/exif-gps";
import {
  generateCertificatePdf,
  generateCertificatePng,
  downloadBlob,
} from "@/lib/certificate";
import type { VolunteerSession } from "@/types/tracker";

const BADGE_CONFIG = [
  { key: "first_flyer" as const, label: "First Flyer", tone: "#f6e58d", emoji: "📄" },
  { key: "hundred_flyers" as const, label: "100 Flyers", tone: "#fef3c7", emoji: "💯" },
  { key: "on_a_streak" as const, label: "On a Streak", tone: "#d9f99d", emoji: "🔥" },
  { key: "top_5" as const, label: "Top 5", tone: "#fde68a", emoji: "🏅" },
  { key: "top_1" as const, label: "Top 1", tone: "#f5c842", emoji: "🏆" },
] as const;

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";
}

function formatJoinedDate(value: string) {
  if (!value) return "Joined recently";
  return `Joined ${new Date(value).toLocaleString(undefined, { month: "long", year: "numeric" })}`;
}

function formatCompactHours(totalSeconds: number) {
  const hours = totalSeconds / 3600;
  return hours >= 10 ? `${Math.round(hours)}h` : `${hours.toFixed(1)}h`;
}

function buildActivityTitle(session: VolunteerSession) {
  const labeledStop = session.stops.find((stop) => stop.label?.trim());
  if (labeledStop?.label) {
    return labeledStop.label;
  }

  if (session.stops.length > 0) {
    return `${session.stops.length} outreach stop${session.stops.length === 1 ? "" : "s"}`;
  }

  return `Route Session #${session.id}`;
}

export default function ProfilePage() {
  const { user, token, loading, isGuest, setUser, logout } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const profileProofInputRef = useRef<HTMLInputElement | null>(null);
  const [sessions, setSessions] = useState<VolunteerSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<{ title: string; imageUrl: string } | null>(null);
  const [routeZoom, setRouteZoom] = useState(1);
  const [photoState, setPhotoState] = useState<"idle" | "uploading" | "error">("idle");
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [badgesData, setBadgesData] = useState<BadgesData | null>(null);
  const [badgesLoading, setBadgesLoading] = useState(true);
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  const [certificateLoading, setCertificateLoading] = useState<"idle" | "pdf" | "png">("idle");
  const [certificateError, setCertificateError] = useState<string | null>(null);
  const [proofs, setProofs] = useState<ProofRecord[]>([]);
  const [proofsLoading, setProofsLoading] = useState(true);
  const [proofsError, setProofsError] = useState<string | null>(null);
  const [selectedProofIndex, setSelectedProofIndex] = useState<number | null>(null);
  const [profileProofState, setProfileProofState] = useState<"idle" | "uploading" | "error" | "success">("idle");
  const [profileProofMessage, setProfileProofMessage] = useState<string | null>(null);
  const [showProofUploadTooltip, setShowProofUploadTooltip] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia("(max-width: 900px)");
    const updateViewport = () => setIsMobile(mediaQuery.matches);
    updateViewport();
    mediaQuery.addEventListener("change", updateViewport);

    return () => mediaQuery.removeEventListener("change", updateViewport);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadSessions() {
      if (!token || isGuest) {
        if (!cancelled) {
          setSessions([]);
          setSessionsLoading(false);
          setSessionsError(null);
        }
        return;
      }

      try {
        setSessionsLoading(true);
        setSessionsError(null);
        const response = await getSessions(token);
        if (!cancelled) {
          setSessions(response.data);
        }
      } catch (error) {
        if (!cancelled) {
          setSessionsError(error instanceof Error ? error.message : "Could not load activity.");
        }
      } finally {
        if (!cancelled) {
          setSessionsLoading(false);
        }
      }
    }

    loadSessions();

    return () => {
      cancelled = true;
    };
  }, [isGuest, token]);

  useEffect(() => {
    let cancelled = false;
    if (!token || isGuest) {
      setBadgesData(null);
      setBadgesLoading(false);
      return;
    }
    setBadgesLoading(true);
    getBadges(token)
      .then((res) => {
        if (!cancelled) setBadgesData(res.data);
      })
      .catch(() => {
        if (!cancelled) setBadgesData(null);
      })
      .finally(() => {
        if (!cancelled) setBadgesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, isGuest]);

  useEffect(() => {
    let cancelled = false;
    if (isGuest) {
      setLeaderboardEntries([]);
      setLeaderboardLoading(false);
      return;
    }
    setLeaderboardLoading(true);
    getLeaderboard()
      .then((res) => {
        if (!cancelled) setLeaderboardEntries(res.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setLeaderboardEntries([]);
      })
      .finally(() => {
        if (!cancelled) setLeaderboardLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isGuest]);

  useEffect(() => {
    let cancelled = false;

    if (!token || isGuest) {
      setProofs([]);
      setProofsLoading(false);
      setProofsError(null);
      return;
    }

    setProofsLoading(true);
    setProofsError(null);

    getMyCoverageProofs(token)
      .then((data) => {
        if (!cancelled) {
          setProofs(data);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setProofs([]);
          setProofsError(error instanceof Error ? error.message : "Could not load proof uploads.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setProofsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isGuest, token]);

  const { myRankEntry, personAhead } = useMemo(() => {
    if (!user?.id || !leaderboardEntries.length) {
      return { myRankEntry: null, personAhead: null };
    }
    const my = leaderboardEntries.find((e) => e.id === user.id) ?? null;
    const ahead = my ? leaderboardEntries.find((e) => e.rank === my.rank - 1) ?? null : null;
    return { myRankEntry: my, personAhead: ahead };
  }, [user?.id, leaderboardEntries]);

  const stats = useMemo(() => {
    const totalDurationSeconds = sessions.reduce((total, session) => total + session.durationSeconds, 0);
    const flyersUploaded = badgesData?.flyers ?? 0;
    const scanCount = badgesData?.scans ?? 0;

    return [
      { label: "Flyers Uploaded", value: flyersUploaded.toLocaleString(), icon: "FL", iconBg: "#fef3c7" },
      { label: "QR Scans", value: scanCount.toLocaleString(), icon: "SC", iconBg: "#ecfccb" },
      { label: "Hours Volunteered", value: formatCompactHours(totalDurationSeconds), icon: "HR", iconBg: "#dcfce7" },
      { label: "Route Sessions", value: sessions.length.toString(), icon: "RS", iconBg: "#d9f99d" },
    ];
  }, [badgesData?.flyers, badgesData?.scans, sessions]);

  const recentSessions = sessions.slice(0, 5);
  const displayName = user?.full_name?.trim() || user?.username || "Volunteer";
  const emailLabel = user?.email || "Email unavailable";
  const joinedLabel = user?.created_at ? formatJoinedDate(user.created_at) : "Joined recently";

  async function handlePhotoSelection(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !token) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setPhotoState("error");
      setPhotoError("Please choose an image file.");
      return;
    }

    const imageUrl = await readFileAsDataUrl(file);

    try {
      setPhotoState("uploading");
      setPhotoError(null);
      const response = await uploadProfilePhoto(token, imageUrl);
      setUser(response.user);
      setPhotoState("idle");
    } catch (error) {
      setPhotoState("error");
      setPhotoError(error instanceof Error ? error.message : "Could not upload photo.");
    } finally {
      event.target.value = "";
    }
  }

  async function handleProfileProofSelection(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !token) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setProfileProofState("error");
      setProfileProofMessage("Please choose an image file.");
      event.target.value = "";
      return;
    }

    try {
      setProfileProofState("uploading");
      setProfileProofMessage("Reading photo metadata...");

      const coordinates = await extractGpsFromImageFile(file);
      if (!coordinates) {
        throw new Error(
          "This profile upload needs a GPS-tagged photo. Turn on camera location metadata and use the original image.",
        );
      }

      const result = await submitProfileCoverageProof(token, file, coordinates);

      setProofs((current) => [result.proof, ...current]);
      setBadgesData((current) =>
        current
          ? {
              ...current,
              flyers: (current.flyers ?? 0) + 1,
            }
          : current,
      );
      setSelectedProofIndex(0);
      setProfileProofState("success");
      setProfileProofMessage(
        result.usedExistingHotspot
          ? "Proof uploaded and matched to a nearby hotspot on the map."
          : "Proof uploaded and added as a new covered spot from the photo GPS metadata.",
      );

      try {
        const leaderboardResponse = await getLeaderboard();
        setLeaderboardEntries(leaderboardResponse.data ?? []);
      } catch {
        // Keep the local success state even if the leaderboard refresh fails.
      }
    } catch (error) {
      setProfileProofState("error");
      setProfileProofMessage(
        error instanceof Error ? error.message : "Could not upload proof from profile.",
      );
    } finally {
      event.target.value = "";
    }
  }

  if (isGuest) {
    return (
      <GuestGate
        message="Login or sign up to view your profile and track your impact."
        onGoToLogin={logout}
      />
    );
  }

  return (
    <PageContainer style={{ padding: isMobile ? "16px 14px 28px" : "28px 32px 40px" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "minmax(260px, 300px) minmax(0, 1fr)",
          gap: 18,
          alignItems: "start",
        }}
      >
        <div style={{ display: "grid", gap: 16 }}>
          <SectionCard>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", paddingTop: 8, paddingBottom: 8 }}>
              <div
                style={{
                  width: 82,
                  height: 82,
                  borderRadius: 24,
                  marginBottom: 14,
                  background: "linear-gradient(145deg, #f4d84d 0%, #b9cf51 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 24,
                  fontWeight: 800,
                  color: "#31401f",
                  boxShadow: "0 10px 24px rgba(185,207,81,0.3)",
                  overflow: "hidden",
                }}
              >
                {user?.profile_photo_url ? (
                  <Image
                    src={user.profile_photo_url}
                    alt={displayName}
                    width={82}
                    height={82}
                    unoptimized
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  getInitials(displayName)
                )}
              </div>
              <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 22, fontWeight: 700, color: "#1f2b12", letterSpacing: "-0.4px" }}>
                {displayName}
              </h2>
              <p style={{ fontSize: 13, color: "#78814f", marginTop: 3 }}>{emailLabel}</p>
              {!isGuest ? (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoSelection}
                    style={{ display: "none" }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={!token || photoState === "uploading"}
                    style={{
                      marginTop: 12,
                      padding: "8px 12px",
                      borderRadius: 999,
                      border: "1px solid rgba(185,207,81,0.34)",
                      background: "rgba(244,216,77,0.14)",
                      color: "#4d5c1e",
                      fontSize: 11.5,
                      fontWeight: 700,
                    }}
                  >
                    {photoState === "uploading" ? "Uploading..." : "Upload Photo"}
                  </button>
                  {photoError ? (
                    <p style={{ marginTop: 8, fontSize: 12, color: "#b91c1c" }}>{photoError}</p>
                  ) : null}
                </>
              ) : null}
              <div
                style={{
                  marginTop: 10,
                  padding: "6px 12px",
                  borderRadius: 999,
                  background: user?.agreed_to_terms ? "#e7f7d6" : "#fff4d4",
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: user?.agreed_to_terms ? "#4d7c0f" : "#9a6700",
                }}
              >
                {user?.agreed_to_terms ? "Verified Volunteer" : "Terms Pending"}
              </div>

              <div style={{ width: "100%", marginTop: 18, paddingTop: 16, borderTop: "1px solid rgba(190,155,70,0.18)", textAlign: "left" }}>
                {[
                  { key: "joined", accent: "#d9f99d", label: joinedLabel },
                  { key: "community", accent: "#fef3c7", label: "Community Volunteer" },
                  { key: "language", accent: "#ecfccb", label: "English, Spanish" },
                ].map((item) => (
                  <div key={item.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
                    <span style={{ width: 10, height: 10, borderRadius: 999, background: item.accent, boxShadow: "inset 0 0 0 1px rgba(49,64,31,0.08)" }} />
                    <span style={{ fontSize: 13, color: "#5a5f2f" }}>{item.label}</span>
                  </div>
                ))}
              </div>

              <div
                style={{
                  width: "100%",
                  marginTop: 14,
                  padding: "12px 14px",
                  borderRadius: 16,
                  background: "#fdf8ec",
                  border: "1px solid rgba(190,155,70,0.18)",
                  textAlign: "left",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8a8f51" }}>
                      Flyer Proofs
                    </p>
                    <p style={{ margin: "6px 0 0", fontSize: 13, color: "#42531d" }}>
                      {proofsLoading
                        ? "Loading uploaded proofs..."
                        : `${proofs.length} proof image${proofs.length === 1 ? "" : "s"} saved`}
                    </p>
                  </div>
                  <div
                    style={{ position: "relative", flexShrink: 0 }}
                    onMouseEnter={() => setShowProofUploadTooltip(true)}
                    onMouseLeave={() => setShowProofUploadTooltip(false)}
                    onFocus={() => setShowProofUploadTooltip(true)}
                    onBlur={() => setShowProofUploadTooltip(false)}
                  >
                    <input
                      ref={profileProofInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleProfileProofSelection}
                      style={{ display: "none" }}
                    />
                    <button
                      type="button"
                      onClick={() => profileProofInputRef.current?.click()}
                      disabled={!token || profileProofState === "uploading"}
                      aria-label="Upload proof"
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 999,
                        border: "1px solid rgba(185,207,81,0.34)",
                        background: "rgba(185,207,81,0.14)",
                        color: "#4d5c1e",
                        fontSize: 18,
                        fontWeight: 700,
                        cursor: profileProofState === "uploading" ? "not-allowed" : "pointer",
                      }}
                    >
                      +
                    </button>
                    {showProofUploadTooltip ? (
                      <div
                        style={{
                          position: "absolute",
                          right: 0,
                          top: 40,
                          padding: "5px 8px",
                          borderRadius: 6,
                          background: "#243112",
                          color: "#fffdf2",
                          fontSize: 11,
                          whiteSpace: "nowrap",
                          boxShadow: "0 8px 18px rgba(0,0,0,0.18)",
                        }}
                      >
                        Upload proof
                      </div>
                    ) : null}
                  </div>
                </div>
                {proofsError ? (
                  <p style={{ margin: "8px 0 0", fontSize: 12, color: "#b91c1c" }}>{proofsError}</p>
                ) : null}
                {profileProofMessage ? (
                  <p
                    style={{
                      margin: "8px 0 0",
                      fontSize: 12,
                      color: profileProofState === "error" ? "#b91c1c" : "#4d7c0f",
                      lineHeight: 1.45,
                    }}
                  >
                    {profileProofState === "uploading" ? "Reading photo metadata..." : profileProofMessage}
                  </p>
                ) : null}
                <button
                  type="button"
                  disabled={proofsLoading || proofs.length === 0}
                  onClick={() => setSelectedProofIndex(0)}
                  style={{
                    marginTop: 10,
                    padding: "8px 12px",
                    borderRadius: 999,
                    border: "1px solid rgba(185,207,81,0.34)",
                    background: proofs.length > 0 ? "rgba(185,207,81,0.14)" : "rgba(0,0,0,0.04)",
                    color: proofs.length > 0 ? "#4d5c1e" : "#9ca3af",
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: proofsLoading || proofs.length === 0 ? "not-allowed" : "pointer",
                  }}
                >
                  View uploaded proofs
                </button>
              </div>

              {!isGuest ? (
                <button
                  type="button"
                  onClick={() => logout()}
                  style={{
                    width: "100%",
                    marginTop: 18,
                    padding: "10px 14px",
                    borderRadius: 12,
                    border: "1px solid rgba(190,155,70,0.28)",
                    background: "rgba(239,68,68,0.08)",
                    color: "#b91c1c",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Log out
                </button>
              ) : null}
            </div>
          </SectionCard>

          <SectionCard title="Badges" subtitle="Earned from your volunteer activity and leaderboard standing.">
            {badgesLoading ? (
              <p style={{ fontSize: 13, color: "#8a7a50" }}>Loading badges...</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
                {BADGE_CONFIG.map((badge) => {
                  const earned = badgesData ? Boolean(badgesData[badge.key]) : false;
                  return (
                    <div
                      key={badge.label}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 6,
                        padding: "12px 8px",
                        borderRadius: 14,
                        textAlign: "center",
                        background: earned ? badge.tone : "#f8f7f0",
                        border: `1px solid ${earned ? "rgba(185,207,81,0.35)" : "rgba(0,0,0,0.05)"}`,
                        opacity: earned ? 1 : 0.58,
                      }}
                    >
                      <span style={{ fontSize: 28, lineHeight: 1 }}>{badge.emoji}</span>
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: "#243112", lineHeight: 1.25 }}>{badge.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </div>

        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 14 }}>
            {stats.map((stat) => (
              <StatCard key={stat.label} label={stat.label} value={stat.value} icon={stat.icon} iconBg={stat.iconBg} />
            ))}
          </div>

          <SectionCard title="Recent Activity" subtitle="Your last 5 saved route sessions">
            {loading || sessionsLoading ? (
              <p style={{ fontSize: 13, color: "#8a7a50" }}>Loading your profile activity...</p>
            ) : sessionsError ? (
              <p style={{ fontSize: 13, color: "#b91c1c" }}>{sessionsError}</p>
            ) : recentSessions.length === 0 ? (
              <p style={{ fontSize: 13, color: "#8a7a50" }}>No saved route sessions yet. Start a tracker session to build your activity history.</p>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {recentSessions.map((session) => (
                  <div
                    key={session.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: session.routeImageUrl ? "84px minmax(0, 1fr) auto" : "minmax(0, 1fr) auto",
                      gap: 14,
                      alignItems: "center",
                      padding: "12px 14px",
                      borderRadius: 16,
                      background: "#fdf8ec",
                      border: "1px solid rgba(190,155,70,0.18)",
                    }}
                  >
                    {session.routeImageUrl ? (
                      <Image
                        src={session.routeImageUrl}
                        alt="Route snapshot"
                        width={84}
                        height={84}
                        unoptimized
                        style={{
                          width: 84,
                          height: 84,
                          objectFit: "cover",
                          borderRadius: 12,
                          border: "1px solid rgba(185,207,81,0.22)",
                        }}
                      />
                    ) : null}
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 13.5, fontWeight: 700, color: "#1f2b12" }}>{buildActivityTitle(session)}</p>
                      <p style={{ fontSize: 12, color: "#7b7d43", marginTop: 3 }}>
                        {formatDistance(session.totalDistanceMeters)} walked | {formatDuration(session.durationSeconds)} | {session.stops.length} stop{session.stops.length === 1 ? "" : "s"}
                      </p>
                      {session.routeImageUrl ? (
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedRoute({
                              title: buildActivityTitle(session),
                              imageUrl: session.routeImageUrl!,
                            })
                          }
                          style={{
                            marginTop: 8,
                            padding: "7px 10px",
                            borderRadius: 999,
                            border: "1px solid rgba(185,207,81,0.34)",
                            background: "rgba(244,216,77,0.14)",
                            color: "#4d5c1e",
                            fontSize: 11.5,
                            fontWeight: 700,
                          }}
                        >
                          View Route
                        </button>
                      ) : null}
                    </div>
                    <span style={{ fontSize: 12, color: "#a3955e", flexShrink: 0 }}>
                      {new Date(session.startTime).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Leaderboard progress"
            subtitle={myRankEntry ? `Rank #${myRankEntry.rank} of ${leaderboardEntries.length}` : "Your standing vs other volunteers"}
          >
            <div style={{ padding: "8px 0" }}>
              {leaderboardLoading ? (
                <p style={{ fontSize: 13, color: "#8a7a50" }}>Loading your ranking...</p>
              ) : myRankEntry?.rank === 1 ? (
                <div style={{ textAlign: "center", padding: "12px 0" }}>
                  <p style={{ fontSize: 18, fontWeight: 700, color: "#1a1600", fontFamily: "'Fraunces', Georgia, serif", margin: 0 }}>
                    You&rsquo;re the greatest volunteer
                  </p>
                  <p style={{ fontSize: 12, color: "#7a6a40", marginTop: 6 }}>
                    #1 with {myRankEntry.flyers.toLocaleString()} flyers
                  </p>
                </div>
              ) : myRankEntry && personAhead ? (
                (() => {
                  const targetFlyers = Math.max(1, personAhead.flyers);
                  const myFlyers = myRankEntry.flyers;
                  const progressPercent = Math.min(100, (myFlyers / targetFlyers) * 100);
                  const remaining = Math.max(0, targetFlyers - myFlyers);
                  return (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 12, color: "#7a6a40" }}>You | {myFlyers.toLocaleString()} flyers</span>
                        <span style={{ fontSize: 12, color: "#7a6a40" }}>{personAhead.username} #{personAhead.rank} | {personAhead.flyers.toLocaleString()} flyers</span>
                      </div>
                      <p style={{ fontSize: 11, color: "#9a8a60", marginBottom: 6 }}>
                        Progress to match {personAhead.username}&rsquo;s flyers
                      </p>
                      <div style={{ height: 10, borderRadius: 99, background: "rgba(0,0,0,0.08)", overflow: "hidden" }}>
                        <div
                          style={{
                            height: "100%",
                            width: `${progressPercent}%`,
                            borderRadius: 99,
                            background: "linear-gradient(90deg,#e0c13a,#b9cf51)",
                            boxShadow: "0 0 8px rgba(185,207,81,0.5)",
                            transition: "width 0.3s ease",
                          }}
                        />
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                        <span style={{ fontSize: 11, color: "#7a6a40" }}>
                          {progressPercent.toFixed(0)}% of the way there
                        </span>
                        <span style={{ fontSize: 11, color: "#9a8a60" }}>
                          {remaining.toLocaleString()} flyers left to match
                        </span>
                      </div>
                      <p style={{ fontSize: 12, color: "#9a8a60", marginTop: 10 }}>
                        <strong style={{ color: "#1a1600" }}>
                          {Math.max(0, personAhead.flyers - myFlyers + 1).toLocaleString()} more flyers
                        </strong>{" "}
                        to reach rank #{personAhead.rank}
                      </p>
                    </>
                  );
                })()
              ) : myRankEntry ? (
                <p style={{ fontSize: 13, color: "#8a7a50" }}>You&rsquo;re on the board at rank #{myRankEntry.rank} with {myRankEntry.flyers.toLocaleString()} flyers.</p>
              ) : (
                <p style={{ fontSize: 13, color: "#8a7a50" }}>Complete route sessions to appear on the leaderboard.</p>
              )}
            </div>
          </SectionCard>

          <div
            style={{
              borderRadius: 18,
              overflow: "hidden",
              background: "linear-gradient(145deg, #f5e6b8 0%, #e8c547 35%, #d4a82b 100%)",
              boxShadow: "0 0 32px rgba(212,168,43,0.4), 0 8px 24px rgba(0,0,0,0.12)",
              border: "1px solid rgba(255,236,179,0.6)",
              padding: "20px 18px",
            }}
          >
            <div style={{ textAlign: "center", marginBottom: 14 }}>
              <span style={{ fontSize: 32, lineHeight: 1, filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.2))" }}>📜</span>
              <p
                style={{
                  margin: "10px 0 4px",
                  fontFamily: "'Fraunces', Georgia, serif",
                  fontSize: 18,
                  fontWeight: 700,
                  color: "#2d2208",
                  letterSpacing: "-0.3px",
                  textShadow: "0 1px 2px rgba(255,255,255,0.4)",
                }}
              >
                Generate Certificate
              </p>
              <p style={{ fontSize: 11, color: "rgba(45,34,8,0.7)" }}>
                {((badgesData?.flyers ?? 0) >= 1)
                  ? "Download your volunteer certificate"
                  : "Distribute at least 1 flyer to unlock"}
              </p>
            </div>
            {certificateError && (
              <p style={{ fontSize: 12, color: "#b91c1c", marginBottom: 8 }}>{certificateError}</p>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button
                type="button"
                disabled={(badgesData?.flyers ?? 0) < 1 || certificateLoading !== "idle"}
                onClick={async () => {
                  if ((badgesData?.flyers ?? 0) < 1 || !user) return;
                  setCertificateError(null);
                  setCertificateLoading("pdf");
                  try {
                    const myEntry = user?.id ? leaderboardEntries.find((e) => e.id === user.id) : null;
                    const hoursFromStats = myEntry?.hours ?? badgesData?.hours ?? 0;
                    const hoursVolunteeredSeconds = Math.round(hoursFromStats * 3600);
                    const blob = await generateCertificatePdf({
                      fullName: displayName,
                      flyersDistributed: badgesData?.flyers ?? 0,
                      hoursVolunteeredSeconds,
                      date: new Date(),
                    });
                    const dateStr = new Date().toISOString().slice(0, 10);
                    downloadBlob(blob, `volunteer-certificate-${dateStr}.pdf`);
                  } catch (e) {
                    setCertificateError(e instanceof Error ? e.message : "Failed to generate certificate");
                  } finally {
                    setCertificateLoading("idle");
                  }
                }}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  borderRadius: 12,
                  border: "1px solid rgba(45,34,8,0.25)",
                  background: (badgesData?.flyers ?? 0) >= 1 && certificateLoading === "idle"
                    ? "linear-gradient(180deg, #fff9e6 0%, #f5e6b8 100%)"
                    : "rgba(0,0,0,0.12)",
                  color: (badgesData?.flyers ?? 0) >= 1 && certificateLoading === "idle" ? "#2d2208" : "rgba(45,34,8,0.5)",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: (badgesData?.flyers ?? 0) >= 1 && certificateLoading === "idle" ? "pointer" : "not-allowed",
                  boxShadow: (badgesData?.flyers ?? 0) >= 1 && certificateLoading === "idle" ? "0 4px 16px rgba(212,168,43,0.35)" : "none",
                }}
              >
                {certificateLoading === "pdf"
                  ? "Generating…"
                  : (badgesData?.flyers ?? 0) >= 1
                    ? "Download certificate (PDF)"
                    : "🔒 Locked"}
              </button>
              {(badgesData?.flyers ?? 0) >= 1 && (
                <button
                  type="button"
                  disabled={certificateLoading !== "idle"}
                  onClick={async () => {
                    if (!user) return;
                    setCertificateError(null);
                    setCertificateLoading("png");
                    try {
                      const myEntry = user?.id ? leaderboardEntries.find((e) => e.id === user.id) : null;
                      const hoursFromStats = myEntry?.hours ?? badgesData?.hours ?? 0;
                      const hoursVolunteeredSeconds = Math.round(hoursFromStats * 3600);
                      const blob = await generateCertificatePng({
                        fullName: displayName,
                        flyersDistributed: badgesData?.flyers ?? 0,
                        hoursVolunteeredSeconds,
                        date: new Date(),
                      });
                      const dateStr = new Date().toISOString().slice(0, 10);
                      downloadBlob(blob, `volunteer-certificate-${dateStr}.png`);
                    } catch (e) {
                      setCertificateError(e instanceof Error ? e.message : "Failed to generate certificate");
                    } finally {
                      setCertificateLoading("idle");
                    }
                  }}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    border: "1px solid rgba(45,34,8,0.2)",
                    background: "transparent",
                    color: "rgba(45,34,8,0.85)",
                    fontSize: 12,
                    cursor: certificateLoading === "idle" ? "pointer" : "not-allowed",
                  }}
                >
                  {certificateLoading === "png" ? "Generating…" : "Download as PNG"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {selectedRoute ? (
        <div
          aria-hidden="true"
          onClick={() => {
            setSelectedRoute(null);
            setRouteZoom(1);
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(22,30,10,0.72)",
            padding: isMobile ? 16 : 28,
            zIndex: 80,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: "min(100%, 720px)",
              borderRadius: 24,
              overflow: "hidden",
              background: "#fffdf2",
              boxShadow: "0 24px 60px rgba(0,0,0,0.24)",
              border: "1px solid rgba(185,207,81,0.22)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "14px 16px",
                borderBottom: "1px solid rgba(190,155,70,0.16)",
              }}
            >
              <div>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8a8f51" }}>
                  Route Preview
                </p>
                <p style={{ margin: "4px 0 0", fontSize: 15, fontWeight: 700, color: "#243112" }}>
                  {selectedRoute.title}
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setRouteZoom((current) => Math.max(1, current - 0.25))}
                  style={zoomButtonStyle}
                >
                  -
                </button>
                <button
                  type="button"
                  onClick={() => setRouteZoom(1)}
                  style={zoomButtonStyle}
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={() => setRouteZoom((current) => Math.min(3, current + 0.25))}
                  style={zoomButtonStyle}
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRoute(null);
                    setRouteZoom(1);
                  }}
                  style={zoomButtonStyle}
                >
                  X
                </button>
              </div>
            </div>
            <div
              style={{
                maxHeight: "70vh",
                overflow: "auto",
                background: "#f7f3df",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 16,
              }}
            >
              <Image
                src={selectedRoute.imageUrl}
                alt={selectedRoute.title}
                width={1280}
                height={900}
                unoptimized
                style={{
                  display: "block",
                  width: `${routeZoom * 100}%`,
                  height: "auto",
                  maxWidth: "none",
                  objectFit: "contain",
                  transition: "width 150ms ease",
                }}
              />
            </div>
          </div>
        </div>
      ) : null}

      {selectedProofIndex !== null && proofs[selectedProofIndex] ? (
        <div
          aria-hidden="true"
          onClick={() => setSelectedProofIndex(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(22,30,10,0.72)",
            padding: isMobile ? 16 : 28,
            zIndex: 90,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: "min(100%, 760px)",
              borderRadius: 24,
              overflow: "hidden",
              background: "#fffdf2",
              boxShadow: "0 24px 60px rgba(0,0,0,0.24)",
              border: "1px solid rgba(185,207,81,0.22)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "14px 16px",
                borderBottom: "1px solid rgba(190,155,70,0.16)",
              }}
            >
              <div>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8a8f51" }}>
                  Flyer proof {selectedProofIndex + 1} of {proofs.length}
                </p>
                <p style={{ margin: "4px 0 0", fontSize: 15, fontWeight: 700, color: "#243112" }}>
                  {proofs[selectedProofIndex].hotspotName || "Hotspot proof"}
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  type="button"
                  disabled={selectedProofIndex === 0}
                  onClick={() => setSelectedProofIndex((current) => (current === null ? current : Math.max(0, current - 1)))}
                  style={zoomButtonStyle}
                >
                  Prev
                </button>
                <button
                  type="button"
                  disabled={selectedProofIndex >= proofs.length - 1}
                  onClick={() => setSelectedProofIndex((current) => (current === null ? current : Math.min(proofs.length - 1, current + 1)))}
                  style={zoomButtonStyle}
                >
                  Next
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedProofIndex(null)}
                  style={zoomButtonStyle}
                >
                  X
                </button>
              </div>
            </div>
            <div style={{ padding: 16, background: "#f7f3df" }}>
              <Image
                src={proofs[selectedProofIndex].photoUrl}
                alt={proofs[selectedProofIndex].hotspotName || "Flyer proof"}
                width={1200}
                height={900}
                unoptimized
                style={{
                  display: "block",
                  width: "100%",
                  height: "auto",
                  maxHeight: "60vh",
                  objectFit: "contain",
                  borderRadius: 18,
                  background: "#efe8c7",
                }}
              />
              <div style={{ display: "grid", gap: 6, marginTop: 14 }}>
                <p style={{ margin: 0, fontSize: 12.5, color: "#42531d" }}>
                  {proofs[selectedProofIndex].hotspotAddress || "Address unavailable"}
                </p>
                <p style={{ margin: 0, fontSize: 12, color: "#7a6a40" }}>
                  Submitted {new Date(proofs[selectedProofIndex].submittedAt).toLocaleString()}
                </p>
                {proofs[selectedProofIndex].notes ? (
                  <p style={{ margin: 0, fontSize: 12.5, color: "#5a5f2f", lineHeight: 1.55 }}>
                    {proofs[selectedProofIndex].notes}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </PageContainer>
  );
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Failed to read photo."));
    reader.readAsDataURL(file);
  });
}

const zoomButtonStyle: React.CSSProperties = {
  minWidth: 36,
  height: 36,
  padding: "0 10px",
  borderRadius: 999,
  border: "1px solid rgba(190,155,70,0.18)",
  background: "#fffaf0",
  color: "#42531d",
  fontSize: 13,
  fontWeight: 700,
};
