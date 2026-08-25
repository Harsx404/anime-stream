import { NextResponse } from "next/server";
import { searchOpenSubtitles } from "@/lib/opensubtitles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const imdbId = searchParams.get("imdbId") || undefined;
  const tmdbId = searchParams.get("tmdbId") ? Number(searchParams.get("tmdbId")) : undefined;
  const mediaType = (searchParams.get("mediaType") || "movie") as "movie" | "tv";
  const season = searchParams.get("season") ? Number(searchParams.get("season")) : undefined;
  const episode = searchParams.get("episode") ? Number(searchParams.get("episode")) : undefined;
  const language = searchParams.get("language") || "eng";

  if (!imdbId && !tmdbId) {
    return NextResponse.json({ error: "Missing imdbId or tmdbId" }, { status: 400 });
  }

  try {
    const results = await searchOpenSubtitles({
      imdbId,
      tmdbId,
      mediaType,
      season,
      episode,
      language,
    });

    const subtitles = results.map((r) => ({
      url: r.url,
      language: r.language,
      label: r.label,
    }));

    return NextResponse.json({ success: true, subtitles });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to fetch OpenSubtitles" },
      { status: 502 },
    );
  }
}
