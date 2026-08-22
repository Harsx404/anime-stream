import { NextResponse } from "next/server";
import { getHdgharStreams } from "@/lib/hdghartv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tmdbId = Number(searchParams.get("tmdbId"));
  const mediaType = (searchParams.get("mediaType") || "movie") as "movie" | "tv";
  const title = searchParams.get("title") || undefined;
  const year = searchParams.get("year") ? Number(searchParams.get("year")) : undefined;
  const season = searchParams.get("season") ? Number(searchParams.get("season")) : undefined;
  const episode = searchParams.get("episode") ? Number(searchParams.get("episode")) : undefined;

  if (!tmdbId) {
    return NextResponse.json({ error: "Missing tmdbId" }, { status: 400 });
  }

  try {
    const result = await getHdgharStreams({ tmdbId, mediaType, title, year, season, episode });

    return NextResponse.json({
      success: true,
      data: {
        sources: result.sources,
        subtitles: result.subtitles,
        provider: result.provider,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to fetch HDGharTV sources" },
      { status: 500 },
    );
  }
}
