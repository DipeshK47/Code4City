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
  { key: "first_flyer" as const, label: "First Proof", tone: "#EBE7DE", emoji: "01" },
  { key: "hundred_flyers" as const, label: "100 Proofs", tone: "#EBE7DE", emoji: "100" },
  { key: "on_a_streak" as const, label: "On a Streak", tone: "#EBE7DE", emoji: "ST" },
  { key: "top_5" as const, label: "Top 5", tone: "#EBE7DE", emoji: "T5" },
  { key: "top_1" as const, label: "Top 1", tone: "#D44A12", emoji: "T1" },
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
      { label: "Proofs Logged", value: flyersUploaded.toLocaleString(), icon: "PR", iconBg: "#EBE7DE" },
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
	                  borderRadius: 0,
	                  marginBottom: 14,
	                  background: "transparent",
	                  border: "1px solid #D44A12",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 24,
	                  fontFamily: "'JetBrains Mono', monospace",
	                  fontWeight: 500,
	                  color: "#D44A12",
                  boxShadow: "none",
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
	              <h2 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 34, fontWeight: 400, color: "#0B0B0A", letterSpacing: "-0.035em", lineHeight: 1 }}>
                {displayName}
              </h2>
	              <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#8A8780", marginTop: 6, letterSpacing: "0.08em" }}>{emailLabel}</p>
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
                      borderRadius: 2,
                      border: "1px solid rgba(212, 74, 18,0.34)",
                      background: "rgba(212, 74, 18,0.14)",
                      color: "#D44A12",
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
                  borderRadius: 2,
                  background: user?.agreed_to_terms ? "#e7f7d6" : "#F8F6F0",
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: user?.agreed_to_terms ? "#4d7c0f" : "#9a6700",
                }}
              >
                {user?.agreed_to_terms ? "Verified Volunteer" : "Terms Pending"}
              </div>

              <div style={{ width: "100%", marginTop: 18, paddingTop: 16, borderTop: "1px solid rgba(11, 11, 10,0.18)", textAlign: "left" }}>
                {[
                  { key: "joined", accent: "#d9f99d", label: joinedLabel },
                  { key: "community", accent: "#EBE7DE", label: "Community Volunteer" },
                  { key: "language", accent: "#ecfccb", label: "English, Spanish" },
                ].map((item) => (
                  <div key={item.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: item.accent, boxShadow: "none" }} />
                    <span style={{ fontSize: 13, color: "#8A8780" }}>{item.label}</span>
                  </div>
                ))}
              </div>

              <div
                style={{
                  width: "100%",
                  marginTop: 14,
                  padding: "12px 14px",
                  borderRadius: 2,
                  background: "#F8F6F0",
                  border: "1px solid rgba(11, 11, 10,0.18)",
                  textAlign: "left",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#D44A12" }}>
                      Outreach Proofs
                    </p>
                    <p style={{ margin: "6px 0 0", fontSize: 13, color: "#8A8780" }}>
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
                        borderRadius: 2,
                        border: "1px solid rgba(212, 74, 18,0.34)",
                        background: "rgba(212, 74, 18,0.14)",
                        color: "#D44A12",
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
                          background: "#0B0B0A",
                          color: "#F8F6F0",
                          fontSize: 11,
                          whiteSpace: "nowrap",
                          boxShadow: "none",
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
                    borderRadius: 2,
                    border: "1px solid rgba(212, 74, 18,0.34)",
                    background: proofs.length > 0 ? "rgba(212, 74, 18,0.14)" : "rgba(0,0,0,0.04)",
                    color: proofs.length > 0 ? "#D44A12" : "#9ca3af",
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
                    borderRadius: 2,
                    border: "1px solid rgba(11, 11, 10,0.28)",
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
              <p style={{ fontSize: 13, color: "#8A8780" }}>Loading badges...</p>
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
                        borderRadius: 2,
                        textAlign: "center",
                        background: earned ? badge.tone : "#F8F6F0",
                        border: `1px solid ${earned ? "rgba(212, 74, 18,0.35)" : "rgba(0,0,0,0.05)"}`,
                        opacity: earned ? 1 : 0.58,
                      }}
                    >
                      <span style={{ minWidth: 34, height: 30, borderRadius: 2, background: "rgba(11, 11, 10,0.06)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, letterSpacing: "0.06em", lineHeight: 1 }}>{badge.emoji}</span>
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: "#0B0B0A", lineHeight: 1.25 }}>{badge.label}</span>
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
              <p style={{ fontSize: 13, color: "#8A8780" }}>Loading your profile activity...</p>
            ) : sessionsError ? (
              <p style={{ fontSize: 13, color: "#b91c1c" }}>{sessionsError}</p>
            ) : recentSessions.length === 0 ? (
              <p style={{ fontSize: 13, color: "#8A8780" }}>No saved route sessions yet. Start a tracker session to build your activity history.</p>
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
                      borderRadius: 2,
                      background: "#F8F6F0",
                      border: "1px solid rgba(11, 11, 10,0.18)",
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
                          borderRadius: 2,
                          border: "1px solid rgba(212, 74, 18,0.22)",
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
                            borderRadius: 2,
                            border: "1px solid rgba(212, 74, 18,0.34)",
                            background: "rgba(212, 74, 18,0.14)",
                            color: "#D44A12",
                            fontSize: 11.5,
                            fontWeight: 700,
                          }}
                        >
                          View Route
                        </button>
                      ) : null}
                    </div>
                    <span style={{ fontSize: 12, color: "#8A8780", flexShrink: 0 }}>
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
                <p style={{ fontSize: 13, color: "#8A8780" }}>Loading your ranking...</p>
              ) : myRankEntry?.rank === 1 ? (
                <div style={{ textAlign: "center", padding: "12px 0" }}>
                  <p style={{ fontSize: 18, fontWeight: 700, color: "#0B0B0A", fontFamily: "'Instrument Serif', serif", margin: 0 }}>
                    You&rsquo;re the greatest volunteer
                  </p>
                  <p style={{ fontSize: 12, color: "#8A8780", marginTop: 6 }}>
                    #1 with {myRankEntry.flyers.toLocaleString()} proofs
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
                        <span style={{ fontSize: 12, color: "#8A8780" }}>You | {myFlyers.toLocaleString()} proofs</span>
                        <span style={{ fontSize: 12, color: "#8A8780" }}>{personAhead.username} #{personAhead.rank} | {personAhead.flyers.toLocaleString()} proofs</span>
                      </div>
                      <p style={{ fontSize: 11, color: "#8A8780", marginBottom: 6 }}>
                        Progress to match {personAhead.username}&rsquo;s proofs
                      </p>
                      <div style={{ height: 10, borderRadius: 2, background: "rgba(0,0,0,0.08)", overflow: "hidden" }}>
                        <div
                          style={{
                            height: "100%",
                            width: `${progressPercent}%`,
                            borderRadius: 2,
                            background: "#D44A12",
                            boxShadow: "none",
                            transition: "width 0.3s ease",
                          }}
                        />
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                        <span style={{ fontSize: 11, color: "#8A8780" }}>
                          {progressPercent.toFixed(0)}% of the way there
                        </span>
                        <span style={{ fontSize: 11, color: "#8A8780" }}>
                          {remaining.toLocaleString()} proofs left to match
                        </span>
                      </div>
                      <p style={{ fontSize: 12, color: "#8A8780", marginTop: 10 }}>
                        <strong style={{ color: "#0B0B0A" }}>
                          {Math.max(0, personAhead.flyers - myFlyers + 1).toLocaleString()} more proofs
                        </strong>{" "}
                        to reach rank #{personAhead.rank}
                      </p>
                    </>
                  );
                })()
              ) : myRankEntry ? (
                <p style={{ fontSize: 13, color: "#8A8780" }}>You&rsquo;re on the board at rank #{myRankEntry.rank} with {myRankEntry.flyers.toLocaleString()} proofs.</p>
              ) : (
                <p style={{ fontSize: 13, color: "#8A8780" }}>Complete route sessions to appear on the leaderboard.</p>
              )}
            </div>
          </SectionCard>

          <div
            style={{
              borderRadius: 2,
              overflow: "hidden",
              background: "#F8F6F0",
              boxShadow: "none",
	              border: "1px solid rgba(11, 11, 10,0.16)",
              padding: "20px 18px",
            }}
          >
            <div style={{ textAlign: "center", marginBottom: 14 }}>
	              <span style={{ width: 46, height: 38, borderRadius: 0, background: "transparent", border: "1px solid rgba(212, 74, 18,0.22)", color: "#D44A12", display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 500, letterSpacing: "0.08em" }}>CERT</span>
              <p
                style={{
                  margin: "10px 0 4px",
                  fontFamily: "'Instrument Serif', serif",
	                  fontSize: 32,
	                  fontWeight: 400,
                  color: "#0B0B0A",
	                  letterSpacing: "-0.035em",
	                  textShadow: "none",
                }}
              >
                Generate Certificate
              </p>
	              <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#8A8780", letterSpacing: "0.08em" }}>
                {((badgesData?.flyers ?? 0) >= 1)
                  ? "Download your volunteer certificate"
                  : "Log at least 1 proof to unlock"}
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
                  borderRadius: 2,
                  border: "1px solid rgba(11, 11, 10,0.25)",
	                  background: "transparent",
	                  color: (badgesData?.flyers ?? 0) >= 1 && certificateLoading === "idle" ? "#D44A12" : "rgba(11, 11, 10,0.5)",
	                  fontSize: 11,
	                  fontWeight: 400,
	                  letterSpacing: "0.16em",
	                  textTransform: "uppercase",
                  cursor: (badgesData?.flyers ?? 0) >= 1 && certificateLoading === "idle" ? "pointer" : "not-allowed",
	                  boxShadow: "none",
                }}
              >
                {certificateLoading === "pdf"
                  ? "Generating…"
                  : (badgesData?.flyers ?? 0) >= 1
                    ? "Download certificate (PDF)"
                    : "Locked"}
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
                    borderRadius: 2,
                    border: "1px solid rgba(11, 11, 10,0.2)",
                    background: "transparent",
                    color: "rgba(11, 11, 10,0.85)",
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
              borderRadius: 2,
              overflow: "hidden",
              background: "#F8F6F0",
              boxShadow: "none",
              border: "1px solid rgba(212, 74, 18,0.22)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "14px 16px",
                borderBottom: "1px solid rgba(11, 11, 10,0.16)",
              }}
            >
              <div>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#D44A12" }}>
                  Route Preview
                </p>
                <p style={{ margin: "4px 0 0", fontSize: 15, fontWeight: 700, color: "#0B0B0A" }}>
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
                background: "#F8F6F0",
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
              borderRadius: 2,
              overflow: "hidden",
              background: "#F8F6F0",
              boxShadow: "none",
              border: "1px solid rgba(212, 74, 18,0.22)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "14px 16px",
                borderBottom: "1px solid rgba(11, 11, 10,0.16)",
              }}
            >
              <div>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#D44A12" }}>
                  Outreach proof {selectedProofIndex + 1} of {proofs.length}
                </p>
                <p style={{ margin: "4px 0 0", fontSize: 15, fontWeight: 700, color: "#0B0B0A" }}>
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
            <div style={{ padding: 16, background: "#F8F6F0" }}>
              <Image
                src={proofs[selectedProofIndex].photoUrl}
                alt={proofs[selectedProofIndex].hotspotName || "Outreach proof"}
                width={1200}
                height={900}
                unoptimized
                style={{
                  display: "block",
                  width: "100%",
                  height: "auto",
                  maxHeight: "60vh",
                  objectFit: "contain",
                  borderRadius: 2,
                  background: "#efe8c7",
                }}
              />
              <div style={{ display: "grid", gap: 6, marginTop: 14 }}>
                <p style={{ margin: 0, fontSize: 12.5, color: "#8A8780" }}>
                  {proofs[selectedProofIndex].hotspotAddress || "Address unavailable"}
                </p>
                <p style={{ margin: 0, fontSize: 12, color: "#8A8780" }}>
                  Submitted {new Date(proofs[selectedProofIndex].submittedAt).toLocaleString()}
                </p>
                {proofs[selectedProofIndex].notes ? (
                  <p style={{ margin: 0, fontSize: 12.5, color: "#8A8780", lineHeight: 1.55 }}>
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
  borderRadius: 2,
  border: "1px solid rgba(11, 11, 10,0.18)",
  background: "#F8F6F0",
  color: "#8A8780",
  fontSize: 13,
  fontWeight: 700,
};
