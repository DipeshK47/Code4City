import { NextRequest, NextResponse } from "next/server";

const KEY = process.env.GOOGLE_MAPS_API_KEY!;

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const res = await fetch(`https://places.googleapis.com/v1/places/${id}`, {
    headers: {
      "X-Goog-Api-Key": KEY,
      "X-Goog-FieldMask": "location,displayName,formattedAddress",
    },
  });

  const data = await res.json();
  if (!res.ok) return NextResponse.json({ error: data.error?.message }, { status: 500 });

  return NextResponse.json({
    lat: data.location.latitude,
    lng: data.location.longitude,
    label: data.displayName?.text ?? data.formattedAddress,
  });
}
