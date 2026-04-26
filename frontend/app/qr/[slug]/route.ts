import { NextResponse } from "next/server";

function getBackendBaseUrl() {
  const candidates = [
    process.env.API_BASE_URL,
    process.env.BACKEND_URL,
    process.env.NEXT_PUBLIC_API_BASE_URL,
    process.env.NEXT_PUBLIC_API_URL,
  ];

  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) {
      return value.trim().replace(/\/$/, "").replace(/\/api$/, "");
    }
  }

  return "https://track-a-team-2.onrender.com";
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;

  if (!slug) {
    return new NextResponse("QR code not found", { status: 404 });
  }

  const backendBase = getBackendBaseUrl();
  const target = `${backendBase}/qr/${encodeURIComponent(slug)}`;

  return NextResponse.redirect(target, 307);
}
