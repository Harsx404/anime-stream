import {
  getTrendingMovies,
  getPopularMovies,
  getTopRatedMovies,
  getMovieGenres,
  discoverMovies,
  tmdbImage,
  type SortKey,
} from "@/lib/tmdb";
import HeroCarousel from "@/components/catalog/HeroCarousel";
import CarouselRow from "@/components/catalog/CarouselRow";
import FilterBar from "@/components/catalog/FilterBar";
import InfiniteGrid from "@/components/catalog/InfiniteGrid";
import { fromTMDB } from "@/components/catalog/toCatalogItem";

interface Props {
  searchParams: Promise<{
    genres?: string;
    sort?: string;
    year?: string;
    search?: string;
    minDuration?: string;
    maxDuration?: string;
  }>;
}

export default async function MoviesPage({ searchParams }: Props) {
  const params = await searchParams;
  const { genres, sort, year, search, minDuration, maxDuration } = params;

  const [trending, popular, topRated, movieGenres] = await Promise.all([
    getTrendingMovies("week").catch(() => []),
    getPopularMovies().catch(() => []),
    getTopRatedMovies().catch(() => []),
    getMovieGenres().catch(() => []),
  ]);

  const genreMap = new Map(movieGenres.map((g) => [g.id, g.name] as [number, string]));
  const genreEntries: [number, string][] = movieGenres.map((g) => [g.id, g.name]);

  const discoverResult = await discoverMovies({
    genres: genres ? genres.split(",").map(Number).filter(Boolean) : undefined,
    sort: (sort as SortKey) || "popularity",
    year: year ? Number(year) : undefined,
    search: search || undefined,
    minDuration: minDuration ? Number(minDuration) : undefined,
    maxDuration: maxDuration ? Number(maxDuration) : undefined,
    page: 1,
  }).catch(() => ({ results: [], total_pages: 0 } as { results: typeof trending; total_pages: number }));

  const heroItems = trending
    .filter((m) => m.backdrop_path)
    .slice(0, 5)
    .map((m) => {
      const title = m.title || m.name || "Untitled";
      const releaseYear = m.release_date ? new Date(m.release_date).getFullYear() : undefined;
      const genreNames = (m.genre_ids || []).map((id) => genreMap.get(id)).filter(Boolean) as string[];
      return {
        id: m.id,
        title,
        backdropUrl: tmdbImage(m.backdrop_path, "original"),
        overview: m.overview,
        genres: genreNames,
        metaItems: [
          m.vote_average ? `★ ${m.vote_average.toFixed(1)}` : "",
          "Movie",
          releaseYear ? String(releaseYear) : "",
        ].filter(Boolean),
        watchHref: `/movie/${m.id}`,
        watchlist: { kind: "movie" as const, id: m.id, title, cover: tmdbImage(m.poster_path, "w342"), href: `/movie/${m.id}` },
      };
    });

  const gridKey = JSON.stringify(params);

  return (
    <div>
      {heroItems.length > 0 && <HeroCarousel items={heroItems} eyebrow="Trending Movies" />}

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "0 clamp(12px, 3vw, 16px) 24px" }}>
        <CarouselRow title="Trending" accentWord="This Week" items={trending.map((m) => fromTMDB(m, "movie", genreMap))} />
        <CarouselRow title="Popular" accentWord="Movies" items={popular.map((m) => fromTMDB(m, "movie", genreMap))} />
        <CarouselRow title="Top" accentWord="Rated" items={topRated.map((m) => fromTMDB(m, "movie", genreMap))} />

        <h2 className="section-heading">
          Browse All <span className="accent">Movies</span>
        </h2>
        <FilterBar mediaType="movie" />
        <InfiniteGrid
          key={gridKey}
          mediaType="movie"
          initialItems={discoverResult.results.map((m) => fromTMDB(m, "movie", genreMap))}
          initialHasMore={1 < discoverResult.total_pages}
          filters={{ genres, sort, year, search, minDuration, maxDuration }}
          genreEntries={genreEntries}
        />
      </div>
    </div>
  );
}
