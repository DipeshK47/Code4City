"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import PageContainer from "@/components/layout/PageContainer";
import SectionCard from "@/components/common/SectionCard";
import PodiumCanvas from "@/components/leaderboard/PodiumCanvas";
import GuestGate from "@/components/auth/GuestGate";
import { useAuth } from "@/context/AuthContext";
import { getLeaderboard, type LeaderboardEntry } from "@/lib/leaderboard-api";

type DisplayRow = LeaderboardEntry & {
  flyers: number;
  zones: number;
  badge: string | null;
  avatar: string;
  color: string;
  isYou: boolean;
  hoursLabel: string;
  progressPercent: number;
};

type PodiumRow = {
  name: string;
  avatar: string;
  flyers: number;
  color: string;
  height: number;
  rank: number;
  pos: number;
  profilePhotoUrl: string | null | undefined;
};

const STATIC_FALLBACK = [
  { flyers: 820, zones: 14, badge: "1", color: "#f5c842" },
  { flyers: 710, zones: 11, badge: "2", color: "#c0c0c0" },
  { flyers: 640, zones: 10, badge: "3", color: "#cd7f32" },
  { flyers: 340, zones: 8, badge: null, color: "#f5c842" },
  { flyers: 310, zones: 7, badge: null, color: "#6b7280" },
  { flyers: 280, zones: 6, badge: null, color: "#6b7280" },
  { flyers: 250, zones: 5, badge: null, color: "#6b7280" },
  { flyers: 200, zones: 4, badge: null, color: "#6b7280" },
];

const rankColors: Record<number, string> = { 1: "#f5c842", 2: "#9ca3af", 3: "#b45309" };
const monthlyStatHighlights = [
  {
    background: "linear-gradient(135deg, rgba(254, 226, 226, 0.95), rgba(254, 242, 242, 0.92))",
    shadow: "0 10px 24px rgba(239,68,68,0.14)",
    pill: "#ef4444",
  },
  {
    background: "linear-gradient(135deg, rgba(219, 234, 254, 0.95), rgba(239, 246, 255, 0.92))",
    shadow: "0 10px 24px rgba(59,130,246,0.14)",
    pill: "#2563eb",
  },
  {
    background: "linear-gradient(135deg, rgba(220, 252, 231, 0.95), rgba(240, 253, 244, 0.92))",
    shadow: "0 10px 24px rgba(34,197,94,0.14)",
    pill: "#16a34a",
  },
  {
    background: "linear-gradient(135deg, rgba(254, 249, 195, 0.95), rgba(255, 251, 235, 0.92))",
    shadow: "0 10px 24px rgba(234,179,8,0.14)",
    pill: "#ca8a04",
  },
];


const podiumSlots = [
  { rank: 2, pos: -1.8, height: 1.4 },
  { rank: 1, pos: 0, height: 1.9 },
  { rank: 3, pos: 1.8, height: 1.1 },
];

function getInitials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

function hoursFromSeconds(totalSeconds: number) {
  return totalSeconds / 3600;
}

function formatHours(totalSeconds: number) {
  const hours = hoursFromSeconds(totalSeconds);
  return hours >= 10 ? `${Math.round(hours)}h` : `${hours.toFixed(1)}h`;
}

function getStaticMetric(index: number) {
  if (STATIC_FALLBACK[index]) {
    return STATIC_FALLBACK[index];
  }

  const baseFlyers = Math.max(90, 200 - Math.max(0, index - 7) * 18);
  const baseZones = Math.max(1, 4 - Math.max(0, index - 7));

  return {
    flyers: baseFlyers,
    zones: baseZones,
    badge: null,
    color: "#6b7280",
  };
}

function MedalSymbol({ color, label }: { color: string; label: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 18,
        height: 18,
        verticalAlign: "middle",
      }}
    >
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
        <path d="M5 1.5h3l1 4H6z" fill="#7c3aed" />
        <path d="M10 1.5h3l-1 4H9z" fill="#dc2626" />
        <circle cx="9" cy="10.5" r="5" fill={color} stroke="rgba(26,22,0,0.18)" strokeWidth="0.8" />
        <text
          x="9"
          y="12"
          textAnchor="middle"
          fontSize="6.5"
          fontWeight="700"
          fill="#1f1600"
          fontFamily="Arial, sans-serif"
        >
          {label}
        </text>
      </svg>
    </span>
  );
}

export default function LeaderboardPage() {
  const { user, logout } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [podiumEntries, setPodiumEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<"all" | "month" | "week">("all");
  const [visibleMetrics, setVisibleMetrics] = useState({
    flyers: true,
    scans: true,
    hours: true,
  });
  const [totalVolunteers, setTotalVolunteers] = useState(0);
  const [totalFlyersAll, setTotalFlyersAll] = useState(0);
  const [totalScansAll, setTotalScansAll] = useState(0);
  const [totalHoursAll, setTotalHoursAll] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const response = await getLeaderboard(period, visibleMetrics);
        if (!cancelled) {
          setEntries(response.data);
          setPodiumEntries(response.podium ?? []);
          setTotalVolunteers(response.totalVolunteers ?? 0);
          setTotalFlyersAll(response.totalFlyers ?? 0);
          setTotalScansAll(response.totalScans ?? 0);
          setTotalHoursAll(response.totalHours ?? 0);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Could not load leaderboard.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [period, visibleMetrics]);

  const displayRows = useMemo<DisplayRow[]>(() => {
    if (!entries.length) {
      return [];
    }

    const maxHours = Math.max(...entries.map((entry) => entry.hours ?? 0), 0.01);

    return entries.slice(0, 10).map((entry) => {
      const hours = entry.hours ?? entry.total_duration_seconds / 3600;
      return {
        ...entry,
        flyers: entry.flyers ?? 0,
        zones: 0,
        badge: entry.rank <= 3 ? String(entry.rank) : null,
        color: rankColors[entry.rank] ?? "#6b7280",
        avatar: getInitials(entry.username),
        isYou: entry.id === user?.id,
        hoursLabel: formatHours(entry.total_duration_seconds),
        progressPercent: Math.max(6, Math.round((hours / maxHours) * 100)),
      };
    });
  }, [entries, user?.id]);

  const selectedMetricKeys = (["flyers", "scans", "hours"] as const).filter((key) => visibleMetrics[key]);
  const primaryMetric = selectedMetricKeys[0] ?? "flyers";
  const metricLabelLower =
    selectedMetricKeys.length === 1
      ? primaryMetric
      : selectedMetricKeys.length === 3
        ? "selected metrics"
        : selectedMetricKeys.join(" + ");

  const metricValueForEntry = (entry: LeaderboardEntry | DisplayRow | null | undefined) => {
    if (!entry) return 0;
    if (primaryMetric === "hours") return entry.hours ?? entry.total_duration_seconds / 3600;
    if (primaryMetric === "scans") return entry.scans ?? 0;
    return entry.flyers ?? 0;
  };

  const formatMetricValue = (value: number) => {
    if (primaryMetric === "hours") {
      return value >= 10 ? `${Math.round(value)}h` : `${value.toFixed(1)}h`;
    }
    return value.toLocaleString();
  };

  const podiumRows = useMemo(() => {
    return podiumSlots
      .map((slot) => {
        const p = podiumEntries[slot.rank - 1];
        if (!p) return null;
        return {
          name: p.username,
          avatar: getInitials(p.username),
          flyers:
            primaryMetric === "hours"
              ? p.hours ?? p.total_duration_seconds / 3600
              : primaryMetric === "scans"
                ? p.scans ?? 0
                : p.flyers ?? 0,
          color: rankColors[slot.rank] ?? "#f5c842",
          height: slot.height,
          rank: slot.rank,
          pos: slot.pos,
          profilePhotoUrl: p.profile_photo_url,
        };
      })
      .filter((entry): entry is PodiumRow => entry !== null);
  }, [podiumEntries, primaryMetric]);

  const yourStanding = useMemo(
    () => displayRows.find((entry) => entry.isYou) ?? null,
    [displayRows]
  );

  const yourIndex = useMemo(
    () => displayRows.findIndex((entry) => entry.isYou),
    [displayRows]
  );

  const periodLabel = period === "week" ? "This Week's" : period === "month" ? "This Month's" : "All Time";

  const computedStats = useMemo(() => {
    return [
      { label: "Flyers Uploaded", value: totalFlyersAll.toLocaleString(), icon: "FL" },
      { label: "QR Scans", value: totalScansAll.toLocaleString(), icon: "SC" },
      { label: "Active Volunteers", value: totalVolunteers.toLocaleString(), icon: "AV" },
      { label: "Total Hours", value: String(totalHoursAll), icon: "HR" },
    ];
  }, [totalFlyersAll, totalScansAll, totalVolunteers, totalHoursAll]);

  const personAhead = yourIndex > 0 ? displayRows[yourIndex - 1] : null;
  const yourFlyers = metricValueForEntry(yourStanding);
  const aheadFlyers = personAhead ? metricValueForEntry(personAhead) : yourFlyers;
  const progressToNext =
    personAhead && aheadFlyers > 0 ? Math.min(100, (yourFlyers / aheadFlyers) * 100) : 100;

  const toggleMetricVisibility = (key: "flyers" | "scans" | "hours") => {
    if (selectedMetricKeys.length === 1 && visibleMetrics[key]) {
      return;
    }
    setVisibleMetrics((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  if (user?.isGuest) {
    return (
      <GuestGate
        message="Login or sign up to access the leaderboard and see how you rank."
        onGoToLogin={logout}
      />
    );
  }

  return (
    <PageContainer>
      <div
        className="anim-fade-up d1"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 20,
          marginBottom: 20,
        }}
      >
        <SectionCard
          dark
          noPadding
          style={{ position: "relative", minHeight: 360, overflow: "hidden" }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              zIndex: 10,
              padding: "20px 24px",
              background: "linear-gradient(to bottom, rgba(26,18,0,0.92) 0%, transparent 100%)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div>
                <h3
                  style={{
                    fontFamily: "'Fraunces', Georgia, serif",
                    fontSize: 20,
                    fontWeight: 700,
                    color: "#f5c842",
                    letterSpacing: "-0.4px",
                  }}
                >
                  Champions Podium
                </h3>
                <p style={{ fontSize: 12, color: "rgba(245,200,66,0.45)", marginTop: 2 }}>
                  {periodLabel} &middot; Ranked by {metricLabelLower}
                </p>
              </div>
            </div>
          </div>

          <PodiumCanvas
            podiumData={
              podiumRows.length
                ? podiumRows
                : [
                    {
                      name: "Volunteer One",
                      avatar: "VO",
                      flyers: 820,
                      color: "#f5c842",
                      height: 1.9,
                      rank: 1,
                      pos: 0,
                    },
                    {
                      name: "Volunteer Two",
                      avatar: "VT",
                      flyers: 710,
                      color: "#c0c0c0",
                      height: 1.4,
                      rank: 2,
                      pos: -1.8,
                    },
                    {
                      name: "Volunteer Three",
                      avatar: "VT",
                      flyers: 640,
                      color: "#cd7f32",
                      height: 1.1,
                      rank: 3,
                      pos: 1.8,
                    },
                  ]
            }
          />

          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 10,
              padding: "16px 24px",
              background: "linear-gradient(to top, rgba(26,18,0,0.95) 0%, transparent 100%)",
              display: "flex",
              justifyContent: "center",
              gap: 20,
              flexWrap: "wrap",
            }}
          >
            {podiumRows.map((row) => (
              <div key={row.rank} style={{ textAlign: "center" }}>
                <p
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: rankColors[row.rank] ?? "#f5c842",
                    marginBottom: 1,
                  }}
                >
                  #{row.rank} | {row.name}
                </p>
                <p style={{ fontSize: 10.5, color: "rgba(245,200,66,0.4)" }}>
                  {formatMetricValue(metricValueForEntry(podiumEntries[row.rank - 1]))}
                </p>
              </div>
            ))}
          </div>
        </SectionCard>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <SectionCard dark title="Your Standing" subtitle={`${periodLabel} ranking`}>
            {loading ? (
              <p style={{ fontSize: 12.5, color: "rgba(245,200,66,0.56)" }}>
                Loading your ranking...
              </p>
            ) : yourStanding ? (
              <>
                <div style={{ textAlign: "center", padding: "8px 0 12px" }}>
                  <div
                    style={{
                      fontFamily: "'Fraunces', Georgia, serif",
                      fontSize: 56,
                      fontWeight: 700,
                      color: "#f5c842",
                      lineHeight: 1,
                      letterSpacing: "-2px",
                    }}
                  >
                    #{yourStanding.rank}
                  </div>
                  <p style={{ fontSize: 12, color: "rgba(245,200,66,0.45)", marginTop: 4 }}>
                    out of {displayRows.length} volunteers
                  </p>
                </div>
                <div style={{ marginTop: 4 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 11, color: "rgba(245,200,66,0.5)" }}>
                      You | {formatMetricValue(yourFlyers)} {metricLabelLower}
                    </span>
                    <span style={{ fontSize: 11, color: "rgba(245,200,66,0.5)" }}>
                      {personAhead
                        ? `${personAhead.username} | ${formatMetricValue(aheadFlyers)} ${metricLabelLower}`
                        : "Top position"}
                    </span>
                  </div>
                  <div
                    style={{
                      height: 6,
                      borderRadius: 99,
                      background: "rgba(255,255,255,0.08)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${progressToNext}%`,
                        borderRadius: 99,
                        background: "linear-gradient(90deg, #f5c842, #fbbf24)",
                        boxShadow: "0 0 8px rgba(245,200,66,0.6)",
                      }}
                    />
                  </div>
                  <p
                    style={{
                      fontSize: 11.5,
                      color: "rgba(245,200,66,0.65)",
                      marginTop: 10,
                      textAlign: "center",
                    }}
                  >
                    {personAhead
                      ? `${formatMetricValue(Math.max(0, aheadFlyers - yourFlyers))} more ${metricLabelLower} to move up`
                      : "You are leading the board"}
                  </p>
                </div>
              </>
            ) : (
              <div style={{ textAlign: "center", padding: "16px 0" }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>🍋</div>
                <p style={{ fontSize: 13, color: "rgba(245,200,66,0.65)", lineHeight: 1.5, maxWidth: 240, margin: "0 auto" }}>
                  You&apos;re not in the top 10 yet. Keep volunteering to climb the ranks!
                </p>
              </div>
            )}
          </SectionCard>

          <SectionCard title={`${periodLabel} Stats`} subtitle="Across all volunteers" style={{ flex: 1 }}>
            {computedStats.map((stat, index) => (
              (() => {
                const highlight =
                  monthlyStatHighlights[index] ?? monthlyStatHighlights[monthlyStatHighlights.length - 1];

                return (
              <div
                key={stat.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 14px",
                  borderRadius: 18,
                  background: highlight.background,
                  boxShadow: `${highlight.shadow}, inset 0 1px 0 rgba(255,255,255,0.6)`,
                  marginBottom: index < computedStats.length - 1 ? 8 : 0,
                  borderBottom:
                    index < computedStats.length - 1 ? "1px solid rgba(190,155,70,0.06)" : "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      minWidth: 34,
                      padding: "5px 8px",
                      borderRadius: 999,
                      background: "rgba(255,255,255,0.78)",
                      boxShadow: highlight.shadow,
                      fontSize: 10,
                      fontWeight: 700,
                      color: highlight.pill,
                      textAlign: "center",
                    }}
                  >
                    {stat.icon}
                  </span>
                  <span style={{ fontSize: 12.5, color: "#7a6a40" }}>{stat.label}</span>
                </div>
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: "#1a1600",
                    fontFamily: "'Fraunces', Georgia, serif",
                  }}
                >
                  {stat.value}
                </span>
              </div>
                );
              })()
            ))}
          </SectionCard>
        </div>
      </div>

      <SectionCard
        title="Full Rankings"
        subtitle={`Top ${displayRows.length || 0} volunteers | ranked by ${metricLabelLower}`}
        action={
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {([["All Time", "all"], ["This Month", "month"], ["This Week", "week"]] as const).map(([label, value]) => {
              const isActive = period === value;
              return (
                <button
                  key={value}
                  onClick={() => setPeriod(value)}
                  style={{
                    fontSize: 11.5,
                    padding: "5px 12px",
                    borderRadius: 20,
                    cursor: "pointer",
                    border: `1px solid ${isActive ? "#f5c842" : "rgba(190,155,70,0.2)"}`,
                    background: isActive ? "#fef9c3" : "transparent",
                    color: isActive ? "#92400e" : "#9a8a60",
                    fontWeight: isActive ? 600 : 400,
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        }
      >
        {error ? (
          <p style={{ fontSize: 13, color: "#b91c1c" }}>{error}</p>
        ) : loading ? (
          <p style={{ fontSize: 13, color: "#8a7a50" }}>Loading leaderboard...</p>
        ) : (
          <div style={{ marginTop: 6, overflowX: "auto" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "44px minmax(180px, 1fr) 90px 90px 70px",
                gap: 12,
                padding: "0 10px 10px",
                borderBottom: "1px solid rgba(190,155,70,0.15)",
                minWidth: 500,
              }}
            >
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 600,
                  color: "#9a8a60",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                }}
              >
                #
              </span>
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 600,
                  color: "#9a8a60",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                }}
              >
                Volunteer
              </span>
              {([
                ["Flyers", "flyers"],
                ["Scans", "scans"],
                ["Hours", "hours"],
              ] as const).map(([heading, key]) => (
                <label
                  key={key}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 10.5,
                    fontWeight: 600,
                    color: "#9a8a60",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={visibleMetrics[key]}
                    onChange={() => toggleMetricVisibility(key)}
                    style={{
                      appearance: "none",
                      width: 16,
                      height: 16,
                      borderRadius: 5,
                      border: `1.5px solid ${visibleMetrics[key] ? "#7c3aed" : "rgba(190,155,70,0.28)"}`,
                      background: visibleMetrics[key] ? "linear-gradient(135deg, #f3e8ff, #ede9fe)" : "#fffdf8",
                      boxShadow: visibleMetrics[key] ? "inset 0 0 0 4px #7c3aed" : "none",
                      margin: 0,
                      cursor: "pointer",
                    }}
                  />
                  {heading}
                </label>
              ))}
            </div>
            {displayRows.map((volunteer, index) => (
              (() => {
                const topThreeBackground =
                  volunteer.rank === 1
                    ? "linear-gradient(90deg, rgba(245,200,66,0.18), rgba(255,248,220,0.55))"
                    : volunteer.rank === 2
                      ? "linear-gradient(90deg, rgba(156,163,175,0.16), rgba(248,250,252,0.65))"
                      : volunteer.rank === 3
                        ? "linear-gradient(90deg, rgba(180,83,9,0.16), rgba(255,247,237,0.62))"
                        : null;

                const rowBorder =
                  volunteer.rank === 1
                    ? "1.5px solid rgba(245,200,66,0.34)"
                    : volunteer.rank === 2
                      ? "1.5px solid rgba(156,163,175,0.28)"
                      : volunteer.rank === 3
                        ? "1.5px solid rgba(180,83,9,0.24)"
                        : volunteer.isYou
                          ? "1.5px solid rgba(245,200,66,0.30)"
                          : "1.5px solid transparent";

                return (
              <div
                key={volunteer.id}
                className="anim-fade-up"
                style={{
                  animationDelay: `${0.3 + index * 0.06}s`,
                  display: "grid",
                  gridTemplateColumns: "44px minmax(180px, 1fr) 90px 90px 70px",
                  gap: 12,
                  alignItems: "center",
                  padding: "10px 10px",
                  borderRadius: 10,
                  background:
                    topThreeBackground ??
                    (volunteer.isYou
                      ? "rgba(245,200,66,0.07)"
                      : index % 2 === 0
                        ? "transparent"
                        : "rgba(0,0,0,0.015)"),
                  border: rowBorder,
                  boxShadow: topThreeBackground ? `0 10px 24px ${rankColors[volunteer.rank]}18` : "none",
                  marginBottom: 3,
                  minWidth: 500,
                }}
              >
                <div style={{ textAlign: "center" }}>
                  {volunteer.rank <= 3 ? (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        minWidth: 58,
                        height: 28,
                        padding: "0 10px",
                        borderRadius: 999,
                        background: `linear-gradient(135deg, ${rankColors[volunteer.rank] ?? "#9a8a60"}33, rgba(255,255,255,0.9))`,
                        color: "#1f1600",
                        fontSize: 10.5,
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        boxShadow: `0 10px 20px ${rankColors[volunteer.rank] ?? "#9a8a60"}22`,
                      }}
                    >
                      <MedalSymbol
                        color={rankColors[volunteer.rank] ?? "#9a8a60"}
                        label={String(volunteer.rank)}
                      />
                    </span>
                  ) : (
                    <span
                      style={{
                        fontFamily: "'Fraunces', Georgia, serif",
                        fontSize: 14,
                        fontWeight: 700,
                        color: rankColors[volunteer.rank] ?? "#9a8a60",
                      }}
                    >
                      {volunteer.rank}
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      flexShrink: 0,
                      background: volunteer.isYou
                        ? "#f5c842"
                        : volunteer.rank <= 3
                          ? `${rankColors[volunteer.rank]}33`
                          : "#f3f0e8",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      fontWeight: 700,
                      color: volunteer.isYou
                        ? "#1a1000"
                        : volunteer.rank <= 3
                          ? rankColors[volunteer.rank]
                          : "#5a4a20",
                      overflow: "hidden",
                    }}
                  >
                    {volunteer.profile_photo_url ? (
                      <Image
                        src={volunteer.profile_photo_url}
                        alt={volunteer.username}
                        width={34}
                        height={34}
                        unoptimized
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      volunteer.avatar
                    )}
                  </div>
                  <div>
                    <p style={{ fontSize: 13.5, fontWeight: 600, color: "#1a1600" }}>
                      {volunteer.username}
                      {volunteer.isYou ? (
                        <span
                          style={{
                            fontSize: 10.5,
                            fontWeight: 400,
                            color: "#9a8a60",
                            marginLeft: 6,
                          }}
                        >
                          (You)
                        </span>
                      ) : null}
                    </p>
                  </div>
                </div>

                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: visibleMetrics.flyers ? "#1a1600" : "#8a7a50",
                    fontFamily: "'Fraunces', Georgia, serif",
                    opacity: visibleMetrics.flyers ? 1 : 0.62,
                  }}
                >
                  {volunteer.flyers.toLocaleString()}
                </span>

                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: visibleMetrics.scans ? "#7c3aed" : "#8a7a50",
                    fontFamily: "'Fraunces', Georgia, serif",
                    opacity: visibleMetrics.scans ? 1 : 0.62,
                  }}
                >
                  {volunteer.scans.toLocaleString()}
                </span>

                <span
                  style={{
                    fontSize: 13,
                    color: visibleMetrics.hours ? "#5a4a20" : "#8a7a50",
                    opacity: visibleMetrics.hours ? 1 : 0.62,
                  }}
                >
                  {volunteer.hoursLabel}
                </span>
              </div>
                );
              })()
            ))}
          </div>
        )}
      </SectionCard>
    </PageContainer>
  );
}
