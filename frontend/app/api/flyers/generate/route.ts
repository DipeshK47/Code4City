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

    const copy = await generateCopy({
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
        headline: copy.headline,
        blurb: copy.blurb,
        resources: dominant.resources,
        qrSlug: qrInfo?.slug,
        qrTargetUrl: qrInfo?.targetUrl || `${APP_BASE_URL}/resources/${lat},${lng}`,
        secondaryLanguage: copy.secondaryLanguage,
        secondaryLanguageName: copy.secondaryLanguageName,
        headlineTranslated: copy.headlineTranslated,
        blurbTranslated: copy.blurbTranslated,
        translatedLabels: copy.translatedLabels,
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

type TranslatedLabels = {
  category: string;
  freeLowCost: string;
  closestToYou: string;
  scanForMore: string;
  scanForMoreBlurb: string;
  postedAt: string;
  milesShort: string;
};

type CopyResult = {
  headline: string;
  blurb: string;
  secondaryLanguage: string | null;
  secondaryLanguageName: string | null;
  headlineTranslated: string | null;
  blurbTranslated: string | null;
  translatedLabels: TranslatedLabels | null;
};

async function generateCopy({
  dropName,
  region,
  dominant,
}: {
  dropName: string;
  region: ContextResponse["data"]["region"];
  dominant: ContextDominant;
}): Promise<CopyResult> {
  const fallback = fallbackCopy({ dropName, region, dominant });

  if (!process.env.GEMINI_API_KEY) {
    return fallback;
  }

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-lite",
    });

    const resourceList = dominant.resources
      .map((r, i) => `${i + 1}. ${r.name} — ${r.address} (${r.distance} mi)`)
      .join("\n");

    const regionLabel = region
      ? `${region.regionName}${region.boroughName ? `, ${region.boroughName}` : ""}`
      : "this neighborhood";

    const categoryEnglish = SERVICE_LABELS[dominant.category] || dominant.category;
    const prompt = `You are writing a community-outreach flyer to post at ${dropName} in ${regionLabel} (NYC).

Issue: This area is underserved for ${categoryEnglish}. The closest 4 ${dominant.label.toLowerCase()} resources average ${dominant.averageDistanceMiles} miles away.

Resources listed on flyer:
${resourceList}

Tasks:
1. Write an English headline (6-10 words) and blurb (2 sentences, ≤35 words). Warm, direct, no markdown, no naming the drop location.
2. Identify the most-spoken non-English language among residents of ${regionLabel}. Use ISO 639-1 code (e.g., "es", "zh", "ru", "ar", "bn", "ko", "ht", "fr", "yi", "el", "it", "pl"). If there is no significant non-English population, use "es" (Spanish, NYC's most common second language) as the safe default.
3. Translate the headline and blurb into that language. Translation must be culturally natural, not literal — preserve warmth and brevity.
4. Translate these short flyer labels into the SAME language. Keep them very concise; match the visual brevity of the English originals.
   - category: "${categoryEnglish}"
   - freeLowCost: "Free & low-cost"
   - closestToYou: "Closest to you"
   - scanForMore: "Scan for more"
   - scanForMoreBlurb: "See every nearby resource — food, shelter, healthcare and more."
   - postedAt: "Posted at"
   - milesShort: "mi"

Output STRICT JSON only (no prose, no fences):
{
  "headline": "...",
  "blurb": "...",
  "secondaryLanguage": "es",
  "secondaryLanguageName": "Spanish",
  "headlineTranslated": "...",
  "blurbTranslated": "...",
  "translatedLabels": {
    "category": "...",
    "freeLowCost": "...",
    "closestToYou": "...",
    "scanForMore": "...",
    "scanForMoreBlurb": "...",
    "postedAt": "...",
    "milesShort": "..."
  }
}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
    const parsed = JSON.parse(cleaned);

    if (typeof parsed.headline === "string" && typeof parsed.blurb === "string") {
      const labels = parsed.translatedLabels;
      const translatedLabels: TranslatedLabels | null =
        labels && typeof labels === "object"
          ? {
              category: stringOr(labels.category, ""),
              freeLowCost: stringOr(labels.freeLowCost, ""),
              closestToYou: stringOr(labels.closestToYou, ""),
              scanForMore: stringOr(labels.scanForMore, ""),
              scanForMoreBlurb: stringOr(labels.scanForMoreBlurb, ""),
              postedAt: stringOr(labels.postedAt, ""),
              milesShort: stringOr(labels.milesShort, ""),
            }
          : null;

      return {
        headline: parsed.headline.slice(0, 120),
        blurb: parsed.blurb.slice(0, 320),
        secondaryLanguage:
          typeof parsed.secondaryLanguage === "string"
            ? parsed.secondaryLanguage.slice(0, 8)
            : null,
        secondaryLanguageName:
          typeof parsed.secondaryLanguageName === "string"
            ? parsed.secondaryLanguageName.slice(0, 32)
            : null,
        headlineTranslated:
          typeof parsed.headlineTranslated === "string"
            ? parsed.headlineTranslated.slice(0, 160)
            : null,
        blurbTranslated:
          typeof parsed.blurbTranslated === "string"
            ? parsed.blurbTranslated.slice(0, 400)
            : null,
        translatedLabels,
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
}): CopyResult {
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
    secondaryLanguage: null,
    secondaryLanguageName: null,
    headlineTranslated: null,
    blurbTranslated: null,
    translatedLabels: null,
  };
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
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
