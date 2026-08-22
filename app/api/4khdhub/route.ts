import { NextResponse } from "next/server";
import { get4khdhubStreams } from "@/lib/hd4khub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tmdbId = Number(searchParams.get("tmdbId"));
  const mediaType = (searchParams.get("mediaType") || "movie") as "movie" | "tv";
  const title = searchParams.get("title") || undefined;
  const year = Number(searchParams.get("year") || 0) || undefined;
  const season = Number(searchParams.get("season") || 1);
  const episode = Number(searchParams.get("episode") || 1);

  if (!tmdbId) {
    return NextResponse.json({ error: "Missing tmdbId" }, { status: 400 });
  }

  try {
    const result = await get4khdhubStreams({ tmdbId, mediaType, title, year, season, episode });
    return NextResponse.json({ success: true, data: result });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
