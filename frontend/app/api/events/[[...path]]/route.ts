import { NextRequest } from "next/server";

const BACKEND_API_BASE =
  process.env.BACKEND_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://127.0.0.1:5001";

function getBackendUrl(req: NextRequest, path: string[] = []) {
  const url = new URL(req.url);
  const backendUrl = new URL(
    `/api/events${path.length ? `/${path.join("/")}` : ""}`,
    BACKEND_API_BASE,
  );

  backendUrl.search = url.search;
  return backendUrl;
}

async function proxyEventsRequest(
  req: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) {
  const { path = [] } = await context.params;
  const backendUrl = getBackendUrl(req, path);
  const headers = new Headers(req.headers);

  headers.delete("host");
  headers.delete("connection");

  const response = await fetch(backendUrl, {
    method: req.method,
    headers,
    body: ["GET", "HEAD"].includes(req.method) ? undefined : await req.text(),
    cache: "no-store",
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: {
      "content-type": response.headers.get("content-type") || "application/json",
    },
  });
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) {
  return proxyEventsRequest(req, context);
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) {
  return proxyEventsRequest(req, context);
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) {
  return proxyEventsRequest(req, context);
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) {
  return proxyEventsRequest(req, context);
}
