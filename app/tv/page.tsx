import {
  getTrendingTV,
  getPopularTV,
  getTopRatedTV,
  getTVGenres,
  discoverTV,
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

export default async function TVPage({ searchParams }: Props) {
  const params = await searchParams;
  const { genres, sort, year, search, minDuration, maxDuration } = params;

  const [trending, popular, topRated, tvGenres] = await Promise.all([
    getTrendingTV("week").catch(() => []),
    getPopularTV().catch(() => []),
    getTopRatedTV().catch(() => []),
    getTVGenres().catch(() => []),
  ]);

  const genreMap = new Map(tvGenres.map((g) => [g.id, g.name] as [number, string]));
  const genreEntries: [number, string][] = tvGenres.map((g) => [g.id, g.name]);

  const discoverResult = await discoverTV({
    genres: genres ? genres.split(",").map(Number).filter(Boolean) : undefined,
    sort: (sort as SortKey) || "popularity",
    year: year ? Number(year) : undefined,
    search: search || undefined,
    minDuration: minDuration ? Number(minDuration) : undefined,
    maxDuration: maxDuration ? Number(maxDuration) : undefined,
    page: 1,
  }).catch(() => ({ results: [], total_pages: 0 } as { results: typeof trending; total_pages: number }));

  const heroItems = trending
    .filter((t) => t.backdrop_path)
    .slice(0, 5)
    .map((t) => {
      const title = t.name || t.title || "Untitled";
      const releaseYear = t.first_air_date ? new Date(t.first_air_date).getFullYear() : undefined;
      const genreNames = (t.genre_ids || []).map((id) => genreMap.get(id)).filter(Boolean) as string[];
      return {
        id: t.id,
        title,
        backdropUrl: tmdbImage(t.backdrop_path, "original"),
        overview: t.overview,
        genres: genreNames,
        metaItems: [
          t.vote_average ? `★ ${t.vote_average.toFixed(1)}` : "",
          "TV",
          releaseYear ? String(releaseYear) : "",
        ].filter(Boolean),
        watchHref: `/tv/${t.id}`,
        watchlist: { kind: "tv" as const, id: t.id, title, cover: tmdbImage(t.poster_path, "w342"), href: `/tv/${t.id}` },
      };
    });

  const gridKey = JSON.stringify(params);

  return (
    <div>
      {heroItems.length > 0 && <HeroCarousel items={heroItems} eyebrow="Trending TV Shows" />}

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "0 16px 24px" }}>
        <CarouselRow title="Trending" accentWord="This Week" items={trending.map((t) => fromTMDB(t, "tv", genreMap))} />
        <CarouselRow title="Popular" accentWord="TV Shows" items={popular.map((t) => fromTMDB(t, "tv", genreMap))} />
        <CarouselRow title="Top" accentWord="Rated" items={topRated.map((t) => fromTMDB(t, "tv", genreMap))} />

        <h2 className="section-heading">
          Browse All <span className="accent">TV Shows</span>
        </h2>
        <FilterBar mediaType="tv" />
        <InfiniteGrid
          key={gridKey}
          mediaType="tv"
          initialItems={discoverResult.results.map((t) => fromTMDB(t, "tv", genreMap))}
          initialHasMore={1 < discoverResult.total_pages}
          filters={{ genres, sort, year, search, minDuration, maxDuration }}
          genreEntries={genreEntries}
        />
      </div>
    </div>
  );
}
