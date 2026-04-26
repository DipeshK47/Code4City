"use client";

import { useState } from "react";
import type { StopType } from "@/types/tracker";

interface TrackerControlsProps {
  isTracking: boolean;
  isBusy?: boolean;
  onStart: () => void;
  onStop: () => void;
  onAddStop: (type: StopType, label?: string) => void;
  onOpenGoogleMapsRoute?: () => void;
  canOpenGoogleMapsRoute?: boolean;
}

const STOP_OPTIONS: Array<{ value: StopType; label: string }> = [
  { value: "printer", label: "Printer" },
  { value: "cafe", label: "Cafe" },
  { value: "bulletin_board", label: "Bulletin board" },
  { value: "community_center", label: "Community center" },
  { value: "other", label: "Other" },
];

export default function TrackerControls({
  isTracking,
  isBusy = false,
  onStart,
  onStop,
  onAddStop,
  onOpenGoogleMapsRoute,
  canOpenGoogleMapsRoute = false,
}: TrackerControlsProps) {
  const [stopType, setStopType] = useState<StopType>("printer");
  const [label, setLabel] = useState("");
  const disabled = isBusy;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
        <button
          type="button"
          onClick={onStart}
          disabled={isTracking || disabled}
          style={primaryButton(isTracking || disabled)}
        >
          Start Session
        </button>
        <button
          type="button"
          onClick={onStop}
          disabled={!isTracking || disabled}
          style={secondaryButton(!isTracking || disabled)}
        >
          Stop Session
        </button>
      </div>

      <button
        type="button"
        onClick={onOpenGoogleMapsRoute}
        disabled={!canOpenGoogleMapsRoute || disabled}
        style={mapsButton(!canOpenGoogleMapsRoute || disabled)}
      >
        Open Route in Google Maps
      </button>

      <div
        style={{
          borderRadius: 2,
          padding: 18,
          border: "1px solid rgba(11, 11, 10,0.14)",
          background: isTracking
            ? "#F8F6F0"
            : "rgba(255,255,255,0.88)",
          boxShadow: "none",
          display: "grid",
          gap: 12,
        }}
      >
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#0B0B0A", letterSpacing: "0.04em", textTransform: "uppercase" }}>
            Mark Stop
          </p>
          <p style={{ fontSize: 12.5, color: "#8A8780", marginTop: 4 }}>
            Choose a stop type, add an optional label, then pin it to your latest position.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {STOP_OPTIONS.map((option) => {
            const selected = stopType === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setStopType(option.value)}
                disabled={!isTracking || disabled}
                style={stopChip(selected, !isTracking || disabled)}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            disabled={!isTracking || disabled}
            placeholder="Optional label, e.g. FedEx Office"
            style={fieldStyle}
          />
          <button
            type="button"
            disabled={!isTracking || disabled}
            onClick={() => {
              onAddStop(stopType, label);
              setLabel("");
            }}
            style={tertiaryButton(!isTracking || disabled)}
          >
            Add Stop
          </button>
        </div>
      </div>
    </div>
  );
}

const fieldStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 48,
  padding: "12px 14px",
  borderRadius: 2,
  border: "1px solid rgba(11, 11, 10,0.2)",
  background: "#F8F6F0",
  fontSize: 14,
  color: "#0B0B0A",
};

function primaryButton(disabled: boolean): React.CSSProperties {
  return {
    minHeight: 56,
    padding: "14px 18px",
    borderRadius: 2,
    border: "none",
    background: disabled ? "rgba(212, 74, 18,0.32)" : "#D44A12",
    color: "#0B0B0A",
    fontWeight: 700,
    fontSize: 14,
    boxShadow: "none",
    opacity: disabled ? 0.75 : 1,
  };
}

function secondaryButton(disabled: boolean): React.CSSProperties {
  return {
    minHeight: 56,
    padding: "14px 18px",
    borderRadius: 2,
    border: "1px solid rgba(11, 11, 10,0.14)",
    background: disabled ? "rgba(26,18,0,0.08)" : "#f5f3ee",
    color: disabled ? "#a19678" : "#8A8780",
    fontWeight: 700,
    fontSize: 14,
    opacity: disabled ? 0.6 : 1,
  };
}

function tertiaryButton(disabled: boolean): React.CSSProperties {
  return {
    minWidth: 112,
    minHeight: 48,
    padding: "12px 18px",
    borderRadius: 2,
    border: "none",
    background: disabled ? "rgba(223,233,225,0.75)" : "#e8f1ea",
    color: disabled ? "#8f9a92" : "#697567",
    fontWeight: 700,
    fontSize: 14,
    opacity: disabled ? 0.65 : 1,
  };
}

function mapsButton(disabled: boolean): React.CSSProperties {
  return {
    minHeight: 50,
    padding: "12px 16px",
    borderRadius: 2,
    border: "1px solid rgba(66,133,244,0.18)",
    background: disabled ? "rgba(232,239,252,0.72)" : "#eef4ff",
    color: disabled ? "#8ea1c7" : "#2958b8",
    fontWeight: 700,
    fontSize: 14,
    opacity: disabled ? 0.7 : 1,
  };
}

function stopChip(selected: boolean, disabled: boolean): React.CSSProperties {
  return {
    minHeight: 40,
    padding: "9px 14px",
    borderRadius: 2,
    border: selected ? "1px solid rgba(212, 74, 18,0.38)" : "1px solid rgba(11, 11, 10,0.18)",
    background: disabled
      ? "rgba(245,243,238,0.72)"
      : selected
        ? "rgba(212, 74, 18,0.16)"
        : "#F8F6F0",
    color: disabled ? "#b0a487" : selected ? "#8f6d10" : "#1A1917",
    fontSize: 13,
    fontWeight: 600,
  };
}
