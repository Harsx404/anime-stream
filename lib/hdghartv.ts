// HDGharTV stream resolver
// Searches by title, returns direct HLS URLs with quality options including 4K
// Flow: GET /api/search?q={title} → GET /api/movies/public/{id} → streamingLinks

import { fetchTmdbMeta } from "./videasy";

const HD_API = "https://hdghartv.cc/api";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const HEADERS: Record<string, string> = {
  "User-Agent": UA,
  Accept: "application/json, */*",
  Referer: "https://hdghartv.cc/",
};

export interface HdgharSource {
  quality: string;
  url: string;
  type: string;
}

export interface HdgharResult {
  sources: HdgharSource[];
  subtitles: { url: string; language: string; label?: string }[];
  provider: string;
}

const QUALITY_RANK: Record<string, number> = {
  "4K": 0, "2160p": 0, "1080p": 1, "720p": 2, "480p": 3, "360p": 4,
};

async function fetchJson(url: string, timeoutMs = 10000): Promise<any | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { headers: HEADERS, signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function getHdgharStreams(params: {
  tmdbId: number;
  mediaType?: "movie" | "tv";
  title?: string;
  year?: number;
  season?: number;
  episode?: number;
}): Promise<HdgharResult> {
  const { tmdbId, mediaType = "movie", season, episode } = params;
  let { title } = params;

  if (!title) {
    try {
      const meta = await fetchTmdbMeta(mediaType, tmdbId);
      title = meta.title;
    } catch {
      // continue
    }
  }

  if (!title) return { sources: [], subtitles: [], provider: "HDGharTV" };

  const kind = mediaType === "tv" ? "series" : "movie";

  // Search by title
  const searchData = await fetchJson(`${HD_API}/search?q=${encodeURIComponent(title)}`);
  if (!searchData) return { sources: [], subtitles: [], provider: "HDGharTV" };

  const results = kind === "movie" ? searchData.movies : searchData.series;
  if (!results || !Array.isArray(results)) return { sources: [], subtitles: [], provider: "HDGharTV" };

  // Find best match by title (case-insensitive)
  const match =
    results.find((r: any) => r.title?.toLowerCase() === title!.toLowerCase()) ||
    results.find((r: any) => r.title?.toLowerCase().includes(title!.toLowerCase()));

  if (!match) return { sources: [], subtitles: [], provider: "HDGharTV" };

  if (kind === "movie") {
    const movie = await fetchJson(`${HD_API}/movies/public/${match._id}`);
    if (!movie || !movie.streamingLinks) return { sources: [], subtitles: [], provider: "HDGharTV" };

    const sources: HdgharSource[] = (movie.streamingLinks as any[])
      .filter((l) => l.isActive && l.url)
      .sort((a, b) => (QUALITY_RANK[a.quality] ?? 99) - (QUALITY_RANK[b.quality] ?? 99))
      .map((l) => ({
        quality: l.quality,
        url: l.url,
        type: l.url.includes(".m3u8") ? "hls" : "mp4",
      }));

    return { sources, subtitles: [], provider: "HDGharTV" };
  }

  // TV series
  const series = await fetchJson(`${HD_API}/series/public/${match._id}`);
  if (!series || !series.seasons) return { sources: [], subtitles: [], provider: "HDGharTV" };

  const seasonNum = season || 1;
  const episodeNum = episode || 1;
  const seasonData = (series.seasons as any[]).find((s) => s.seasonNumber === seasonNum);
  if (!seasonData || !seasonData.episodes) return { sources: [], subtitles: [], provider: "HDGharTV" };

  const epData = (seasonData.episodes as any[]).find((e) => e.episodeNumber === episodeNum);
  if (!epData || !epData.streamingLinks) return { sources: [], subtitles: [], provider: "HDGharTV" };

  const sources: HdgharSource[] = (epData.streamingLinks as any[])
    .filter((l) => l.isActive && l.url)
    .sort((a, b) => (QUALITY_RANK[a.quality] ?? 99) - (QUALITY_RANK[b.quality] ?? 99))
    .map((l) => ({
      quality: l.quality,
      url: l.url,
      type: l.url.includes(".m3u8") ? "hls" : "mp4",
    }));

  return { sources, subtitles: [], provider: "HDGharTV" };
}
