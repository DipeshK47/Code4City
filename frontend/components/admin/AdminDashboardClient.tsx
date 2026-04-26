"use client";

import { useEffect, useMemo, useState } from "react";
import SectionCard from "@/components/common/SectionCard";
import StatCard from "@/components/common/StatCard";
import PageContainer from "@/components/layout/PageContainer";
import { useAuth } from "@/context/AuthContext";
import { fetchAdminOverview } from "@/lib/admin";
import type { AdminDailyProgress, AdminHotspotCategory, AdminNeedRegion, AdminOverview, AdminRecentSession, AdminVolunteer } from "@/types/admin";

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatDecimal(value: number, digits = 1) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value);
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatDuration(seconds: number) {
  if (!seconds) return "0m";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function MetricStrip({
  dailyProgress,
}: {
  dailyProgress: AdminDailyProgress[];
}) {
  const maxFlyers = Math.max(...dailyProgress.map((item) => item.flyers), 1);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(14, minmax(0, 1fr))", gap: 10 }}>
      {dailyProgress.map((item) => {
        const height = Math.max(12, Math.round((item.flyers / maxFlyers) * 92));

        return (
          <div key={item.day} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <div
              title={`${formatShortDate(item.day)} · ${item.flyers} proofs · ${item.sessions} sessions`}
              style={{
                width: "100%",
                minHeight: 104,
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "center",
                borderRadius: 2,
                background: "#F8F6F0",
                border: "1px solid rgba(11, 11, 10,0.16)",
                padding: "10px 6px",
              }}
            >
              <div
                style={{
                  width: "100%",
                  height,
                  borderRadius: 2,
                  background: "#D44A12",
                  boxShadow: "none",
                }}
              />
            </div>
            <div style={{ fontSize: 11, color: "#8A8780", textAlign: "center" }}>
              {formatShortDate(item.day)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function VolunteerTable({ volunteers }: { volunteers: AdminVolunteer[] }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
        <thead>
          <tr>
            {["Volunteer", "Proofs", "Hours", "Scans", "Sessions", "Miles", "Stops"].map((heading) => (
              <th
                key={heading}
                style={{
                  textAlign: "left",
                  fontSize: 11,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "#8A8780",
                  padding: "0 0 12px",
                  borderBottom: "1px solid rgba(11, 11, 10,0.2)",
                }}
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {volunteers.map((volunteer, index) => (
            <tr key={volunteer.id}>
              <td style={{ padding: "14px 0", borderBottom: "1px solid rgba(11, 11, 10,0.12)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 2,
                      background: index < 3 ? "#EBE7DE" : "#F8F6F0",
                      color: index < 3 ? "#0B0B0A" : "#8A8780",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 700,
                      fontSize: 13,
                      flexShrink: 0,
                    }}
                  >
                    {index + 1}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, color: "#0B0B0A" }}>{volunteer.displayName}</div>
                    <div style={{ fontSize: 12, color: "#8A8780" }}>@{volunteer.username}</div>
                  </div>
                </div>
              </td>
              <td style={{ padding: "14px 0", borderBottom: "1px solid rgba(11, 11, 10,0.12)", color: "#0B0B0A" }}>{formatNumber(volunteer.flyers)}</td>
              <td style={{ padding: "14px 0", borderBottom: "1px solid rgba(11, 11, 10,0.12)", color: "#0B0B0A" }}>{formatDecimal(volunteer.hours)}</td>
              <td style={{ padding: "14px 0", borderBottom: "1px solid rgba(11, 11, 10,0.12)", color: "#0B0B0A" }}>{formatNumber(volunteer.scans)}</td>
              <td style={{ padding: "14px 0", borderBottom: "1px solid rgba(11, 11, 10,0.12)", color: "#0B0B0A" }}>{formatNumber(volunteer.sessions)}</td>
              <td style={{ padding: "14px 0", borderBottom: "1px solid rgba(11, 11, 10,0.12)", color: "#0B0B0A" }}>{formatDecimal(volunteer.distanceMiles)}</td>
              <td style={{ padding: "14px 0", borderBottom: "1px solid rgba(11, 11, 10,0.12)", color: "#0B0B0A" }}>{formatNumber(volunteer.stopsLogged)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SessionList({ sessions }: { sessions: AdminRecentSession[] }) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {sessions.map((session) => (
        <div
          key={session.id}
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.8fr) repeat(4, minmax(0, 1fr))",
            gap: 12,
            padding: "14px 16px",
            borderRadius: 2,
            border: "1px solid rgba(11, 11, 10,0.16)",
            background: "#F8F6F0",
          }}
        >
          <div>
            <div style={{ fontWeight: 700, color: "#0B0B0A" }}>{session.volunteerName}</div>
            <div style={{ fontSize: 12, color: "#8A8780", marginTop: 4 }}>
              {formatDateTime(session.startedAt)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#8A8780", textTransform: "uppercase", letterSpacing: "0.08em" }}>Duration</div>
            <div style={{ marginTop: 5, fontWeight: 700, color: "#0B0B0A" }}>{formatDuration(session.durationSeconds)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#8A8780", textTransform: "uppercase", letterSpacing: "0.08em" }}>Distance</div>
            <div style={{ marginTop: 5, fontWeight: 700, color: "#0B0B0A" }}>{formatDecimal(session.distanceMiles)} mi</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#8A8780", textTransform: "uppercase", letterSpacing: "0.08em" }}>Route points</div>
            <div style={{ marginTop: 5, fontWeight: 700, color: "#0B0B0A" }}>{formatNumber(session.routePoints)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#8A8780", textTransform: "uppercase", letterSpacing: "0.08em" }}>Stops</div>
            <div style={{ marginTop: 5, fontWeight: 700, color: "#0B0B0A" }}>{formatNumber(session.stops)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function NeedRegionTable({ regions }: { regions: AdminNeedRegion[] }) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {regions.map((region) => (
        <div
          key={region.regionCode}
          style={{
            padding: "14px 16px",
            borderRadius: 2,
            border: "1px solid rgba(11, 11, 10,0.16)",
            background: "#F8F6F0",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ fontWeight: 700, color: "#0B0B0A" }}>{region.regionName}</div>
              <div style={{ fontSize: 12, color: "#8A8780", marginTop: 4 }}>
                {region.boroughName || "NYC"} · {formatDecimal(region.foodInsecurePercentage)}% food insecurity
              </div>
            </div>
            <div
              style={{
                padding: "8px 12px",
                borderRadius: 2,
                background: "#F8F6F0",
                color: "#aa6714",
                fontSize: 12,
                fontWeight: 700,
                whiteSpace: "nowrap",
              }}
            >
              {region.uncoveredHotspots} uncovered
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <div style={{ height: 10, borderRadius: 2, background: "rgba(11, 11, 10,0.14)", overflow: "hidden" }}>
              <div
                style={{
                  width: `${Math.max(6, region.coverageRate)}%`,
                  height: "100%",
                  borderRadius: 2,
                  background: "#D44A12",
                }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 12, color: "#8A8780" }}>
              <span>{region.coveredHotspots} covered</span>
              <span>{formatDecimal(region.coverageRate)}% covered</span>
              <span>{region.totalHotspots} total spots</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function CategoryList({ categories }: { categories: AdminHotspotCategory[] }) {
  const maxTotal = Math.max(...categories.map((item) => item.totalSpots), 1);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {categories.map((category) => (
        <div key={category.category}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
            <div style={{ fontWeight: 600, color: "#0B0B0A" }}>{category.category}</div>
            <div style={{ fontSize: 12, color: "#8A8780" }}>
              {category.coveredSpots}/{category.totalSpots} covered
            </div>
          </div>
          <div style={{ height: 10, borderRadius: 2, background: "rgba(11, 11, 10,0.14)", overflow: "hidden" }}>
            <div
              style={{
                width: `${Math.max(10, (category.totalSpots / maxTotal) * 100)}%`,
                height: "100%",
                borderRadius: 2,
                background: "#D44A12",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AdminDashboardClient() {
  const { token, user, loading } = useAuth();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!token || user?.isGuest) {
      return;
    }

    let cancelled = false;

    fetchAdminOverview(token)
      .then((data) => {
        if (!cancelled) {
          setError(null);
          setOverview(data);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load admin dashboard.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [loading, token, user?.isGuest]);

  const summaryCards = useMemo(() => {
    if (!overview) return [];
    const { summary } = overview;

    return [
      { label: "Volunteers", value: formatNumber(summary.totalVolunteers), icon: "V", iconBg: "#EBE7DE", change: `${formatNumber(summary.activeLast30Days)} active in 30 days` },
      { label: "Proofs Logged", value: formatNumber(summary.totalFlyers), icon: "P", iconBg: "#EBE7DE", change: `${formatDecimal(summary.totalHours)} volunteer hours` },
      { label: "QR Scans", value: formatNumber(summary.totalScans), icon: "Q", iconBg: "#bbf7d0", change: `${formatDecimal(summary.avgScansPerCode)} per code issued` },
      { label: "Route Sessions", value: formatNumber(summary.totalSessions), icon: "R", iconBg: "#bfdbfe", change: `${formatDecimal(summary.totalDistanceMiles)} miles total` },
      { label: "Hotspot Coverage", value: `${formatDecimal(summary.hotspotCoverageRate)}%`, icon: "H", iconBg: "#fecaca", change: `${formatNumber(summary.coveredHotspots)} of ${formatNumber(summary.totalHotspots)} covered` },
      { label: "Community Activity", value: formatNumber(summary.communityPosts + summary.postComments), icon: "C", iconBg: "#e9d5ff", change: `${formatNumber(summary.activeMeetups)} active meetups` },
    ];
  }, [overview]);

  const isDashboardLoading = !loading && !!token && !user?.isGuest && !overview && !error;

  return (
    <PageContainer>
      <div style={{ display: "grid", gap: 22 }}>
        <div
          style={{
            background: "#F8F6F0",
            border: "1px solid rgba(11, 11, 10, 0.16)",
            borderRadius: 2,
            padding: "30px 32px",
            boxShadow: "none",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: "linear-gradient(90deg, rgba(11,11,10,0.06) 1px, transparent 1px), linear-gradient(0deg, rgba(11,11,10,0.04) 1px, transparent 1px)",
              backgroundSize: "56px 56px",
              opacity: 0.48,
              pointerEvents: "none",
            }}
          />
          <div style={{ position: "relative", maxWidth: 760 }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", color: "#8A8780", fontWeight: 400 }}>
              Volun-Tiers Admin
            </div>
            <h1 style={{ fontFamily: "'Instrument Serif', serif", fontSize: "clamp(54px, 7vw, 104px)", fontWeight: 400, letterSpacing: "-0.045em", lineHeight: 0.9, color: "#0B0B0A", marginTop: 16 }}>
              Volunteer progress, coverage, and impact in one place.
            </h1>
            <p style={{ marginTop: 18, color: "#1A1917", fontSize: 24, maxWidth: 760, lineHeight: 1.25 }}>
              This hidden dashboard pulls from the live volunteer, route, QR, hotspot, and community tables so Volun-Tiers staff can track what is working and where support is still needed.
            </p>
            {overview && (
              <div style={{ marginTop: 18, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: "0.08em", color: "#8A8780" }}>
                Last refreshed {formatDateTime(overview.generatedAt)}
              </div>
            )}
          </div>
        </div>

        {loading || isDashboardLoading ? (
          <SectionCard title="Loading admin dashboard" subtitle="Pulling live data from the volunteer database.">
            <div style={{ color: "#8A8780", fontSize: 14 }}>Fetching the latest summary, sessions, scans, and coverage metrics.</div>
          </SectionCard>
        ) : !token || user?.isGuest ? (
          <SectionCard title="Sign in required" subtitle="The admin dashboard is hidden from navigation and only available manually.">
            <div style={{ color: "#8A8780", fontSize: 14, lineHeight: 1.6 }}>
              Sign in with a Volun-Tiers account, then open <strong>/admin</strong> to use this page. There is no separate admin-role table yet, so access is currently controlled by keeping this route unlisted and authenticated.
            </div>
          </SectionCard>
        ) : error ? (
          <SectionCard title="Dashboard unavailable" subtitle="The admin endpoint did not return data.">
            <div style={{ color: "#b45309", fontSize: 14 }}>{error}</div>
          </SectionCard>
        ) : overview ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16 }}>
              {summaryCards.map((card) => (
                <StatCard
                  key={card.label}
                  label={card.label}
                  value={card.value}
                  icon={card.icon}
                  iconBg={card.iconBg}
                  change={card.change}
                />
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr", gap: 18 }}>
              <SectionCard
                title="14-day volunteer trend"
                subtitle="Daily proof logging, route sessions, and signups."
              >
                <MetricStrip dailyProgress={overview.dailyProgress} />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, marginTop: 18 }}>
                  <div style={{ padding: "12px 14px", borderRadius: 2, background: "#F8F6F0", border: "1px solid rgba(11, 11, 10,0.16)" }}>
                    <div style={{ fontSize: 11, textTransform: "uppercase", color: "#8A8780", letterSpacing: "0.08em" }}>Last 14d proofs</div>
                    <div style={{ marginTop: 6, fontWeight: 700, color: "#0B0B0A" }}>{formatNumber(overview.dailyProgress.reduce((sum, item) => sum + item.flyers, 0))}</div>
                  </div>
                  <div style={{ padding: "12px 14px", borderRadius: 2, background: "#F8F6F0", border: "1px solid rgba(11, 11, 10,0.16)" }}>
                    <div style={{ fontSize: 11, textTransform: "uppercase", color: "#8A8780", letterSpacing: "0.08em" }}>Sessions</div>
                    <div style={{ marginTop: 6, fontWeight: 700, color: "#0B0B0A" }}>{formatNumber(overview.dailyProgress.reduce((sum, item) => sum + item.sessions, 0))}</div>
                  </div>
                  <div style={{ padding: "12px 14px", borderRadius: 2, background: "#F8F6F0", border: "1px solid rgba(11, 11, 10,0.16)" }}>
                    <div style={{ fontSize: 11, textTransform: "uppercase", color: "#8A8780", letterSpacing: "0.08em" }}>Miles</div>
                    <div style={{ marginTop: 6, fontWeight: 700, color: "#0B0B0A" }}>{formatDecimal(overview.dailyProgress.reduce((sum, item) => sum + item.distanceMiles, 0))}</div>
                  </div>
                  <div style={{ padding: "12px 14px", borderRadius: 2, background: "#F8F6F0", border: "1px solid rgba(11, 11, 10,0.16)" }}>
                    <div style={{ fontSize: 11, textTransform: "uppercase", color: "#8A8780", letterSpacing: "0.08em" }}>New signups</div>
                    <div style={{ marginTop: 6, fontWeight: 700, color: "#0B0B0A" }}>{formatNumber(overview.dailyProgress.reduce((sum, item) => sum + item.signups, 0))}</div>
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Operational snapshot" subtitle="What is sitting in the system right now.">
                <div style={{ display: "grid", gap: 12 }}>
                  {[
                    ["QR codes issued", formatNumber(overview.summary.qrCodesIssued)],
                    ["Saved route items", formatNumber(overview.summary.pendingRouteItems)],
                    ["Mapped need regions", formatNumber(overview.summary.mappedRegions)],
                    ["Community posts", formatNumber(overview.summary.communityPosts)],
                    ["Comments", formatNumber(overview.summary.postComments)],
                    ["Meetup members", formatNumber(overview.summary.meetupMembers)],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        padding: "13px 14px",
                        borderRadius: 2,
                        background: "#F8F6F0",
                        border: "1px solid rgba(11, 11, 10,0.16)",
                      }}
                    >
                      <span style={{ color: "#8A8780", fontSize: 13 }}>{label}</span>
                      <span style={{ color: "#0B0B0A", fontWeight: 700 }}>{value}</span>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr", gap: 18 }}>
              <SectionCard title="Top volunteers" subtitle="Best overall output across proofs, hours, scans, and route work.">
                <VolunteerTable volunteers={overview.topVolunteers} />
              </SectionCard>
              <SectionCard title="Hotspot categories" subtitle="Where the map inventory is concentrated.">
                <CategoryList categories={overview.hotspotCategories} />
              </SectionCard>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 18 }}>
              <SectionCard title="Recent route sessions" subtitle="Latest completed volunteer tracking sessions.">
                <SessionList sessions={overview.recentSessions} />
              </SectionCard>
              <SectionCard title="Need regions with open coverage" subtitle="High-need areas that still have uncovered outreach spots.">
                <NeedRegionTable regions={overview.needRegions} />
              </SectionCard>
            </div>
          </>
        ) : null}
      </div>
    </PageContainer>
  );
}
