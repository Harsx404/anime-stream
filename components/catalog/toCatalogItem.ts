import type { Anime } from "@/lib/anilist";
import type { TMDBSearchResult } from "@/lib/tmdb";
import { tmdbImage } from "@/lib/tmdb-client";
import type { MediaKind } from "@/lib/history";

export interface CatalogItem {
  kind: MediaKind;
  id: number;
  title: string;
  poster: string;
  backdrop?: string;
  rating?: number;
  year?: number;
  meta?: string;
  badge?: string;
  href: string;
}

export function fromAnime(anime: Anime): CatalogItem {
  const title = anime.title.english || anime.title.romaji;
  const year = anime.seasonYear || anime.startDate.year;
  const metaParts = [anime.format, year ? String(year) : undefined].filter(Boolean) as string[];

  return {
    kind: "anime",
    id: anime.id,
    title,
    poster: anime.coverImage.large,
    backdrop: anime.bannerImage,
    rating: anime.averageScore ? anime.averageScore / 10 : undefined,
    year,
    meta: metaParts.join(" · "),
    badge: anime.nextAiringEpisode ? `Ep ${anime.nextAiringEpisode.episode} Soon` : undefined,
    href: `/anime/${anime.id}`,
  };
}

export function fromTMDB(
  item: TMDBSearchResult,
  kind: "movie" | "tv",
  genreMap?: Map<number, string>,
): CatalogItem {
  const title = item.title || item.name || "Untitled";
  const dateStr = item.release_date || item.first_air_date;
  const year = dateStr ? new Date(dateStr).getFullYear() : undefined;
  const genreNames = genreMap
    ? (item.genre_ids || []).map((id) => genreMap.get(id)).filter((n): n is string => !!n).slice(0, 2)
    : [];
  const metaParts = [genreNames.join(", "), year ? String(year) : undefined].filter(Boolean) as string[];

  return {
    kind,
    id: item.id,
    title,
    poster: tmdbImage(item.poster_path, "w342"),
    backdrop: tmdbImage(item.backdrop_path, "w780"),
    rating: item.vote_average,
    year,
    meta: metaParts.join(" | "),
    href: kind === "tv" ? `/tv/${item.id}` : `/movie/${item.id}`,
  };
}
