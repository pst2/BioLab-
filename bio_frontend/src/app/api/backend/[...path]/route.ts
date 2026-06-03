import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ path?: string[] }>;
};

const DEFAULT_BACKEND = "http://127.0.0.1:8000";

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function normalizeBackendUrl(url: string) {
  return url.replace(/\/$/, "");
}

function backendCandidates() {
  const configured =
    process.env.BACKEND_INTERNAL_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    DEFAULT_BACKEND;

  const normalized = normalizeBackendUrl(configured);

  return unique([
    normalized,
    normalized.replace("http://localhost:", "http://127.0.0.1:"),
    normalized.replace("http://127.0.0.1:", "http://localhost:"),
    DEFAULT_BACKEND,
    "http://127.0.0.1:8000",
    "http://localhost:8000",
    "http://host.docker.internal:8000",
  ]);
}

async function proxy(request: NextRequest, context: RouteContext) {
  const { path = [] } = await context.params;
  const pathName = path.join("/");
  const search = request.nextUrl.search;
  const body = ["GET", "HEAD"].includes(request.method)
    ? undefined
    : await request.arrayBuffer();

  let lastError = "Unknown proxy error";
  const tried: string[] = [];

  for (const backend of backendCandidates()) {
    const target = `${backend}/${pathName}${search}`;
    tried.push(target);

    try {
      const headers = new Headers(request.headers);
      headers.delete("host");
      headers.delete("connection");

      const response = await fetch(target, {
        method: request.method,
        headers,
        body,
        cache: "no-store",
      });

      const responseHeaders = new Headers(response.headers);
      responseHeaders.delete("content-encoding");
      responseHeaders.delete("content-length");

      return new NextResponse(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  return NextResponse.json(
    {
      success: false,
      message:
        "Frontend proxy cannot reach the FastAPI backend. Start FastAPI on port 8000, or set BACKEND_INTERNAL_URL to the correct backend URL.",
      detail: lastError,
      tried,
    },
    { status: 502 }
  );
}

export async function GET(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}
