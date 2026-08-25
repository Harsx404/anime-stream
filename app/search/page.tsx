import { searchAnime } from "@/lib/anilist";
import { searchMovies, searchTV, getMovieGenres, getTVGenres } from "@/lib/tmdb";
import InfiniteGrid from "@/components/catalog/InfiniteGrid";
import { fromAnime, fromTMDB, type CatalogItem } from "@/components/catalog/toCatalogItem";

type SearchType = "anime" | "movie" | "tv";

interface Props {
  searchParams: Promise<{ q?: string; type?: string }>;
}

const TABS: { value: SearchType; label: string }[] = [
  { value: "anime", label: "Anime" },
  { value: "movie", label: "Movies" },
  { value: "tv", label: "TV Shows" },
];

export default async function SearchPage({ searchParams }: Props) {
  const { q, type: typeParam } = await searchParams;
  const query = q || "";
  const searchType: SearchType = typeParam === "movie" || typeParam === "tv" ? typeParam : "anime";

  if (!query) {
    return (
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "24px clamp(12px, 3vw, 16px)" }}>
        <p style={{ color: "var(--text-muted)" }}>Enter a search query.</p>
      </div>
    );
  }

  let items: CatalogItem[] = [];
  let hasMore = false;
  let total = 0;
  let genreEntries: [number, string][] | undefined;

  try {
    if (searchType === "anime") {
      const result = await searchAnime(query, 1, 24);
      items = result.media.map(fromAnime);
      hasMore = result.pageInfo.hasNextPage;
      total = result.pageInfo.total;
    } else if (searchType === "movie") {
      const [result, movieGenres] = await Promise.all([searchMovies(query, 1), getMovieGenres().catch(() => [])]);
      genreEntries = movieGenres.map((g) => [g.id, g.name] as [number, string]);
      const genreMap = new Map(genreEntries);
      items = result.results.map((r) => fromTMDB(r, "movie", genreMap));
      hasMore = 1 < result.total_pages;
      total = result.total_results;
    } else {
      const [result, tvGenres] = await Promise.all([searchTV(query, 1), getTVGenres().catch(() => [])]);
      genreEntries = tvGenres.map((g) => [g.id, g.name] as [number, string]);
      const genreMap = new Map(genreEntries);
      items = result.results.map((r) => fromTMDB(r, "tv", genreMap));
      hasMore = 1 < result.total_pages;
      total = result.total_results;
    }
  } catch {
    return (
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "24px clamp(12px, 3vw, 16px)" }}>
        <p style={{ color: "#f87171" }}>Search failed. Try again.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "24px clamp(12px, 3vw, 16px)" }}>
      <h1 className="section-heading" style={{ fontSize: 22 }}>
        Results for &ldquo;{query}&rdquo; <span style={{ color: "var(--text-muted)", fontWeight: 400, fontSize: 15 }}>({total})</span>
      </h1>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {TABS.map((tab) => (
          <a
            key={tab.value}
            href={`/search?type=${tab.value}&q=${encodeURIComponent(query)}`}
            className={`filter-pill${searchType === tab.value ? " is-active" : ""}`}
          >
            {tab.label}
          </a>
        ))}
      </div>

      <InfiniteGrid
        key={`${searchType}-${query}`}
        mediaType={searchType}
        initialItems={items}
        initialHasMore={hasMore}
        query={query}
        genreEntries={genreEntries}
        emptyMessage="No results found."
      />
    </div>
  );
}
