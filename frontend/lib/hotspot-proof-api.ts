import { API_BASE } from "./api-client";
import type { MapLocation } from "@/components/map/OutreachMapDashboard";

export type ProofRecord = {
  id: string;
  hotspotId: string;
  hotspotName: string | null;
  hotspotAddress: string | null;
  userId: string;
  username: string | null;
  photoUrl: string;
  notes: string;
  submittedAt: string;
  createdAt: string;
  updatedAt: string;
};

type ProofSubmitResponse = {
  success: boolean;
  message?: string;
  data: {
    hotspot: MapLocation;
    proof: ProofRecord;
    usedExistingHotspot?: boolean;
  };
};

type ProofListResponse = {
  success: boolean;
  count: number;
  message?: string;
  data: ProofRecord[];
};

export async function submitHotspotCoverageProof(
  token: string,
  hotspotId: string,
  photo: File,
  notes?: string,
) {
  const imageUrl = await readFileAsDataUrl(photo);

  const response = await fetch(
    `${API_BASE.replace(/\/$/, "")}/api/hotspots/${hotspotId}/coverage-proof`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        imageUrl,
        notes: typeof notes === "string" ? notes.trim() : "",
      }),
    },
  );

  const payload = (await response.json().catch(() => null)) as ProofSubmitResponse | null;

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.message || "Failed to submit coverage proof.");
  }

  return payload.data;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read proof photo."));
    reader.readAsDataURL(file);
  });
}

export async function getHotspotCoverageProofs(token: string, hotspotId: string) {
  const response = await fetch(
    `${API_BASE.replace(/\/$/, "")}/api/hotspots/${hotspotId}/coverage-proofs`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    },
  );

  const payload = (await response.json().catch(() => null)) as ProofListResponse | null;

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.message || "Failed to load hotspot proof history.");
  }

  return payload.data;
}

export async function getMyCoverageProofs(token: string) {
  const response = await fetch(
    `${API_BASE.replace(/\/$/, "")}/api/users/me/coverage-proofs`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    },
  );

  const payload = (await response.json().catch(() => null)) as ProofListResponse | null;

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.message || "Failed to load your hotspot proof history.");
  }

  return payload.data;
}

export async function submitProfileCoverageProof(
  token: string,
  photo: File,
  coordinates: { lat: number; lng: number },
  notes?: string,
) {
  const imageUrl = await readFileAsDataUrl(photo);

  const response = await fetch(
    `${API_BASE.replace(/\/$/, "")}/api/hotspots/profile-coverage-proof`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        imageUrl,
        lat: coordinates.lat,
        lng: coordinates.lng,
        notes: typeof notes === "string" ? notes.trim() : "",
      }),
    },
  );

  const payload = (await response.json().catch(() => null)) as ProofSubmitResponse | null;

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.message || "Failed to submit profile proof.");
  }

  return payload.data;
}
