// AniList GraphQL client for anime metadata, search, trending

const ANILIST_API = "https://graphql.anilist.co";

const HEADERS = {
  "Content-Type": "application/json",
  "Accept": "application/json",
};

async function anilistQuery<T>(query: string, variables: Record<string, any>): Promise<T> {
  const resp = await fetch(ANILIST_API, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({ query, variables }),
    next: { revalidate: 3600 },
  });

  if (!resp.ok) throw new Error(`AniList error: HTTP ${resp.status}`);
  const json = await resp.json();
  if (json.errors) throw new Error(json.errors[0]?.message || "AniList GraphQL error");
  return json.data as T;
}

// --- Types ---

export interface AnimeTitle {
  romaji: string;
  english: string;
  native: string;
}

export interface AnimeCoverImage {
  medium: string;
  large: string;
  extraLarge: string;
  color: string;
}

export interface AnimeStudio {
  nodes: { name: string; isAnimationStudio: boolean }[];
}

export interface AnimeRelation {
  relationType: string;
  node: {
    id: number;
    title: { romaji: string; english: string };
    coverImage: { large: string };
    format: string;
  };
}

export interface AnimeRecommendation {
  id: number;
  title: { romaji: string; english: string };
  coverImage: { large: string };
  format: string;
}

export interface Anime {
  id: number;
  idMal?: number;
  title: AnimeTitle;
  coverImage: AnimeCoverImage;
  bannerImage?: string;
  description?: string;
  format: string;
  type: string;
  status: string;
  episodes?: number;
  duration?: number;
  genres: string[];
  averageScore?: number;
  season?: string;
  seasonYear?: number;
  startDate: { year?: number; month?: number; day?: number };
  studios: AnimeStudio;
  nextAiringEpisode?: { episode: number; airingAt: number; timeUntilAiring: number };
  relations?: { edges: AnimeRelation[] };
  recommendations?: { nodes: { mediaRecommendation: AnimeRecommendation }[] };
}

export interface PageInfo {
  total: number;
  currentPage: number;
  lastPage: number;
  perPage: number;
  hasNextPage: boolean;
}

export interface PageResult {
  Page: {
    pageInfo: PageInfo;
    media: Anime[];
  };
}

// --- Queries ---

const MEDIA_FIELDS = `
  id idMal
  title { romaji english native }
  coverImage { medium large extraLarge color }
  bannerImage
  description
  format type status
  episodes duration
  genres
  averageScore
  season seasonYear
  startDate { year month day }
  studios { nodes { name isAnimationStudio } }
  nextAiringEpisode { episode airingAt timeUntilAiring }
`;

export async function getAnimeById(id: number): Promise<Anime> {
  const query = `query ($id: Int) { Media(id: $id, type: ANIME) { ${MEDIA_FIELDS} } }`;
  const data = await anilistQuery<{ Media: Anime }>(query, { id });
  return data.Media;
}

const MEDIA_FIELDS_EXTENDED = `
  ${MEDIA_FIELDS}
  relations {
    edges {
      relationType
      node { id title { romaji english } coverImage { large } format }
    }
  }
  recommendations(sort: RATING_DESC, perPage: 10) {
    nodes {
      mediaRecommendation { id title { romaji english } coverImage { large } format }
    }
  }
`;

export async function getAnimeByIdDetailed(id: number): Promise<Anime> {
  const query = `query ($id: Int) { Media(id: $id, type: ANIME) { ${MEDIA_FIELDS_EXTENDED} } }`;
  const data = await anilistQuery<{ Media: Anime }>(query, { id });
  return data.Media;
}

export async function searchAnime(
  search: string,
  page = 1,
  perPage = 20,
): Promise<{ pageInfo: PageInfo; media: Anime[] }> {
  const query = `query ($search: String, $page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      pageInfo { total currentPage lastPage perPage hasNextPage }
      media(search: $search, type: ANIME, sort: SEARCH_MATCH) { ${MEDIA_FIELDS} }
    }
  }`;
  const data = await anilistQuery<PageResult>(query, { search, page, perPage });
  return data.Page;
}

export async function getTrending(perPage = 12): Promise<Anime[]> {
  const query = `query ($perPage: Int) {
    Page(page: 1, perPage: $perPage) {
      media(type: ANIME, sort: TRENDING_DESC) { ${MEDIA_FIELDS} }
    }
  }`;
  const data = await anilistQuery<{ Page: { media: Anime[] } }>(query, { perPage });
  return data.Page.media;
}

export async function getPopularSeason(perPage = 12): Promise<Anime[]> {
  const now = new Date();
  const month = now.getMonth() + 1;
  const season = month <= 3 ? "WINTER" : month <= 6 ? "SPRING" : month <= 9 ? "SUMMER" : "FALL";
  const year = now.getFullYear();

  const query = `query ($season: MediaSeason, $year: Int, $perPage: Int) {
    Page(page: 1, perPage: $perPage) {
      media(type: ANIME, season: $season, seasonYear: $year, sort: POPULARITY_DESC) { ${MEDIA_FIELDS} }
    }
  }`;
  const data = await anilistQuery<{ Page: { media: Anime[] } }>(query, { season, year, perPage });
  return data.Page.media;
}

export async function getAllTimePopular(perPage = 12): Promise<Anime[]> {
  const query = `query ($perPage: Int) {
    Page(page: 1, perPage: $perPage) {
      media(type: ANIME, sort: POPULARITY_DESC) { ${MEDIA_FIELDS} }
    }
  }`;
  const data = await anilistQuery<{ Page: { media: Anime[] } }>(query, { perPage });
  return data.Page.media;
}

export async function getTopRated(perPage = 12): Promise<Anime[]> {
  const query = `query ($perPage: Int) {
    Page(page: 1, perPage: $perPage) {
      media(type: ANIME, sort: SCORE_DESC) { ${MEDIA_FIELDS} }
    }
  }`;
  const data = await anilistQuery<{ Page: { media: Anime[] } }>(query, { perPage });
  return data.Page.media;
}

export async function getAnimeGenres(): Promise<string[]> {
  const query = `query { GenreCollection }`;
  const data = await anilistQuery<{ GenreCollection: string[] }>(query, {});
  return data.GenreCollection;
}

export async function getAnimeTags(): Promise<{ name: string }[]> {
  const query = `query { MediaTagCollection { name } }`;
  const data = await anilistQuery<{ MediaTagCollection: { name: string }[] }>(query, {});
  // Return top 50 tags
  return data.MediaTagCollection.slice(0, 50);
}

export type AnimeSortKey = "popularity" | "rating" | "newest" | "title";

function anilistSort(sort: AnimeSortKey = "popularity"): string {
  switch (sort) {
    case "rating": return "SCORE_DESC";
    case "newest": return "START_DATE_DESC";
    case "title": return "TITLE_ROMAJI";
    default: return "POPULARITY_DESC";
  }
}

export interface DiscoverAnimeOptions {
  genres?: string[];
  tags?: string[];
  format?: string;
  season?: string;
  status?: string;
  minEpisodes?: number;
  maxEpisodes?: number;
  minDuration?: number;
  maxDuration?: number;
  search?: string;
  sort?: AnimeSortKey;
  year?: number;
  page?: number;
  perPage?: number;
}

export async function discoverAnime(
  opts: DiscoverAnimeOptions = {},
): Promise<{ pageInfo: PageInfo; media: Anime[] }> {
  const { genres, tags, format, season, status, minEpisodes, maxEpisodes, minDuration, maxDuration, search, year, page = 1, perPage = 20 } = opts;
  const sort = anilistSort(opts.sort);
  const query = `query ($search: String, $genres: [String], $tags: [String], $year: Int, $season: MediaSeason, $format: MediaFormat, $status: MediaStatus, $minEpisodes: Int, $maxEpisodes: Int, $minDuration: Int, $maxDuration: Int, $page: Int, $perPage: Int, $sort: [MediaSort]) {
    Page(page: $page, perPage: $perPage) {
      pageInfo { total currentPage lastPage perPage hasNextPage }
      media(type: ANIME, search: $search, genre_in: $genres, tag_in: $tags, seasonYear: $year, season: $season, format: $format, status: $status, episodes_greater: $minEpisodes, episodes_lesser: $maxEpisodes, duration_greater: $minDuration, duration_lesser: $maxDuration, sort: $sort) { ${MEDIA_FIELDS} }
    }
  }`;
  const data = await anilistQuery<PageResult>(query, {
    search: search || undefined,
    genres: genres?.length ? genres : undefined,
    tags: tags?.length ? tags : undefined,
    year,
    season: season || undefined,
    format: format || undefined,
    status: status || undefined,
    minEpisodes: minEpisodes || undefined,
    maxEpisodes: maxEpisodes || undefined,
    minDuration: minDuration || undefined,
    maxDuration: maxDuration || undefined,
    page,
    perPage,
    sort: [sort],
  });
  return data.Page;
}
