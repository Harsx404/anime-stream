import { dnsFetch } from "@/lib/dns-fix";
export { tmdbImage, SORT_OPTIONS, type SortKey } from "@/lib/tmdb-client";
import type { SortKey } from "@/lib/tmdb-client";
// TMDB API client - server-side, uses TMDB_API_KEY from env
// All client-side calls go through /api/tmdb/[...path] proxy which injects the key
// tmdbImage/SortKey/SORT_OPTIONS live in tmdb-client.ts (no server-only imports) so
// client components can import them without pulling in dns-fix.ts (uses node:dns).

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

function getApiKey(): string {
  const key = process.env.TMDB_API_KEY;
  if (!key) throw new Error("TMDB_API_KEY env var not set");
  return key;
}

async function tmdbFetch<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  const key = getApiKey();
  const url = new URL(`${TMDB_BASE}${path}`);
  url.searchParams.set("api_key", key);
  url.searchParams.set("language", "en-US");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }

  let lastErr: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const resp = await dnsFetch(url.href, { next: { revalidate: 3600 } });
      if (resp.ok) return resp.json() as Promise<T>;
      if (resp.status === 404) throw new Error(`TMDB error: HTTP 404 for ${path}`);
      lastErr = new Error(`TMDB error: HTTP ${resp.status} for ${path}`);
    } catch (e) {
      if (e instanceof Error && e.message.includes("404")) throw e;
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
    if (attempt < 2) await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
  }
  throw lastErr || new Error(`TMDB error: failed after retries for ${path}`);
}

export function getDirector(credits?: TMDBCredits): { name: string; profile_path?: string | null } | null {
  const director = credits?.crew.find((c) => c.job === "Director");
  return director ? { name: director.name, profile_path: director.profile_path } : null;
}

export function getTrailerKey(videos?: TMDBVideos): string | null {
  if (!videos?.results.length) return null;
  const trailers = videos.results.filter((v) => v.site === "YouTube" && v.type === "Trailer");
  const official = trailers.find((v) => v.official);
  return (official || trailers[0])?.key || null;
}

// --- Types ---

export interface TMDBMovie {
  id: number;
  title: string;
  original_title?: string;
  overview?: string;
  poster_path?: string;
  backdrop_path?: string;
  release_date?: string;
  vote_average?: number;
  vote_count?: number;
  genres?: { id: number; name: string }[];
  runtime?: number;
  status?: string;
  tagline?: string;
  imdb_id?: string;
  budget?: number;
  revenue?: number;
  original_language?: string;
  spoken_languages?: { iso_639_1: string; name: string }[];
  production_companies?: { id: number; name: string }[];
  homepage?: string;
  credits?: TMDBCredits;
  videos?: TMDBVideos;
  similar?: TMDBSearchResponse;
}

export interface TMDBCredits {
  crew: { job: string; name: string; profile_path?: string | null }[];
  cast?: { name: string; character?: string; profile_path?: string | null }[];
}

export interface TMDBVideos {
  results: { key: string; site: string; type: string; official?: boolean }[];
}

export interface TMDBTV {
  id: number;
  name: string;
  original_name?: string;
  overview?: string;
  poster_path?: string;
  backdrop_path?: string;
  first_air_date?: string;
  last_air_date?: string;
  vote_average?: number;
  vote_count?: number;
  genres?: { id: number; name: string }[];
  number_of_seasons?: number;
  number_of_episodes?: number;
  status?: string;
  tagline?: string;
  episode_run_time?: number[];
  original_language?: string;
  spoken_languages?: { iso_639_1: string; name: string }[];
  production_companies?: { id: number; name: string }[];
  homepage?: string;
  seasons?: TMDBSeasonSummary[];
  external_ids?: { imdb_id?: string; tvdb_id?: number };
  created_by?: { id: number; name: string; profile_path?: string | null }[];
  credits?: TMDBCredits;
  videos?: TMDBVideos;
  similar?: TMDBSearchResponse;
}

export interface TMDBSeasonSummary {
  id: number;
  name: string;
  season_number: number;
  episode_count: number;
  air_date?: string;
  poster_path?: string;
  overview?: string;
}

export interface TMDBSeason {
  id: number;
  name: string;
  season_number: number;
  air_date?: string;
  poster_path?: string;
  overview?: string;
  episodes: TMDBEpisode[];
}

export interface TMDBEpisode {
  id: number;
  name: string;
  episode_number: number;
  season_number: number;
  overview?: string;
  still_path?: string;
  air_date?: string;
  runtime?: number;
  vote_average?: number;
}

export interface TMDBSearchResult {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string;
  backdrop_path?: string;
  overview?: string;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  media_type?: string;
  genre_ids?: number[];
}

export interface TMDBSearchResponse {
  page: number;
  results: TMDBSearchResult[];
  total_pages: number;
  total_results: number;
}

export interface TMDBTrendingResponse {
  page: number;
  results: TMDBSearchResult[];
  total_pages: number;
  total_results: number;
}

export interface TMDBGenre {
  id: number;
  name: string;
}

export interface DiscoverOptions {
  genres?: number[];
  sort?: SortKey;
  year?: number;
  minRating?: number;
  page?: number;
  search?: string;
  minDuration?: number;
  maxDuration?: number;
}

// --- Movie functions ---

export async function getMovieDetails(id: number): Promise<TMDBMovie> {
  return tmdbFetch<TMDBMovie>(`/movie/${id}`, { append_to_response: "credits,videos,similar,external_ids" });
}

export async function getTrendingMovies(timeWindow: "day" | "week" = "week"): Promise<TMDBSearchResult[]> {
  const data = await tmdbFetch<TMDBTrendingResponse>(`/trending/movie/${timeWindow}`);
  return data.results;
}

export async function getPopularMovies(page = 1): Promise<TMDBSearchResult[]> {
  const data = await tmdbFetch<TMDBSearchResponse>(`/movie/popular`, { page });
  return data.results;
}

export async function getTopRatedMovies(page = 1): Promise<TMDBSearchResult[]> {
  const data = await tmdbFetch<TMDBSearchResponse>(`/movie/top_rated`, { page });
  return data.results;
}

export async function getNowPlayingMovies(page = 1): Promise<TMDBSearchResult[]> {
  const data = await tmdbFetch<TMDBSearchResponse>(`/movie/now_playing`, { page });
  return data.results;
}

export async function getMovieGenres(): Promise<TMDBGenre[]> {
  const data = await tmdbFetch<{ genres: TMDBGenre[] }>(`/genre/movie/list`);
  return data.genres;
}

function movieSortBy(sort: SortKey = "popularity"): string {
  switch (sort) {
    case "rating": return "vote_average.desc";
    case "newest": return "primary_release_date.desc";
    case "title": return "original_title.asc";
    default: return "popularity.desc";
  }
}

export async function discoverMovies(opts: DiscoverOptions = {}): Promise<TMDBSearchResponse> {
  if (opts.search) {
    return tmdbFetch<TMDBSearchResponse>(`/search/movie`, { query: opts.search, page: opts.page || 1, include_adult: "false" });
  }

  const params: Record<string, string | number> = {
    sort_by: movieSortBy(opts.sort),
    page: opts.page || 1,
    include_adult: "false",
  };
  if (opts.genres?.length) params.with_genres = opts.genres.join(",");
  if (opts.year) params.primary_release_year = opts.year;
  if (opts.minRating) params["vote_average.gte"] = opts.minRating;
  if (opts.sort === "rating") params["vote_count.gte"] = 100;
  if (opts.minDuration !== undefined) params["with_runtime.gte"] = opts.minDuration;
  if (opts.maxDuration !== undefined) params["with_runtime.lte"] = opts.maxDuration;
  return tmdbFetch<TMDBSearchResponse>(`/discover/movie`, params);
}

// --- TV functions ---

export async function getTVDetails(id: number): Promise<TMDBTV> {
  return tmdbFetch<TMDBTV>(`/tv/${id}`, { append_to_response: "credits,videos,similar,external_ids" });
}

export async function getTVSeason(tvId: number, seasonNumber: number): Promise<TMDBSeason> {
  return tmdbFetch<TMDBSeason>(`/tv/${tvId}/season/${seasonNumber}`);
}

export async function getTrendingTV(timeWindow: "day" | "week" = "week"): Promise<TMDBSearchResult[]> {
  const data = await tmdbFetch<TMDBTrendingResponse>(`/trending/tv/${timeWindow}`);
  return data.results;
}

export async function getPopularTV(page = 1): Promise<TMDBSearchResult[]> {
  const data = await tmdbFetch<TMDBSearchResponse>(`/tv/popular`, { page });
  return data.results;
}

export async function getTopRatedTV(page = 1): Promise<TMDBSearchResult[]> {
  const data = await tmdbFetch<TMDBSearchResponse>(`/tv/top_rated`, { page });
  return data.results;
}

export async function getTVGenres(): Promise<TMDBGenre[]> {
  const data = await tmdbFetch<{ genres: TMDBGenre[] }>(`/genre/tv/list`);
  return data.genres;
}

function tvSortBy(sort: SortKey = "popularity"): string {
  switch (sort) {
    case "rating": return "vote_average.desc";
    case "newest": return "first_air_date.desc";
    case "title": return "original_name.asc";
    default: return "popularity.desc";
  }
}

export async function discoverTV(opts: DiscoverOptions = {}): Promise<TMDBSearchResponse> {
  if (opts.search) {
    return tmdbFetch<TMDBSearchResponse>(`/search/tv`, { query: opts.search, page: opts.page || 1, include_adult: "false" });
  }

  const params: Record<string, string | number> = {
    sort_by: tvSortBy(opts.sort),
    page: opts.page || 1,
    include_adult: "false",
  };
  if (opts.genres?.length) params.with_genres = opts.genres.join(",");
  if (opts.year) params.first_air_date_year = opts.year;
  if (opts.minRating) params["vote_average.gte"] = opts.minRating;
  if (opts.sort === "rating") params["vote_count.gte"] = 100;
  if (opts.minDuration !== undefined) params["with_runtime.gte"] = opts.minDuration;
  if (opts.maxDuration !== undefined) params["with_runtime.lte"] = opts.maxDuration;
  return tmdbFetch<TMDBSearchResponse>(`/discover/tv`, params);
}

// --- Search ---

export async function searchMovies(query: string, page = 1): Promise<TMDBSearchResponse> {
  return tmdbFetch<TMDBSearchResponse>(`/search/movie`, { query, page, include_adult: "false" });
}

export async function searchTV(query: string, page = 1): Promise<TMDBSearchResponse> {
  return tmdbFetch<TMDBSearchResponse>(`/search/tv`, { query, page, include_adult: "false" });
}

export async function searchMulti(query: string, page = 1): Promise<TMDBSearchResponse> {
  return tmdbFetch<TMDBSearchResponse>(`/search/multi`, { query, page, include_adult: "false" });
}
