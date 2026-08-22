import { NextResponse } from "next/server";
import { getVideasySubtitles } from "@/lib/videasy";
import { getVixSrcSources } from "@/lib/vixsrc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tmdbId = Number(searchParams.get("tmdbId"));
  const mediaType = (searchParams.get("mediaType") || "movie") as "movie" | "tv";
  const imdbId = searchParams.get("imdbId") || undefined;
  const provider = searchParams.get("provider") || "";
  const season = searchParams.get("season") ? Number(searchParams.get("season")) : undefined;
  const episode = searchParams.get("episode") ? Number(searchParams.get("episode")) : undefined;

  if (!tmdbId) {
    return NextResponse.json({ error: "Missing tmdbId" }, { status: 400 });
  }

  const subtitles: Array<{ url: string; language: string; label: string }> = [];
  const seen = new Set<string>();

  // Source 1: subs.videasy.to (provider-agnostic, timed to original content)
  if (imdbId) {
    try {
      const subs = await getVideasySubtitles(imdbId, mediaType, season, episode);
      for (const s of subs) {
        const key = s.language.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          subtitles.push({ url: s.url, language: s.language, label: s.label || s.display || s.language });
        }
      }
    } catch {
      // subs service may be down
    }
  }

  // Source 2: VixSrc HLS playlist subtitles (only for VixSrc - timed to VixSrc's encode)
  if (subtitles.length === 0 && provider === "VixSrc") {
    try {
      const vix = await getVixSrcSources({ tmdbId, mediaType, season, episode });
      for (const s of vix.subtitles) {
        const key = s.language.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          subtitles.push({ url: s.url, language: s.language, label: s.label || s.language });
        }
      }
    } catch {
      // VixSrc may fail
    }
  }

  return NextResponse.json({ success: true, subtitles });
}
