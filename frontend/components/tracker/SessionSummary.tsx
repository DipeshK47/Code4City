import Image from "next/image";
import SectionCard from "@/components/common/SectionCard";
import SessionRoutePreview from "@/components/tracker/SessionRoutePreview";
import { formatDistance } from "@/lib/distance";
import { formatDuration, formatStopType } from "@/lib/session";
import type { VolunteerSession } from "@/types/tracker";

interface SessionSummaryProps {
  session: VolunteerSession | null;
  saveState?: "idle" | "saving" | "saved" | "error";
  saveError?: string | null;
}

export default function SessionSummary({
  session,
  saveState = "idle",
  saveError = null,
}: SessionSummaryProps) {
  if (!session) {
    return (
      <SectionCard title="Session Summary" subtitle="Complete a route to review it here.">
        <p style={{ fontSize: 13, color: "#8a7a50", lineHeight: 1.6 }}>
          Start a session to begin recording GPS points, then stop it to see the route summary and save it to the backend.
        </p>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Session Summary" subtitle="Captured route details for the latest volunteer session.">
      <div style={{ marginBottom: 16 }}>
        <SessionRoutePreview session={session} height={260} />
      </div>

      {session.routeImageUrl ? (
        <div
          style={{
            marginBottom: 16,
            borderRadius: 18,
            overflow: "hidden",
            border: "1px solid rgba(190,155,70,0.16)",
            background: "#f7f3df",
          }}
        >
          <Image
            src={session.routeImageUrl}
            alt="Saved route snapshot"
            width={1200}
            height={700}
            unoptimized
            style={{ display: "block", width: "100%", maxHeight: 200, objectFit: "cover" }}
          />
        </div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        <SummaryItem label="Start time" value={new Date(session.startTime).toLocaleString()} />
        <SummaryItem label="End time" value={session.endTime ? new Date(session.endTime).toLocaleString() : "In progress"} />
        <SummaryItem label="Duration" value={formatDuration(session.durationSeconds)} />
        <SummaryItem label="Distance" value={formatDistance(session.totalDistanceMeters)} />
        <SummaryItem label="Route points" value={session.routePoints.length.toString()} />
        <SummaryItem label="Stops" value={session.stops.length.toString()} />
      </div>

      <div style={{ marginTop: 18 }}>
        <p
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "#7a5a10",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: 10,
          }}
        >
          Stops Made
        </p>
        {session.stops.length === 0 ? (
          <p style={{ fontSize: 13, color: "#8a7a50" }}>No stops were recorded for this session.</p>
        ) : (
          <div style={{ display: "grid", gap: 8, maxHeight: 220, overflowY: "auto", paddingRight: 4 }}>
            {session.stops.map((stop) => (
              <div
                key={stop.id}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  background: "#fffaf0",
                  border: "1px solid rgba(190,155,70,0.14)",
                }}
              >
                <p style={{ fontSize: 13, fontWeight: 600, color: "#1a1600" }}>
                  {[formatStopType(stop.type), stop.label].filter(Boolean).join(" | ")}
                </p>
                <p style={{ fontSize: 12, color: "#8a7a50", marginTop: 3 }}>
                  {`${new Date(stop.timestamp).toLocaleTimeString()} | ${stop.lat.toFixed(5)}, ${stop.lng.toFixed(5)}`}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: 18, fontSize: 12.5, color: saveState === "error" ? "#b91c1c" : "#8a7a50" }}>
        {saveState === "saving" && "Saving session to backend..."}
        {saveState === "saved" && "Session saved to backend."}
        {saveState === "error" && (saveError ?? "Saving failed.")}
      </div>
    </SectionCard>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: 12,
        background: "#fffdf5",
        border: "1px solid rgba(190,155,70,0.14)",
      }}
    >
      <p
        style={{
          fontSize: 11,
          color: "#9a8a60",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginBottom: 6,
        }}
      >
        {label}
      </p>
      <p style={{ fontSize: 14, fontWeight: 600, color: "#1a1600", lineHeight: 1.4 }}>{value}</p>
    </div>
  );
}
