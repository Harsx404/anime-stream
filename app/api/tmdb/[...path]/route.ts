import { dnsFetch } from "@/lib/dns-fix";
import { NextResponse } from "next/server";

// TMDB proxy route - injects API key server-side so client never sees it
// Usage: /api/tmdb/movie/popular?page=1  →  api.themoviedb.org/3/movie/popular?api_key=...&page=1

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: pathSegments } = await params;
  const path = "/" + pathSegments.join("/");

  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "TMDB_API_KEY not configured" }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const url = new URL(`https://api.themoviedb.org/3${path}`);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("language", "en-US");

  for (const [key, value] of searchParams.entries()) {
    if (key !== "api_key" && key !== "language") {
      url.searchParams.set(key, value);
    }
  }

  try {
    const resp = await dnsFetch(url.href, {
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });

    if (!resp.ok) {
      const text = await resp.text();
      return NextResponse.json(
        { error: `TMDB error: ${resp.status}` },
        { status: resp.status },
      );
    }

    const data = await resp.json();
    return NextResponse.json(data, {
      headers: {
        "cache-control": "public, max-age=300",
        "access-control-allow-origin": "*",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
