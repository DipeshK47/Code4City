"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PageContainer from "@/components/layout/PageContainer";
import { useAuth } from "@/context/AuthContext";
import { getCommunityPosts } from "@/lib/community-api";
import { getMeetups, joinMeetup, leaveMeetup } from "@/lib/meetup-api";
import { formatDateTimeRange } from "@/lib/social-format";
import type { CommunityPost, MeetupSummary } from "@/lib/social-types";
import CommunityFeed from "./CommunityFeed";

const GUIDE_ITEMS = [
  "Use the map's Meetups layer to find nearby volunteer plans.",
  "Posts can link directly to meetups and group chat.",
  "Keep titles specific so volunteers know what action is needed.",
];

export default function CommunityPageClient() {
  const router = useRouter();
  const { token, user, isGuest } = useAuth();
  const [viewportWidth, setViewportWidth] = useState(1440);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [meetups, setMeetups] = useState<MeetupSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isPhone = viewportWidth <= 820;
  const showLeftRail = viewportWidth > 1180;
  const showRightRail = viewportWidth > 900;

  useEffect(() => {
    const syncViewport = () => setViewportWidth(window.innerWidth);
    syncViewport();
    window.addEventListener("resize", syncViewport);

    return () => {
      window.removeEventListener("resize", syncViewport);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        setLoading(true);
        const [postsResponse, meetupsResponse] = await Promise.all([
          getCommunityPosts(token),
          getMeetups(token, false),
        ]);

        if (cancelled) return;

        setPosts(postsResponse.data);
        setMeetups(meetupsResponse.data);
        setError(null);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Could not load community.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const meetupPosts = useMemo(
    () => posts.filter((post) => Boolean(post.meetup)).length,
    [posts],
  );

  function updatePost(updatedPost: CommunityPost) {
    setPosts((current) =>
      current.map((post) => (post.id === updatedPost.id ? updatedPost : post)),
    );

    if (updatedPost.meetup) {
      setMeetups((current) =>
        current.map((meetup) =>
          meetup.id === updatedPost.meetup?.id ? updatedPost.meetup : meetup,
        ),
      );
    }
  }

  function deletePost(postId: number) {
    setPosts((current) => current.filter((post) => post.id !== postId));
  }

  function updateMeetup(updatedMeetup: MeetupSummary) {
    setMeetups((current) =>
      current.map((meetup) => (meetup.id === updatedMeetup.id ? updatedMeetup : meetup)),
    );
    setPosts((current) =>
      current.map((post) =>
        post.meetup?.id === updatedMeetup.id ? { ...post, meetup: updatedMeetup } : post,
      ),
    );
  }

  async function handleMeetupToggle(meetup: MeetupSummary) {
    if (!token) return;

    const response = meetup.viewerJoined
      ? await leaveMeetup(token, meetup.id)
      : await joinMeetup(token, meetup.id);

    updateMeetup(response.data);
  }

  return (
    <PageContainer
      style={{
        padding: isPhone ? "16px 0 28px" : "26px 20px 40px",
        background: "var(--bg-base)",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: showLeftRail
            ? "220px minmax(0, 1fr) 300px"
            : showRightRail
              ? "minmax(0, 1fr) 300px"
              : "1fr",
          gap: isPhone ? 0 : 24,
          alignItems: "start",
          maxWidth: 1500,
          margin: "0 auto",
        }}
      >
        {showLeftRail ? (
          <aside style={{ position: "sticky", top: 92, alignSelf: "start" }}>
            <div className="community-soft-card" style={{ padding: 18 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                  marginBottom: 14,
                }}
              >
                Community Notes
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                {GUIDE_ITEMS.map((item) => (
                  <div
                    key={item}
                    style={{
                      borderRadius: 10,
                      background: "#FCFCFA",
                      border: "1px solid var(--border-subtle)",
                      padding: "12px 13px",
                      fontSize: 12.5,
                      color: "var(--text-muted)",
                      lineHeight: 1.55,
                    }}
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </aside>
        ) : null}

        <main style={{ minWidth: 0 }}>
          <div style={{ padding: isPhone ? "0 12px" : 0 }}>
            <section className="community-hero anim-fade-up">
              <div
                style={{
                  display: "flex",
                  alignItems: isPhone ? "flex-start" : "center",
                  justifyContent: "space-between",
                  gap: 18,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "5px 10px",
                      borderRadius: 999,
                      background: "var(--accent-amber-muted)",
                      color: "#7a5200",
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      marginBottom: 14,
                    }}
                  >
                    Lemontree Community
                  </div>
                  <h1>
                    Coordinate volunteers, routes, and meetups in one feed.
                  </h1>
                  <p
                    style={{
                      maxWidth: 650,
                      fontSize: 14,
                      lineHeight: 1.7,
                      color: "var(--text-muted)",
                    }}
                  >
                    Use posts for planning, meetups for action, and DMs when a public thread
                    should turn into direct coordination.
                  </p>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginLeft: isPhone ? 0 : "auto",
                  }}
                >
                  <IconActionButton
                    href="/community/create-post"
                    label="Create post"
                    accent="amber"
                    icon={
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 5v14" />
                        <path d="M5 12h14" />
                      </svg>
                    }
                  />
                  <IconActionButton
                    href="/community/create-meetup"
                    label="Create meetup"
                    accent="green"
                    icon={
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 10c0 7-9 11-9 11s-9-4-9-11a9 9 0 1 1 18 0Z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                    }
                  />
                  <IconActionButton
                    href="/messages"
                    label="Open messages"
                    accent="ghost"
                    icon={
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                    }
                  />
                </div>
              </div>

              <div
                className="stats-row"
                style={{
                  marginTop: 22,
                  flexWrap: "wrap",
                  gap: isPhone ? 14 : 24,
                }}
              >
                <CommunityStat label="Posts" value={posts.length} />
                <CommunityStat label="Meetup posts" value={meetupPosts} />
                <CommunityStat label="Active meetups" value={meetups.length} />
                <CommunityStat
                  label="Mode"
                  value={isGuest ? "Guest" : "Member"}
                  isText
                />
              </div>
            </section>
          </div>

          <div
            style={{
              display: "grid",
              gap: 14,
              padding: isPhone ? "0 12px" : 0,
            }}
          >
            {loading ? (
              <LoadingFeed />
            ) : error ? (
              <div
                className="community-soft-card"
                style={{
                  padding: "16px 18px",
                  color: "#b91c1c",
                  background: "rgba(254,242,242,0.92)",
                }}
              >
                {error}
              </div>
            ) : (
              <CommunityFeed
                posts={posts}
                token={token}
                currentUserId={user?.id}
                isGuest={isGuest}
                isMobile={isPhone}
                onPostUpdated={updatePost}
                onPostDeleted={deletePost}
              />
            )}
          </div>
        </main>

        {showRightRail ? (
          <aside style={{ position: "sticky", top: 92, alignSelf: "start" }}>
            <div className="meetups-panel">
              <h3>Upcoming Meetups</h3>
              {meetups.length > 0 ? (
                <div style={{ display: "grid" }}>
                  {meetups.slice(0, 5).map((meetup) => (
                    <div key={meetup.id} className="meetup-row">
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 14,
                              fontWeight: 700,
                              color: "var(--text-primary)",
                              lineHeight: 1.35,
                            }}
                          >
                            {meetup.title}
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              color: "var(--text-muted)",
                              marginTop: 5,
                              lineHeight: 1.5,
                            }}
                          >
                            {formatDateTimeRange(meetup.startTime, meetup.endTime)}
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              color: "var(--text-muted)",
                              marginTop: 4,
                              lineHeight: 1.5,
                            }}
                          >
                            {meetup.locationLabel}
                          </div>
                        </div>
                        <div
                          style={{
                            borderRadius: 999,
                            background: "var(--accent-green-muted)",
                            color: "#166534",
                            padding: "6px 9px",
                            height: "fit-content",
                            fontSize: 11,
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          {meetup.joinedCount} joined
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          className={meetup.viewerJoined ? "btn-ghost" : "btn-leave"}
                          disabled={!token || Boolean(isGuest)}
                          onClick={() => void handleMeetupToggle(meetup)}
                          style={{
                            opacity: !token || isGuest ? 0.58 : 1,
                          }}
                        >
                          {meetup.viewerJoined ? "Leave" : "Join"}
                        </button>
                        <button
                          type="button"
                          className="btn-ghost"
                          onClick={() => router.push(`/community/meetups/${meetup.id}`)}
                        >
                          View
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  style={{
                    fontSize: 12.5,
                    color: "var(--text-muted)",
                    lineHeight: 1.6,
                  }}
                >
                  No meetups yet. Create one from the action buttons above.
                </div>
              )}
            </div>
          </aside>
        ) : null}
      </div>
    </PageContainer>
  );
}

function IconActionButton({
  href,
  label,
  icon,
  accent,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  accent: "green" | "amber" | "ghost";
}) {
  const accentStyle: Record<typeof accent, React.CSSProperties> = {
    green: {
      background: "var(--gradient-btn-primary)",
      color: "#ffffff",
      borderColor: "rgba(245,200,66,0.24)",
    },
    amber: {
      background: "linear-gradient(135deg, #F59E0B, #D97706)",
      color: "#ffffff",
      borderColor: "rgba(245,158,11,0.2)",
    },
    ghost: {
      background: "var(--bg-card)",
      color: "var(--text-primary)",
      borderColor: "var(--border-subtle)",
    },
  };

  return (
    <Link href={href} className="action-btn" style={accentStyle[accent]}>
      {icon}
      <span className="tooltip">{label}</span>
    </Link>
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

function LoadingFeed() {
  return (
    <div style={{ display: "grid", gap: 14 }}>
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className="post-card anim-fade-up"
          style={{
            padding: "20px 24px",
            display: "grid",
            gap: 12,
          }}
        >
          <div className="anim-shimmer" style={{ width: 180, height: 14, borderRadius: 999 }} />
          <div className="anim-shimmer" style={{ width: "68%", height: 22, borderRadius: 999 }} />
          <div className="anim-shimmer" style={{ width: "100%", height: 12, borderRadius: 999 }} />
          <div className="anim-shimmer" style={{ width: "84%", height: 12, borderRadius: 999 }} />
        </div>
      ))}
    </div>
  );
}
