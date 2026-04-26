import { NextRequest, NextResponse } from "next/server";

const KEY = process.env.GOOGLE_MAPS_API_KEY!;

export async function GET(req: NextRequest) {
  const input = req.nextUrl.searchParams.get("input");
  if (!input) return NextResponse.json({ suggestions: [] });

  const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": KEY },
    body: JSON.stringify({ input, includedPrimaryTypes: ["geocode", "establishment"] }),
  });

  const data = await res.json();
  if (!res.ok) return NextResponse.json({ suggestions: [] });

  const suggestions = (data.suggestions ?? []).map((s: {
    placePrediction: { placeId: string; text: { text: string }; structuredFormat: { mainText: { text: string }; secondaryText?: { text: string } } }
  }) => ({
    placeId: s.placePrediction.placeId,
    label: s.placePrediction.text.text,
    main: s.placePrediction.structuredFormat.mainText.text,
    secondary: s.placePrediction.structuredFormat.secondaryText?.text ?? "",
  }));

  return NextResponse.json({ suggestions });
}
