"use client";

import { useState } from "react";

export default function CreatePostForm({
  onSubmit,
  submitLabel = "Post to community",
  initialTitle = "",
  initialBody = "",
}: {
  onSubmit: (input: { title: string; body: string }) => Promise<void>;
  submitLabel?: string;
  initialTitle?: string;
  initialBody?: string;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit({ title, body });
      setTitle("");
      setBody("");
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Could not create post.",
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
        placeholder="Post title"
        style={inputStyle}
      />
      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="Share an idea, ask for help, or coordinate volunteers nearby."
        rows={5}
        style={{ ...inputStyle, resize: "vertical", minHeight: 120 }}
      />
      {error ? (
        <p style={{ margin: 0, fontSize: 12, color: "#b91c1c" }}>{error}</p>
      ) : null}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <p style={{ margin: 0, fontSize: 11.5, color: "#8a7a50", lineHeight: 1.5 }}>
          Posts can link to meetups, flyer plans, volunteer tips, or neighborhood updates.
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
          {isSubmitting ? "Posting..." : submitLabel}
        </button>
      </div>
    </form>
  );
}

export const inputStyle: React.CSSProperties = {
  width: "100%",
  borderRadius: 10,
  border: "1px solid var(--border-subtle)",
  background: "#fff",
  padding: "12px 14px",
  outline: "none",
  fontSize: 13,
  color: "var(--text-primary)",
};

export const primaryButtonStyle: React.CSSProperties = {
  borderRadius: 8,
  border: "1px solid rgba(245,200,66,0.24)",
  background: "var(--gradient-btn-primary)",
  color: "#ffffff",
  padding: "10px 16px",
  fontSize: 12.5,
  fontWeight: 700,
  boxShadow: "var(--shadow-card)",
};
