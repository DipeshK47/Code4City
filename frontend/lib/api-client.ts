const PUBLIC_API_FALLBACK = "https://track-a-team-2.onrender.com";

function getFallbackApiBase() {
  if (typeof window !== "undefined") {
    const isLocalHost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";

    if (isLocalHost) {
      return "http://localhost:5001";
    }
  }

  return PUBLIC_API_FALLBACK;
}

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  getFallbackApiBase();

type ApiFetchOptions = {
  token?: string | null;
  method?: string;
  body?: unknown;
};

export async function apiFetch<T>(
  path: string,
  { token, method = "GET", body }: ApiFetchOptions = {},
): Promise<T> {
  const response = await fetch(`${API_BASE.replace(/\/$/, "")}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      payload?.message || payload?.error || "Request failed.",
    );
  }

  return payload as T;
}
