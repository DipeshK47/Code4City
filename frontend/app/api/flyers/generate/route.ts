import { GoogleGenerativeAI } from "@google/generative-ai";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5001";

const APP_BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const SERVICE_LABELS: Record<string, string> = {
  food: "Food",
  shelter: "Shelter",
  healthcare: "Healthcare",
  substance_use: "Recovery",
  mental_health: "Mental Health",
  youth: "Youth services",
  senior: "Senior services",
};

type ContextResource = {
  id: string;
  serviceType: string;
  name: string;
  description: string;
  address: string;
  phone: string;
  hours: string;
  website: string;
  distance: number;
};

type ContextDominant = {
  category: string;
  label: string;
  averageDistanceMiles: number;
  resources: ContextResource[];
};

type ContextResponse = {
  success: boolean;
  message?: string;
  data: {
    region: {
      regionCode: string;
      regionName: string;
      boroughName: string;
      compositeNeedScore: number;
      foodNeedScore: number;
      foodInsecurePercentage: number | null;
    } | null;
    dominant: ContextDominant | null;
    candidates: ContextDominant[];
  };
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { dropName, lat, lng, authToken } = body || {};

    if (!dropName || typeof lat !== "number" || typeof lng !== "number") {
      return jsonError("dropName, lat, and lng required", 400);
    }

    const contextRes = await fetch(
      `${API_BASE_URL}/api/flyers/context?lat=${lat}&lng=${lng}`,
    );
    const contextPayload = (await contextRes.json()) as ContextResponse;

    if (!contextRes.ok || !contextPayload.success || !contextPayload.data.dominant) {
      return jsonError(
        contextPayload.message || "No nearby resources to build a flyer from",
        404,
      );
    }

    const { region, dominant } = contextPayload.data;

    const { headline, blurb } = await generateCopy({
      dropName,
      region,
      dominant,
    });

    const qrInfo = await fetchQrInfo(authToken, lat, lng);

    const saveRes = await fetch(`${API_BASE_URL}/api/flyers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: qrInfo?.userId || null,
        dropName,
        lat,
        lng,
        regionCode: region?.regionCode,
        regionName: region?.regionName,
        dominantCategory: dominant.category,
        headline,
        blurb,
        resources: dominant.resources,
        qrSlug: qrInfo?.slug,
        qrTargetUrl: qrInfo?.targetUrl || `${APP_BASE_URL}/resources/${lat},${lng}`,
      }),
    });

    const savePayload = await saveRes.json();
    if (!saveRes.ok || !savePayload.success) {
      return jsonError(savePayload.message || "Failed to save flyer", 500);
    }

    return Response.json({ success: true, data: savePayload.data });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to generate flyer",
      500,
    );
  }
}

async function generateCopy({
  dropName,
  region,
  dominant,
}: {
  dropName: string;
  region: ContextResponse["data"]["region"];
  dominant: ContextDominant;
}): Promise<{ headline: string; blurb: string }> {
  const fallback = fallbackCopy({ dropName, region, dominant });

  if (!process.env.GEMINI_API_KEY) {
    return fallback;
  }

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-3.1-flash-lite-preview",
    });

    const resourceList = dominant.resources
      .map((r, i) => `${i + 1}. ${r.name} — ${r.address} (${r.distance} mi)`)
      .join("\n");

    const regionLabel = region
      ? `${region.regionName}${region.boroughName ? `, ${region.boroughName}` : ""}`
      : "this neighborhood";

    const prompt = `Write a flyer headline and blurb for a community outreach card to be posted at ${dropName} in ${regionLabel}.

Issue: This area is underserved for ${SERVICE_LABELS[dominant.category] || dominant.category}. The closest 4 ${dominant.label.toLowerCase()} resources average ${dominant.averageDistanceMiles} miles away.

Resources to be listed on the flyer:
${resourceList}

Output strict JSON in this exact shape:
{
  "headline": "<6-10 word headline aimed at someone needing this service>",
  "blurb": "<2 sentences, max 35 words total. Warm and direct. Mention the need and that the listed resources are nearby. Do not name the drop location. Do not use markdown or quotes.>"
}

Return ONLY the JSON object.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
    const parsed = JSON.parse(cleaned);

    if (typeof parsed.headline === "string" && typeof parsed.blurb === "string") {
      return {
        headline: parsed.headline.slice(0, 120),
        blurb: parsed.blurb.slice(0, 320),
      };
    }
  } catch {
    // fall through
  }

  return fallback;
}

function fallbackCopy({
  dropName,
  region,
  dominant,
}: {
  dropName: string;
  region: ContextResponse["data"]["region"];
  dominant: ContextDominant;
}): { headline: string; blurb: string } {
  const label = SERVICE_LABELS[dominant.category] || dominant.category;
  const where = region?.regionName ? ` in ${region.regionName}` : "";
  const headlineByCategory: Record<string, string> = {
    food: "Free meals & groceries near you",
    shelter: "A safe place to stay tonight",
    healthcare: "Free clinics & health support",
    substance_use: "Recovery support, no judgment",
    mental_health: "Mental health help, free & confidential",
    youth: "Youth programs & support",
    senior: "Older adult centers & meals",
  };
  return {
    headline: headlineByCategory[dominant.category] || `${label} support nearby`,
    blurb: `${label} can be hard to find${where}. The four spots listed here are the closest, and they're free or low-cost.`,
  };
}

async function fetchQrInfo(authToken: string | undefined, fallbackLat: number, fallbackLng: number) {
  if (!authToken) {
    return {
      slug: null,
      targetUrl: `${APP_BASE_URL}/resources/${fallbackLat},${fallbackLng}`,
      userId: null,
    };
  }
  try {
    const res = await fetch(`${API_BASE_URL}/api/qr/me`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (!res.ok) {
      return {
        slug: null,
        targetUrl: `${APP_BASE_URL}/resources/${fallbackLat},${fallbackLng}`,
        userId: null,
      };
    }
    const payload = await res.json();
    return {
      slug: payload?.slug || null,
      targetUrl: payload?.targetUrl || `${APP_BASE_URL}/resources/${fallbackLat},${fallbackLng}`,
      userId: payload?.userId || null,
    };
  } catch {
    return {
      slug: null,
      targetUrl: `${APP_BASE_URL}/resources/${fallbackLat},${fallbackLng}`,
      userId: null,
    };
  }
}

function jsonError(message: string, status: number) {
  return Response.json({ success: false, message }, { status });
}
