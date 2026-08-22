// Client-safe subset of tmdb.ts — no server-only imports (dns-fix uses node:dns).
// Import from here in any client component; lib/tmdb.ts re-exports these for server code.

export function tmdbImage(path: string | null | undefined, size: string = "w500"): string {
  if (!path) return "";
  return `/api/tmdb-image?path=/${size}${path}`;
}

export type SortKey = "popularity" | "rating" | "newest" | "title";

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "popularity", label: "Popularity" },
  { value: "rating", label: "Rating" },
  { value: "newest", label: "Newest" },
  { value: "title", label: "Title" },
];
