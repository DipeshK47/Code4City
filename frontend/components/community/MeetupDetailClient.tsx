"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import PageContainer from "@/components/layout/PageContainer";
import SectionCard from "@/components/common/SectionCard";
import MeetupChat from "@/components/chat/MeetupChat";
import { useAuth } from "@/context/AuthContext";
import { cancelMeetup, getMeetupById } from "@/lib/meetup-api";
import { formatDisplayName } from "@/lib/social-format";
import type { MeetupSummary } from "@/lib/social-types";
import MeetupCard from "./MeetupCard";

export default function MeetupDetailClient({
  meetupId,
}: {
  meetupId: number;
}) {
  const { token, user, isGuest } = useAuth();
  const [isMobile, setIsMobile] = useState(false);
  const [meetup, setMeetup] = useState<MeetupSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 980px)");
    const syncViewport = () => setIsMobile(mediaQuery.matches);
    syncViewport();
    mediaQuery.addEventListener("change", syncViewport);

    return () => {
      mediaQuery.removeEventListener("change", syncViewport);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadMeetup() {
      try {
        setLoading(true);
        const response = await getMeetupById(meetupId, token);
        if (!cancelled) {
          setMeetup(response.data);
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Could not load meetup.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadMeetup();

    return () => {
      cancelled = true;
    };
  }, [meetupId, token]);

  return (
    <PageContainer style={{ padding: "24px 26px 40px" }}>
      <div style={{ display: "grid", gap: 18 }}>
        <SectionCard
          title="Meetup Details"
          subtitle="This page combines logistics, attendees, and group chat in one place."
          action={
            meetup && user?.id === meetup.createdBy ? (
              <button
                type="button"
                onClick={async () => {
                  if (!token) return;
                  await cancelMeetup(token, meetup.id);
                  setMeetup((current) => (current ? { ...current, status: "cancelled" } : current));
                }}
                style={{
                  borderRadius: 2,
                  border: "1px solid rgba(239,68,68,0.2)",
                  background: "rgba(254,242,242,0.92)",
                  color: "#b91c1c",
                  padding: "10px 14px",
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                Cancel meetup
              </button>
            ) : null
          }
        >
          {loading ? (
            <p style={{ margin: 0, fontSize: 13, color: "#8A8780" }}>Loading meetup...</p>
          ) : error ? (
            <p style={{ margin: 0, fontSize: 13, color: "#b91c1c" }}>{error}</p>
          ) : meetup ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile
                  ? "1fr"
                  : "minmax(0, 1.3fr) minmax(280px, 0.8fr)",
                gap: 18,
              }}
            >
              <div style={{ display: "grid", gap: 18 }}>
                <MeetupCard
                  meetup={meetup}
                  token={token}
                  currentUserId={user?.id}
                  onMeetupUpdated={setMeetup}
                />
                {meetup.linkedPost ? (
                  <SectionCard title="Linked Community Post" subtitle="This meetup was published into the forum feed.">
                    <div style={{ display: "grid", gap: 10 }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: "#1f2b12" }}>
                        {meetup.linkedPost.title}
                      </div>
                      <div style={{ fontSize: 13, color: "#8A8780", lineHeight: 1.6 }}>
                        {meetup.linkedPost.body}
                      </div>
                      <Link
                        href="/community"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          color: "#D44A12",
                          fontSize: 12.5,
                          fontWeight: 800,
                          textDecoration: "none",
                        }}
                      >
                        Back to the community feed
                      </Link>
                    </div>
                  </SectionCard>
                ) : null}
                <SectionCard title="Meetup Chat" subtitle="Polling refreshes every 5 seconds for MVP.">
                  <MeetupChat
                    meetupId={meetup.id}
                    token={token}
                    currentUserId={user?.id}
                    enabled={Boolean(token) && !isGuest && meetup.viewerJoined}
                  />
                </SectionCard>
              </div>

              <div style={{ display: "grid", gap: 18, alignContent: "start" }}>
                <SectionCard title="Attendees" subtitle={`${meetup.joinedCount} volunteer${meetup.joinedCount === 1 ? "" : "s"} joined`}>
                  <div style={{ display: "grid", gap: 10 }}>
                    {(meetup.members ?? []).map((member) => (
                      <div
                        key={`${member.id}-${member.joinedAt}`}
                        style={{
                          borderRadius: 2,
                          background: "#F8F6F0",
                          border: "1px solid rgba(11, 11, 10,0.14)",
                          padding: "12px 14px",
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#1f2b12" }}>
                          {formatDisplayName(member)}
                        </div>
                        <div style={{ fontSize: 11.5, color: "#8A8780", marginTop: 4 }}>
                          {member.role === "creator" ? "Organizer" : "Member"}
                        </div>
                      </div>
                    ))}
                  </div>
                </SectionCard>
                <SectionCard title="Map Shortcut" subtitle="Meetup markers are visible from the resource map layer toggle.">
                  <Link
                    href="/map"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 2,
                      padding: "11px 16px",
                      background: "#D44A12",
                      color: "#1c220e",
                      fontSize: 12.5,
                      fontWeight: 800,
                      textDecoration: "none",
                    }}
                  >
                    Open the map
                  </Link>
                </SectionCard>
              </div>
            </div>
          ) : null}
        </SectionCard>
      </div>
    </PageContainer>
  );
}
