import { discoverMovies, discoverTV, getMovieGenres, getTVGenres, type SortKey } from "@/lib/tmdb";
import { discoverAnime, type AnimeSortKey } from "@/lib/anilist";
import FilterBar from "@/components/catalog/FilterBar";
import InfiniteGrid from "@/components/catalog/InfiniteGrid";
import { fromTMDB, fromAnime, type CatalogItem } from "@/components/catalog/toCatalogItem";

type CatalogMediaType = "movie" | "tv" | "anime";

interface Props {
  searchParams: Promise<{
    type?: string;
    genres?: string;
    tags?: string;
    format?: string;
    season?: string;
    status?: string;
    sort?: string;
    minDuration?: string;
    maxDuration?: string;
    minEpisodes?: string;
    maxEpisodes?: string;
    search?: string;
    year?: string;
  }>;
}

const TABS: { value: CatalogMediaType; label: string }[] = [
  { value: "movie", label: "Movies" },
  { value: "tv", label: "TV Shows" },
  { value: "anime", label: "Anime" },
];

export default async function BrowsePage({ searchParams }: Props) {
  const params = await searchParams;
  const { type: typeParam, genres, tags, format, season, status, sort, minDuration, maxDuration, minEpisodes, maxEpisodes, search, year } = params;
  const type: CatalogMediaType = typeParam === "tv" || typeParam === "anime" ? typeParam : "movie";

  let initialItems: CatalogItem[] = [];
  let initialHasMore = false;
  let genreEntries: [number, string][] | undefined;

  if (type === "movie") {
    const [genresList, result] = await Promise.all([
      getMovieGenres().catch(() => []),
      discoverMovies({
        genres: genres ? genres.split(",").map(Number).filter(Boolean) : undefined,
        sort: (sort as SortKey) || "popularity",
        year: year ? Number(year) : undefined,
        search: search || undefined,
        minDuration: minDuration ? Number(minDuration) : undefined,
        maxDuration: maxDuration ? Number(maxDuration) : undefined,
        page: 1,
      }).catch(() => ({ results: [], total_pages: 0, total_results: 0, page: 1 })),
    ]);
    genreEntries = genresList.map((g) => [g.id, g.name]);
    const genreMap = new Map(genreEntries);
    initialItems = result.results.map((m) => fromTMDB(m, "movie", genreMap));
    initialHasMore = 1 < result.total_pages;
  } else if (type === "tv") {
    const [genresList, result] = await Promise.all([
      getTVGenres().catch(() => []),
      discoverTV({
        genres: genres ? genres.split(",").map(Number).filter(Boolean) : undefined,
        sort: (sort as SortKey) || "popularity",
        year: year ? Number(year) : undefined,
        search: search || undefined,
        minDuration: minDuration ? Number(minDuration) : undefined,
        maxDuration: maxDuration ? Number(maxDuration) : undefined,
        page: 1,
      }).catch(() => ({ results: [], total_pages: 0, total_results: 0, page: 1 })),
    ]);
    genreEntries = genresList.map((g) => [g.id, g.name]);
    const genreMap = new Map(genreEntries);
    initialItems = result.results.map((t) => fromTMDB(t, "tv", genreMap));
    initialHasMore = 1 < result.total_pages;
  } else {
    const result = await discoverAnime({
      genres: genres ? genres.split(",").filter(Boolean) : undefined,
      tags: tags ? tags.split(",").filter(Boolean) : undefined,
      format: format || undefined,
      season: season || undefined,
      status: status || undefined,
      search: search || undefined,
      minDuration: minDuration ? Number(minDuration) : undefined,
      maxDuration: maxDuration ? Number(maxDuration) : undefined,
      minEpisodes: minEpisodes ? Number(minEpisodes) : undefined,
      maxEpisodes: maxEpisodes ? Number(maxEpisodes) : undefined,
      sort: (sort as AnimeSortKey) || "popularity",
      year: year ? Number(year) : undefined,
      page: 1,
      perPage: 20,
    }).catch(() => ({ pageInfo: { hasNextPage: false, total: 0, currentPage: 1, lastPage: 1, perPage: 20 }, media: [] }));
    initialItems = result.media.map(fromAnime);
    initialHasMore = result.pageInfo?.hasNextPage ?? false;
  }

  const gridKey = JSON.stringify(params);

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "24px 16px" }}>
      <h1 className="section-heading" style={{ fontSize: 24 }}>Browse</h1>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {TABS.map((tab) => (
          <a
            key={tab.value}
            href={`/browse?type=${tab.value}`}
            className={`filter-pill${type === tab.value ? " is-active" : ""}`}
          >
            {tab.label}
          </a>
        ))}
      </div>

      <FilterBar mediaType={type} />
      <InfiniteGrid
        key={gridKey}
        mediaType={type}
        initialItems={initialItems}
        initialHasMore={initialHasMore}
        filters={{
          genres,
          tags,
          format,
          season,
          status,
          sort,
          minDuration,
          maxDuration,
          minEpisodes,
          maxEpisodes,
          search,
          year
        }}
        genreEntries={genreEntries}
      />
    </div>
  );
}
