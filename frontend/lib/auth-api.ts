const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5001";

export type User = {
  id: number;
  username: string;
  email: string;
  full_name?: string | null;
  agreed_to_terms: boolean;
  created_at: string;
  profile_photo_url?: string | null;
  isGuest?: boolean;
};

export async function signup(
  fullName: string,
  username: string,
  email: string,
  password: string
): Promise<{ user: User; token: string }> {
  const res = await fetch(`${API_BASE}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ full_name: fullName.trim(), username, email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Signup failed");
  return data;
}

export async function login(
  email: string,
  password: string
): Promise<{ user: User; token: string }> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Login failed");
  return data;
}

export async function me(token: string): Promise<{ user: User }> {
  const res = await fetch(`${API_BASE}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Not authenticated");
  return data;
}

export async function agreeToTerms(token: string): Promise<{ user: User }> {
  const res = await fetch(`${API_BASE}/api/auth/agree-terms`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to update");
  return data;
}

export async function uploadProfilePhoto(token: string, imageUrl: string): Promise<{ user: User }> {
  const res = await fetch(`${API_BASE}/api/auth/profile-photo`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ imageUrl }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to upload profile photo");
  return data;
}
