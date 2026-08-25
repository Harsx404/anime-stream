import { dnsFetch } from "@/lib/dns-fix";

const REST_API = "https://rest.opensubtitles.org";
const V3_API = "https://api.opensubtitles.com/api/v1";
const UA = "AnimeStream v1.0";

async function fetchWithFallback(url: string, init?: RequestInit & { next?: { revalidate?: number } }): Promise<Response> {
  try {
    return await dnsFetch(url, init);
  } catch {
    return await fetch(url, init);
  }
}

export interface OpenSubtitleResult {
  url: string;
  language: string;
  label: string;
  format: string;
  rating?: number;
}

interface RestResult {
  MovieName?: string;
  MovieReleaseName?: string;
  SubFileName?: string;
  SubDownloadLink?: string;
  ISO639?: string;
  LanguageName?: string;
  SubFormat?: string;
  SubRating?: string;
  MatchedBy?: string;
}

function imdbIdToNumber(imdbId: string): number {
  const m = imdbId.match(/tt(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

async function getImdbIdFromTmdb(tmdbId: number, mediaType: string): Promise<string | undefined> {
  try {
    const tmdbKey = process.env.TMDB_API_KEY;
    if (!tmdbKey) return undefined;
    const url = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${tmdbKey}&append_to_response=external_ids`;
    const resp = await fetch(url, { cache: "no-store" });
    if (!resp.ok) return undefined;
    const data = await resp.json();
    return data?.external_ids?.imdb_id || data?.imdb_id || undefined;
  } catch {
    return undefined;
  }
}

export async function searchOpenSubtitles(params: {
  imdbId?: string;
  tmdbId?: number;
  mediaType?: "movie" | "tv";
  season?: number;
  episode?: number;
  language?: string;
}): Promise<OpenSubtitleResult[]> {
  const { imdbId, tmdbId, mediaType = "movie", season, episode, language = "eng" } = params;

  const apiKey = process.env.OPENSUBTITLES_API_KEY;

  if (apiKey) {
    return searchV3({ ...params, apiKey, language });
  }

  // REST API requires imdbId — try to fetch it from TMDB if missing
  let effectiveImdbId = imdbId;
  if (!effectiveImdbId && tmdbId) {
    effectiveImdbId = await getImdbIdFromTmdb(tmdbId, mediaType);
  }

  return searchRest({ imdbId: effectiveImdbId, mediaType, season, episode, language });
}

async function searchRest(params: {
  imdbId?: string;
  mediaType?: string;
  season?: number;
  episode?: number;
  language: string;
}): Promise<OpenSubtitleResult[]> {
  const { imdbId, season, episode, language } = params;
  if (!imdbId) return [];

  const imdbNum = imdbIdToNumber(imdbId);
  if (!imdbNum) return [];

  let path = `/search/sublanguageid-${language}/imdbid-${imdbNum}`;
  if (season && episode) {
    path += `/season-${season}/episode-${episode}`;
  }

  try {
    const resp = await fetchWithFallback(`${REST_API}${path}`, {
      headers: {
        "User-Agent": UA,
        "Accept": "application/json",
      },
      cache: "no-store",
    });

    if (!resp.ok) return [];

    const results: RestResult[] = await resp.json();
    const seen = new Set<string>();
    const out: OpenSubtitleResult[] = [];

    for (const r of results) {
      if (!r.SubDownloadLink || !r.SubFileName) continue;
      const key = `${r.LanguageName}-${r.SubFileName}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        url: r.SubDownloadLink,
        language: r.ISO639 || r.LanguageName?.toLowerCase() || "unknown",
        label: `${r.LanguageName || "Unknown"}${r.MovieReleaseName ? ` (${r.MovieReleaseName})` : ""}`,
        format: r.SubFormat || "srt",
        rating: r.SubRating ? parseFloat(r.SubRating) : undefined,
      });
    }

    return out;
  } catch {
    return [];
  }
}

async function searchV3(params: {
  imdbId?: string;
  tmdbId?: number;
  mediaType?: string;
  season?: number;
  episode?: number;
  language: string;
  apiKey: string;
}): Promise<OpenSubtitleResult[]> {
  const { imdbId, tmdbId, mediaType, season, episode, language, apiKey } = params;

  const query = new URLSearchParams();
  if (imdbId) {
    const num = imdbIdToNumber(imdbId);
    if (num) query.set("imdb_id", String(num));
  }
  if (tmdbId) query.set("tmdb_id", String(tmdbId));
  if (mediaType) query.set("type", mediaType === "tv" ? "episode" : "movie");
  if (season) query.set("season_number", String(season));
  if (episode) query.set("episode_number", String(episode));
  query.set("languages", language);

  try {
    const resp = await fetchWithFallback(`${V3_API}/subtitles?${query.toString()}`, {
      headers: {
        "Api-Key": apiKey,
        "User-Agent": UA,
        "Accept": "application/json",
      },
      cache: "no-store",
    });

    if (!resp.ok) return [];

    const data = await resp.json();
    const items = data?.data || [];
    const seen = new Set<string>();
    const out: OpenSubtitleResult[] = [];

    for (const item of items) {
      const attrs = item?.attributes;
      if (!attrs) continue;
      const files = attrs?.files || [];
      for (const file of files) {
        const fileId = file?.file_id;
        if (!fileId) continue;
        const lang = attrs?.language || "unknown";
        const release = attrs?.release || "";
        const key = `${lang}-${release}-${fileId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({
          url: `${V3_API}/download?file_id=${fileId}`,
          language: lang,
          label: `${attrs?.language || "Unknown"}${release ? ` (${release})` : ""}`,
          format: file?.file_name?.endsWith(".vtt") ? "vtt" : "srt",
          rating: attrs?.ratings ? parseFloat(attrs.ratings) : undefined,
        });
      }
    }

    return out;
  } catch {
    return [];
  }
}

