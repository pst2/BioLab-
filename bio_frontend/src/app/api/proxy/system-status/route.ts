// Route Handler: /api/proxy/system-status
//
// Proxies GET requests to the backend /api/v1/system/status and injects the
// X-API-Key header server-side, so the secret key is never sent to the browser.
//
// Environment variable (server-only, no NEXT_PUBLIC_ prefix):
//   API_SECRET_KEY=your-key-here   (set in .env.local)

import { NextResponse } from "next/server";

const BACKEND_URL =
  process.env.BACKEND_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "https://biolab-1kvo.onrender.com";
const API_KEY =
  process.env.API_SECRET_KEY ||
  process.env.API_KEY ||
  process.env.API_KEYS ||
  "biolab2024";

export async function GET() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/system/status`, {
      cache: "no-store",
      headers: { "X-API-Key": API_KEY },
    });

    const body = await res.json();
    return NextResponse.json(body, { status: res.status });
  } catch {
    return NextResponse.json(
      { success: false, message: "Backend unreachable." },
      { status: 503 }
    );
  }
}
