import { getTrending, getPopularSeason, getAllTimePopular, getTopRated, discoverAnime, type AnimeSortKey } from "@/lib/anilist";
import HeroCarousel from "@/components/catalog/HeroCarousel";
import CarouselRow from "@/components/catalog/CarouselRow";
import FilterBar from "@/components/catalog/FilterBar";
import InfiniteGrid from "@/components/catalog/InfiniteGrid";
import { fromAnime } from "@/components/catalog/toCatalogItem";
import { stripHtml } from "@/lib/text";

export const revalidate = 3600;

interface Props {
  searchParams: Promise<{
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

export default async function AnimeCatalogPage({ searchParams }: Props) {
  const params = await searchParams;
  const { genres, tags, format, season, status, sort, minDuration, maxDuration, minEpisodes, maxEpisodes, search, year } = params;

  const [trending, seasonal, allTime, topRated] = await Promise.all([
    getTrending(12).catch(() => []),
    getPopularSeason(12).catch(() => []),
    getAllTimePopular(12).catch(() => []),
    getTopRated(12).catch(() => []),
  ]);

  const discoverResult = await discoverAnime({
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
  }).catch(() => ({ pageInfo: { hasNextPage: false, total: 0, currentPage: 1, lastPage: 1, perPage: 20 }, media: [] } as any));

  const heroItems = trending
    .filter((a) => a.bannerImage || a.coverImage?.extraLarge || a.coverImage?.large)
    .slice(0, 5)
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

  const gridKey = JSON.stringify(params);

  return (
    <div>
      {heroItems.length > 0 && <HeroCarousel items={heroItems} eyebrow="Trending Now" />}

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "0 clamp(12px, 3vw, 16px) 24px" }}>
        <CarouselRow title="Trending" accentWord="Anime" items={trending.map(fromAnime)} />
        <CarouselRow title="Popular" accentWord="This Season" items={seasonal.map(fromAnime)} />
        <CarouselRow title="All-Time" accentWord="Popular" items={allTime.map(fromAnime)} />
        <CarouselRow title="Top" accentWord="Rated" items={topRated.map(fromAnime)} />

        <h2 className="section-heading">
          Browse All <span className="accent">Anime</span>
        </h2>
        <FilterBar mediaType="anime" />
        <InfiniteGrid
          key={gridKey}
          mediaType="anime"
          initialItems={discoverResult.media.map(fromAnime)}
          initialHasMore={discoverResult.pageInfo?.hasNextPage ?? false}
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
        />
      </div>
    </div>
  );
}
