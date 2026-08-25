import { NextResponse } from "next/server";
import { getVidLinkSources } from "@/lib/vidlink";
import { getVixSrcSources } from "@/lib/vixsrc";
import { searchOpenSubtitles } from "@/lib/opensubtitles";

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

  // Source 1: VidLink (provider-agnostic, timed to original content)
  try {
    const vidlink = await getVidLinkSources({ tmdbId, mediaType, season, episode });
    for (const s of vidlink.subtitles) {
      const key = s.language.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        subtitles.push({ url: s.url, language: s.language, label: s.label || s.language });
      }
    }
  } catch {
    // VidLink may fail
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

  // Source 3: OpenSubtitles (always try as fallback — tmdbId is enough to auto-fetch imdbId)
  if (subtitles.length === 0) {
    try {
      const osResults = await searchOpenSubtitles({
        imdbId,
        tmdbId,
        mediaType,
        season,
        episode,
        language: "eng",
      });
      for (const s of osResults) {
        const key = s.language.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          subtitles.push({ url: s.url, language: s.language, label: s.label });
        }
      }
    } catch {
      // OpenSubtitles may fail
    }
  }

  return NextResponse.json({ success: true, subtitles });
}
