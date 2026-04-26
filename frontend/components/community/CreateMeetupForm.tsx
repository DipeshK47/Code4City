"use client";

import { useEffect, useState } from "react";
import { createMeetup, type CreateMeetupInput } from "@/lib/meetup-api";
import { inputStyle, primaryButtonStyle } from "./CreatePostForm";

type PlaceSuggestion = {
  placeId: string;
  label: string;
  main: string;
  secondary: string;
};

type SelectedPlace = {
  label: string;
  lat: number;
  lng: number;
};

export default function CreateMeetupForm({
  token,
  onCreated,
}: {
  token: string;
  onCreated: (meetupId: number) => Promise<void> | void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<SelectedPlace | null>(null);
  const [maxAttendees, setMaxAttendees] = useState("");
  const [autoCreatePost, setAutoCreatePost] = useState(true);
  const [postTitle, setPostTitle] = useState("");
  const [postBody, setPostBody] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (locationQuery.trim().length < 3 || selectedPlace?.label === locationQuery.trim()) {
      setSuggestions([]);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setIsLoadingPlaces(true);

      try {
        const response = await fetch(
          `/api/autocomplete?input=${encodeURIComponent(locationQuery.trim())}`,
          { signal: controller.signal },
        );
        const payload = (await response.json()) as { suggestions: PlaceSuggestion[] };
        setSuggestions(payload.suggestions ?? []);
      } catch {
        if (!controller.signal.aborted) {
          setSuggestions([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingPlaces(false);
        }
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [locationQuery, selectedPlace?.label]);

  async function selectPlace(suggestion: PlaceSuggestion) {
    setLocationQuery(suggestion.label);
    setSuggestions([]);
    setError(null);

    try {
      const response = await fetch(
        `/api/place?id=${encodeURIComponent(suggestion.placeId)}`,
      );
      const payload = (await response.json()) as {
        lat: number;
        lng: number;
        label: string;
      };

      if (!response.ok) {
        throw new Error("Could not resolve that location.");
      }

      setSelectedPlace({
        label: payload.label,
        lat: payload.lat,
        lng: payload.lng,
      });
      setLocationQuery(payload.label);
    } catch (selectionError) {
      setSelectedPlace(null);
      setError(
        selectionError instanceof Error
          ? selectionError.message
          : "Could not resolve that location.",
      );
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedPlace) {
      setError("Choose a location from the suggestions so the meetup can appear on the map.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const input: CreateMeetupInput = {
        title,
        description,
        locationLabel: selectedPlace.label,
        lat: selectedPlace.lat,
        lng: selectedPlace.lng,
        startTime: new Date(startTime).toISOString(),
        ...(endTime ? { endTime: new Date(endTime).toISOString() } : {}),
        ...(maxAttendees ? { maxAttendees: Number(maxAttendees) } : {}),
        autoCreatePost,
        postTitle,
        postBody,
      };

      const response = await createMeetup(token, input);
      await onCreated(response.data.id);

      setTitle("");
      setDescription("");
      setStartTime("");
      setEndTime("");
      setLocationQuery("");
      setSelectedPlace(null);
      setMaxAttendees("");
      setPostTitle("");
      setPostBody("");
      setAutoCreatePost(true);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Could not create meetup.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Meetup title"
        style={inputStyle}
      />
      <textarea
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        placeholder="What is the plan, who should join, and what should people bring?"
        rows={4}
        style={{ ...inputStyle, resize: "vertical", minHeight: 110 }}
      />
      <div style={{ position: "relative" }}>
        <input
          value={locationQuery}
          onChange={(event) => {
            setLocationQuery(event.target.value);
            setSelectedPlace(null);
          }}
          placeholder="Search for a meetup location"
          style={inputStyle}
        />
        {suggestions.length > 0 ? (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              left: 0,
              right: 0,
              zIndex: 10,
              borderRadius: 16,
              background: "#fffef8",
              border: "1px solid rgba(190,155,70,0.18)",
              boxShadow: "0 18px 32px rgba(31,43,18,0.12)",
              overflow: "hidden",
            }}
          >
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.placeId}
                type="button"
                onClick={() => void selectPlace(suggestion)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "12px 14px",
                  background: "transparent",
                  borderBottom: "1px solid rgba(190,155,70,0.12)",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: "#1f2b12" }}>
                  {suggestion.main}
                </div>
                <div style={{ fontSize: 11.5, color: "#8a7a50", marginTop: 3 }}>
                  {suggestion.secondary || suggestion.label}
                </div>
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {selectedPlace ? (
        <div
          style={{
            borderRadius: 14,
            border: "1px solid rgba(34,197,94,0.18)",
            background: "rgba(236,253,245,0.82)",
            padding: "10px 12px",
            fontSize: 12,
            color: "#166534",
          }}
        >
          Map location locked: {selectedPlace.label}
        </div>
      ) : null}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
        }}
      >
        <label style={{ display: "grid", gap: 6, fontSize: 11.5, color: "#7b6d40" }}>
          Start time
          <input
            type="datetime-local"
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
            style={inputStyle}
          />
        </label>
        <label style={{ display: "grid", gap: 6, fontSize: 11.5, color: "#7b6d40" }}>
          End time
          <input
            type="datetime-local"
            value={endTime}
            onChange={(event) => setEndTime(event.target.value)}
            style={inputStyle}
          />
        </label>
      </div>
      <input
        value={maxAttendees}
        onChange={(event) => setMaxAttendees(event.target.value.replace(/[^\d]/g, ""))}
        placeholder="Optional max attendees"
        style={inputStyle}
      />
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          fontSize: 12.5,
          color: "#5f502d",
        }}
      >
        <input
          type="checkbox"
          checked={autoCreatePost}
          onChange={(event) => setAutoCreatePost(event.target.checked)}
        />
        Auto-create a linked community post for this meetup
      </label>
      {autoCreatePost ? (
        <div
          style={{
            display: "grid",
            gap: 10,
            borderRadius: 16,
            background: "#fffaf0",
            border: "1px solid rgba(190,155,70,0.18)",
            padding: 14,
          }}
        >
          <input
            value={postTitle}
            onChange={(event) => setPostTitle(event.target.value)}
            placeholder="Optional post title override"
            style={inputStyle}
          />
          <textarea
            value={postBody}
            onChange={(event) => setPostBody(event.target.value)}
            placeholder="Optional post copy. Leave blank to generate from the meetup details."
            rows={3}
            style={{ ...inputStyle, resize: "vertical", minHeight: 90 }}
          />
        </div>
      ) : null}
      {error ? (
        <p style={{ margin: 0, fontSize: 12, color: "#b91c1c" }}>{error}</p>
      ) : null}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <p style={{ margin: 0, fontSize: 11.5, color: "#8a7a50", lineHeight: 1.5 }}>
          {isLoadingPlaces
            ? "Searching places..."
            : "Meetups appear in the community feed and on the map layer after creation."}
        </p>
        <button
          type="submit"
          disabled={isSubmitting}
          style={{
            ...primaryButtonStyle,
            opacity: isSubmitting ? 0.72 : 1,
            whiteSpace: "nowrap",
          }}
        >
          {isSubmitting ? "Creating..." : "Create meetup"}
        </button>
      </div>
    </form>
  );
}
