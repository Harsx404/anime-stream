import { NextResponse } from "next/server";
import { getVixSrcSources } from "@/lib/vixsrc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tmdbId = Number(searchParams.get("tmdbId"));
  const mediaType = (searchParams.get("mediaType") || "movie") as "movie" | "tv";
  const season = searchParams.get("season") ? Number(searchParams.get("season")) : undefined;
  const episode = searchParams.get("episode") ? Number(searchParams.get("episode")) : undefined;

  if (!tmdbId) {
    return NextResponse.json({ error: "Missing tmdbId" }, { status: 400 });
  }

  try {
    const result = await getVixSrcSources({ tmdbId, mediaType, season, episode });

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
      { success: false, error: e instanceof Error ? e.message : "Failed to fetch VixSrc sources" },
      { status: 500 }
    );
  }
}
