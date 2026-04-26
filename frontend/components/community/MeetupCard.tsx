"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { joinMeetup, leaveMeetup } from "@/lib/meetup-api";
import { formatDateTimeRange } from "@/lib/social-format";
import type { MeetupSummary } from "@/lib/social-types";
import UserIdentity from "./UserIdentity";
import { primaryButtonStyle } from "./CreatePostForm";

export default function MeetupCard({
  meetup,
  token,
  currentUserId,
  onMeetupUpdated,
  compact = false,
}: {
  meetup: MeetupSummary;
  token?: string | null;
  currentUserId?: number | null;
  onMeetupUpdated?: (meetup: MeetupSummary) => void;
  compact?: boolean;
}) {
  const router = useRouter();

  async function handleJoinToggle() {
    if (!token) {
      return;
    }

    const response = meetup.viewerJoined
      ? await leaveMeetup(token, meetup.id)
      : await joinMeetup(token, meetup.id);

    onMeetupUpdated?.(response.data);
  }

  return (
    <div
      className={compact ? "meetup-embed" : "community-soft-card"}
      style={{
        borderRadius: compact ? 10 : 12,
        padding: compact ? "16px 20px" : "18px 18px 16px",
        display: "grid",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "5px 10px",
              borderRadius: 999,
              background: "rgba(74,222,128,0.15)",
              color: "#166534",
              fontSize: 11,
              fontWeight: 800,
              marginBottom: 10,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Meetup
          </div>
          <h3
            style={{
              margin: 0,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: compact ? 18 : 22,
              color: "var(--text-primary)",
              lineHeight: 1.15,
              fontWeight: 800,
            }}
          >
            {meetup.title}
          </h3>
        </div>
        <div
          style={{
            borderRadius: 12,
            background: "rgba(255,255,255,0.78)",
            border: "1px solid rgba(0,0,0,0.06)",
            padding: "10px 12px",
            minWidth: 96,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase" }}>
            Attendees
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#14532d", marginTop: 4 }}>
            {meetup.joinedCount}
          </div>
        </div>
      </div>

      <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
        {meetup.description}
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: compact ? "1fr" : "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 10,
        }}
      >
        {[
          { label: "When", value: formatDateTimeRange(meetup.startTime, meetup.endTime) },
          { label: "Where", value: meetup.locationLabel },
          {
            label: "Capacity",
            value: meetup.maxAttendees ? `${meetup.joinedCount}/${meetup.maxAttendees}` : "Open",
          },
        ].map((item) => (
          <div
            key={item.label}
            style={{
              borderRadius: 10,
              background: "rgba(255,255,255,0.72)",
              border: "1px solid var(--border-subtle)",
              padding: "12px 13px",
            }}
          >
            <div style={{ fontSize: 10.5, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase" }}>
              {item.label}
            </div>
            <div style={{ fontSize: 12.5, color: "var(--text-primary)", marginTop: 5, lineHeight: 1.45 }}>
              {item.value}
            </div>
          </div>
        ))}
      </div>

      <UserIdentity
        user={meetup.creator}
        subtitle={`Organized by @${meetup.creator.username}`}
      />

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        <button
          type="button"
          disabled={!token}
          onClick={() => void handleJoinToggle()}
          style={{
            ...primaryButtonStyle,
            opacity: token ? 1 : 0.55,
            background: meetup.viewerJoined ? "#ffffff" : "linear-gradient(135deg, #22C55E, #16A34A)",
            color: meetup.viewerJoined ? "var(--text-muted)" : "#ffffff",
            border: meetup.viewerJoined
              ? "1px solid var(--border-subtle)"
              : "1px solid rgba(245,200,66,0.24)",
            boxShadow: meetup.viewerJoined ? "none" : "var(--shadow-card)",
          }}
        >
          {meetup.viewerJoined ? "Leave meetup" : "Join meetup"}
        </button>
        <Link
          href={`/community/meetups/${meetup.id}`}
          style={secondaryLinkStyle}
        >
          View meetup
        </Link>
        {meetup.viewerJoined ? (
          <button
            type="button"
            onClick={() => router.push(`/community/meetups/${meetup.id}`)}
            style={secondaryButtonStyle}
          >
            Open chat
          </button>
        ) : null}
        {currentUserId && currentUserId !== meetup.creator.id ? (
          <button
            type="button"
            onClick={() => router.push(`/messages?compose=${meetup.creator.id}`)}
            style={secondaryButtonStyle}
          >
            Message organizer
          </button>
        ) : null}
      </div>
    </div>
  );
}

const secondaryButtonStyle: React.CSSProperties = {
  borderRadius: 6,
  border: "1px solid var(--border-subtle)",
  background: "transparent",
  color: "var(--text-muted)",
  padding: "6px 14px",
  fontSize: 12.5,
  fontWeight: 700,
};

const secondaryLinkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 6,
  border: "1px solid var(--border-subtle)",
  background: "transparent",
  color: "var(--text-muted)",
  padding: "6px 14px",
  fontSize: 12.5,
  fontWeight: 700,
  textDecoration: "none",
};
