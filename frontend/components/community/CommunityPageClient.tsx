"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PageContainer from "@/components/layout/PageContainer";
import { useAuth } from "@/context/AuthContext";
import { getMeetups, joinMeetup, leaveMeetup } from "@/lib/meetup-api";
import { formatDateTimeRange } from "@/lib/social-format";
import type { MeetupSummary } from "@/lib/social-types";
import {
  approveSuggestion,
  dismissSuggestion,
  fetchSuggestions,
  regenerateSuggestions,
  type EventSuggestion,
} from "@/lib/event-suggestions-api";

const AI_COORDINATOR_THRESHOLD = 3;

export default function CommunityPageClient() {
  const router = useRouter();
  const { token, isGuest } = useAuth();
  const [viewportWidth, setViewportWidth] = useState(1440);
  const [meetups, setMeetups] = useState<MeetupSummary[]>([]);
  const [suggestions, setSuggestions] = useState<EventSuggestion[]>([]);
  const [suggestionBusy, setSuggestionBusy] = useState<string | null>(null);
  const [meetupBusy, setMeetupBusy] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isPhone = viewportWidth <= 820;
  const isTablet = viewportWidth > 820 && viewportWidth <= 1180;

  useEffect(() => {
    const sync = () => setViewportWidth(window.innerWidth);
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const [meetupsRes, suggestionsList] = await Promise.all([
          getMeetups(token, false),
          fetchSuggestions().catch(() => [] as EventSuggestion[]),
        ]);
        if (cancelled) return;
        setMeetups(meetupsRes.data);
        setSuggestions(suggestionsList);
        setError(null);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load community.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const meetupsAtCoordinatorThreshold = useMemo(
    () => meetups.filter((m) => m.joinedCount >= AI_COORDINATOR_THRESHOLD).length,
    [meetups],
  );

  function updateMeetup(updated: MeetupSummary) {
    setMeetups((current) => current.map((m) => (m.id === updated.id ? updated : m)));
  }

  async function handleMeetupToggle(meetup: MeetupSummary) {
    if (!token) return;
    setMeetupBusy(Number(meetup.id));
    try {
      const res = meetup.viewerJoined
        ? await leaveMeetup(token, meetup.id)
        : await joinMeetup(token, meetup.id);
      updateMeetup(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update meetup.");
    } finally {
      setMeetupBusy(null);
    }
  }

  async function handleApproveSuggestion(s: EventSuggestion) {
    if (!token) return;
    setSuggestionBusy(s.id);
    try {
      const result = await approveSuggestion(token, s.id);
      setSuggestions((current) => current.filter((x) => x.id !== s.id));
      router.push(`/community/meetups/${result.meetupId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not turn suggestion into meetup.");
    } finally {
      setSuggestionBusy(null);
    }
  }

  async function handleDismissSuggestion(s: EventSuggestion) {
    setSuggestionBusy(s.id);
    try {
      await dismissSuggestion(s.id);
      setSuggestions((current) => current.filter((x) => x.id !== s.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not dismiss suggestion.");
    } finally {
      setSuggestionBusy(null);
    }
  }

  async function handleRegenerateSuggestions() {
    setSuggestionBusy("__regen");
    try {
      await regenerateSuggestions();
      const list = await fetchSuggestions();
      setSuggestions(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not regenerate suggestions.");
    } finally {
      setSuggestionBusy(null);
    }
  }

  const sectionGridStyle: React.CSSProperties = {
    display: "grid",
    gap: 14,
    gridTemplateColumns: isPhone ? "1fr" : isTablet ? "1fr" : "1fr 1fr",
  };

  return (
    <PageContainer
      style={{
        padding: isPhone ? "16px 0 28px" : "26px 20px 40px",
        background: "var(--bg-base)",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <section className="community-hero anim-fade-up" style={{ padding: isPhone ? "20px 16px" : "26px 28px" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "5px 10px",
              borderRadius: 2,
              background: "rgba(212, 74, 18, 0.10)",
              color: "#D44A12",
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              marginBottom: 14,
            }}
          >
            AI · Volun-Tiers Community
          </div>
          <h1 style={{ marginBottom: 10 }}>
            AI plans your meetups. AI proposes events from your runs.
          </h1>
          <p
            style={{
              maxWidth: 720,
              fontSize: 14,
              lineHeight: 1.7,
              color: "var(--text-muted)",
              marginBottom: 18,
            }}
          >
            Two AI features run this page. Join an active meetup and once {AI_COORDINATOR_THRESHOLD}+ volunteers
            are in, the AI coordinator posts a structured plan with a per-person assignment in the chat. Or check
            the AI Suggested Events panel — when several volunteers run solo routes in the same area, the AI
            proposes a shared meetup so you can join forces.
          </p>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            <Link href="/community/create-meetup" className="action-btn" style={{ background: "#D44A12", color: "#F8F6F0", borderColor: "rgba(212, 74, 18,0.24)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 11-9 11s-9-4-9-11a9 9 0 1 1 18 0Z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span className="tooltip">Create meetup</span>
            </Link>
            <Link href="/messages" className="action-btn" style={{ background: "var(--bg-card)", color: "var(--text-primary)", borderColor: "var(--border-subtle)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span className="tooltip">Open messages</span>
            </Link>
          </div>

          <div className="stats-row" style={{ marginTop: 22, flexWrap: "wrap", gap: isPhone ? 14 : 24 }}>
            <CommunityStat label="Active meetups" value={meetups.length} />
            <CommunityStat label={`Meetups at ${AI_COORDINATOR_THRESHOLD}+ joined`} value={meetupsAtCoordinatorThreshold} />
            <CommunityStat label="AI suggestions pending" value={suggestions.length} />
            <CommunityStat label="Mode" value={isGuest ? "Guest" : "Member"} isText />
          </div>
        </section>

        {error ? (
          <div
            className="community-soft-card"
            style={{
              marginTop: 16,
              padding: "16px 18px",
              color: "#b91c1c",
              background: "rgba(254,242,242,0.92)",
            }}
          >
            {error}
          </div>
        ) : null}

        <section style={{ marginTop: 26 }}>
          <SectionHeader
            badge="AI Coordinator"
            title="Active Meetups"
            subtitle={`Hit ${AI_COORDINATOR_THRESHOLD} attendees and the AI auto-posts a coordinated plan in the meetup chat with each member's role, direction, and focus category.`}
          />

          {loading ? (
            <LoadingGrid />
          ) : meetups.length === 0 ? (
            <EmptyCard text="No upcoming meetups yet. Use Create meetup or approve an AI suggestion below to start one." />
          ) : (
            <div style={sectionGridStyle}>
              {meetups.map((meetup) => {
                const joinedCount = meetup.joinedCount ?? 0;
                const reachedThreshold = joinedCount >= AI_COORDINATOR_THRESHOLD;
                const slotsToThreshold = Math.max(AI_COORDINATOR_THRESHOLD - joinedCount, 0);
                return (
                  <div key={meetup.id} className="meetup-row" style={{ padding: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.35 }}>
                          {meetup.title}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.5 }}>
                          {formatDateTimeRange(meetup.startTime, meetup.endTime)}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4, lineHeight: 1.5 }}>
                          {meetup.locationLabel}
                        </div>
                        {meetup.creator?.fullName ? (
                          <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 6 }}>
                            Hosted by {meetup.creator.fullName}
                          </div>
                        ) : null}
                      </div>
                      <CoordinatorBadge reached={reachedThreshold} joinedCount={joinedCount} />
                    </div>

                    <div
                      style={{
                        marginTop: 12,
                        padding: "8px 10px",
                        borderRadius: 4,
                        background: reachedThreshold ? "rgba(212, 74, 18, 0.08)" : "rgba(245, 158, 11, 0.08)",
                        border: `1px solid ${reachedThreshold ? "rgba(212, 74, 18, 0.28)" : "rgba(245, 158, 11, 0.32)"}`,
                        fontSize: 11.5,
                        lineHeight: 1.5,
                        color: "var(--text-muted)",
                      }}
                    >
                      {reachedThreshold
                        ? "AI coordinator has posted a plan in the meetup chat. Open it to see your assignment."
                        : `${slotsToThreshold} more ${slotsToThreshold === 1 ? "person" : "people"} until the AI coordinator activates.`}
                    </div>

                    <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        className={meetup.viewerJoined ? "btn-ghost" : "btn-leave"}
                        disabled={!token || Boolean(isGuest) || meetupBusy === Number(meetup.id)}
                        onClick={() => void handleMeetupToggle(meetup)}
                        style={{ opacity: !token || isGuest ? 0.58 : 1 }}
                      >
                        {meetupBusy === Number(meetup.id)
                          ? "…"
                          : meetup.viewerJoined
                            ? "Leave"
                            : reachedThreshold
                              ? "Join — AI plan ready"
                              : `Join (${slotsToThreshold} away from AI coordinator)`}
                      </button>
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => router.push(`/community/meetups/${meetup.id}`)}
                      >
                        View chat
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section style={{ marginTop: 30, marginBottom: 16 }}>
          <SectionHeader
            badge="AI Suggested Events"
            title="Patterns the AI spotted in solo runs"
            subtitle="When ≥3 different volunteers run solo routes in the same neighborhood on the same weekday for several weeks, the AI proposes a shared meetup."
            action={
              <button
                type="button"
                className="btn-ghost"
                disabled={suggestionBusy === "__regen"}
                onClick={() => void handleRegenerateSuggestions()}
                style={{ fontSize: 11.5 }}
              >
                {suggestionBusy === "__regen" ? "Re-scanning…" : "Re-run scan"}
              </button>
            }
          />

          {loading ? (
            <LoadingGrid />
          ) : suggestions.length === 0 ? (
            <EmptyCard text="No patterns spotted yet. The AI re-runs whenever you click Re-run scan or on every page load." />
          ) : (
            <div style={sectionGridStyle}>
              {suggestions.map((s) => (
                <div
                  key={s.id}
                  className="meetup-row"
                  style={{
                    padding: 16,
                    background: "rgba(212, 74, 18, 0.05)",
                    borderColor: "rgba(212, 74, 18, 0.32)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.35 }}>
                        {s.dayName} group outreach in {s.regionName}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.55 }}>
                        {s.rationale}
                      </div>
                      {s.boroughName ? (
                        <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 6 }}>
                          {s.boroughName}
                        </div>
                      ) : null}
                    </div>
                    <div
                      style={{
                        borderRadius: 2,
                        background: "rgba(212, 74, 18, 0.16)",
                        color: "#D44A12",
                        padding: "6px 9px",
                        height: "fit-content",
                        fontSize: 11,
                        fontWeight: 800,
                        flexShrink: 0,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {s.uniqueUserCount} solo
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="btn-leave"
                      disabled={!token || suggestionBusy === s.id}
                      onClick={() => void handleApproveSuggestion(s)}
                      style={{ fontSize: 11.5, opacity: !token ? 0.55 : 1 }}
                    >
                      {suggestionBusy === s.id ? "Creating…" : "Turn into meetup"}
                    </button>
                    <button
                      type="button"
                      className="btn-ghost"
                      disabled={suggestionBusy === s.id}
                      onClick={() => void handleDismissSuggestion(s)}
                      style={{ fontSize: 11.5 }}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </PageContainer>
  );
}

function CoordinatorBadge({ reached, joinedCount }: { reached: boolean; joinedCount: number }) {
  return (
    <div
      style={{
        borderRadius: 2,
        background: reached ? "rgba(212, 74, 18, 0.16)" : "rgba(245, 158, 11, 0.18)",
        color: reached ? "#D44A12" : "#7a5200",
        padding: "6px 9px",
        height: "fit-content",
        fontSize: 11,
        fontWeight: 800,
        flexShrink: 0,
        whiteSpace: "nowrap",
        textAlign: "right",
      }}
    >
      {reached ? `${joinedCount} joined · AI live` : `${joinedCount} joined`}
    </div>
  );
}

function SectionHeader({
  badge,
  title,
  subtitle,
  action,
}: {
  badge: string;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
        <div>
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.16em",
              fontWeight: 800,
              color: "#D44A12",
              textTransform: "uppercase",
              marginBottom: 6,
            }}
          >
            AI · {badge}
          </div>
          <h2 style={{ margin: 0, fontFamily: "Fraunces, Georgia, serif", fontSize: 22, color: "var(--text-primary)" }}>
            {title}
          </h2>
        </div>
        {action}
      </div>
      <p style={{ margin: "8px 0 0", maxWidth: 720, fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.6 }}>
        {subtitle}
      </p>
    </div>
  );
}

function CommunityStat({
  label,
  value,
  isText = false,
}: {
  label: string;
  value: number | string;
  isText?: boolean;
}) {
  return (
    <div>
      <span className="stat-value" style={{ fontSize: isText ? 16 : 20 }}>
        {value}
      </span>
      {label}
    </div>
  );
}

function EmptyCard({ text }: { text: string }) {
  return (
    <div
      className="community-soft-card"
      style={{
        padding: "18px 20px",
        fontSize: 12.5,
        color: "var(--text-muted)",
        lineHeight: 1.6,
      }}
    >
      {text}
    </div>
  );
}

function LoadingGrid() {
  return (
    <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="post-card anim-fade-up"
          style={{ padding: "20px 24px", display: "grid", gap: 12 }}
        >
          <div className="anim-shimmer" style={{ width: 180, height: 14, borderRadius: 2 }} />
          <div className="anim-shimmer" style={{ width: "68%", height: 22, borderRadius: 2 }} />
          <div className="anim-shimmer" style={{ width: "100%", height: 12, borderRadius: 2 }} />
          <div className="anim-shimmer" style={{ width: "84%", height: 12, borderRadius: 2 }} />
        </div>
      ))}
    </div>
  );
}
