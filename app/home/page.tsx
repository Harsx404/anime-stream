import { getTrending, getPopularSeason } from "@/lib/anilist";
import { getPopularMovies, getTopRatedTV, getMovieGenres, getTVGenres } from "@/lib/tmdb";
import ContinueWatching from "@/components/ContinueWatching";
import HeroCarousel from "@/components/catalog/HeroCarousel";
import CarouselRow from "@/components/catalog/CarouselRow";
import { fromAnime, fromTMDB } from "@/components/catalog/toCatalogItem";
import { stripHtml } from "@/lib/text";
import { tmdbImage } from "@/lib/tmdb-client";

export const revalidate = 3600;

export default async function HomePage() {
  const [trending, seasonal, popularMovies, topRatedTV, movieGenres, tvGenres] = await Promise.all([
    getTrending(12).catch(() => []),
    getPopularSeason(12).catch(() => []),
    getPopularMovies().catch(() => []),
    getTopRatedTV().catch(() => []),
    getMovieGenres().catch(() => []),
    getTVGenres().catch(() => []),
  ]);

  const movieGenreMap = new Map(movieGenres.map((g) => [g.id, g.name] as [number, string]));
  const tvGenreMap = new Map(tvGenres.map((g) => [g.id, g.name] as [number, string]));

  const heroAnime = trending
    .filter((a) => a.bannerImage || a.coverImage?.extraLarge || a.coverImage?.large)
    .slice(0, 3)
    .map((anime) => {
      const title = anime.title.english || anime.title.romaji;
      return {
        id: anime.id,
        title,
        backdropUrl: anime.bannerImage || anime.coverImage?.extraLarge || anime.coverImage?.large,
        overview: anime.description ? stripHtml(anime.description) : undefined,
        genres: anime.genres,
        metaItems: [
          anime.averageScore ? `★ ${(anime.averageScore / 10).toFixed(1)}` : "",
          anime.format,
          anime.seasonYear ? String(anime.seasonYear) : "",
        ].filter(Boolean),
        watchHref: `/watch/${anime.id}/1`,
        watchlist: { kind: "anime" as const, id: anime.id, title, cover: anime.coverImage.large, href: `/anime/${anime.id}` },
      };
    });

  const heroMovies = popularMovies
    .filter((m) => m.backdrop_path)
    .slice(0, 2)
    .map((m) => {
      const title = m.title || m.name || "Untitled";
      const year = m.release_date ? new Date(m.release_date).getFullYear() : undefined;
      const genreNames = (m.genre_ids || []).map((id) => movieGenreMap.get(id)).filter(Boolean) as string[];
      return {
        id: m.id,
        title,
        backdropUrl: tmdbImage(m.backdrop_path, "original"),
        overview: m.overview,
        genres: genreNames,
        metaItems: [
          m.vote_average ? `★ ${m.vote_average.toFixed(1)}` : "",
          "Movie",
          year ? String(year) : "",
        ].filter(Boolean),
        watchHref: `/movie/${m.id}`,
        watchlist: { kind: "movie" as const, id: m.id, title, cover: tmdbImage(m.poster_path, "w342"), href: `/movie/${m.id}` },
      };
    });

  const heroTV = topRatedTV
    .filter((t) => t.backdrop_path)
    .slice(0, 2)
    .map((t) => {
      const title = t.name || t.title || "Untitled";
      const year = t.first_air_date ? new Date(t.first_air_date).getFullYear() : undefined;
      const genreNames = (t.genre_ids || []).map((id) => tvGenreMap.get(id)).filter(Boolean) as string[];
      return {
        id: t.id,
        title,
        backdropUrl: tmdbImage(t.backdrop_path, "original"),
        overview: t.overview,
        genres: genreNames,
        metaItems: [
          t.vote_average ? `★ ${t.vote_average.toFixed(1)}` : "",
          "TV",
          year ? String(year) : "",
        ].filter(Boolean),
        watchHref: `/tv/${t.id}`,
        watchlist: { kind: "tv" as const, id: t.id, title, cover: tmdbImage(t.poster_path, "w342"), href: `/tv/${t.id}` },
      };
    });

  const heroItems = [...heroAnime, ...heroMovies, ...heroTV];

  return (
    <div>
      {heroItems.length > 0 && <HeroCarousel items={heroItems} eyebrow="Trending Now" />}

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "0 clamp(12px, 3vw, 16px) 24px" }}>
        <ContinueWatching />
        <CarouselRow
          title="Trending"
          accentWord="Anime"
          items={trending.map(fromAnime)}
          viewMoreHref="/anime"
        />
        <CarouselRow
          title="Popular"
          accentWord="Movies"
          items={popularMovies.map((m) => fromTMDB(m, "movie", movieGenreMap))}
          viewMoreHref="/movies"
        />
        <CarouselRow
          title="Top Rated"
          accentWord="TV Shows"
          items={topRatedTV.map((t) => fromTMDB(t, "tv", tvGenreMap))}
          viewMoreHref="/tv"
        />
        <CarouselRow
          title="Popular"
          accentWord="This Season"
          items={seasonal.map(fromAnime)}
          viewMoreHref="/anime"
        />
      </div>
    </div>
  );
}
