"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import MediaCard from "@/components/catalog/MediaCard";
import { fromAnime, fromTMDB, type CatalogItem } from "@/components/catalog/toCatalogItem";
import type { Anime, PageInfo } from "@/lib/anilist";
import type { TMDBSearchResponse } from "@/lib/tmdb";

export type CatalogMediaType = "movie" | "tv" | "anime";

interface Filters {
  genres?: string;
  tags?: string;
  format?: string;
  year?: string;
  season?: string;
  status?: string;
  sort?: string;
  minDuration?: string;
  maxDuration?: string;
  minEpisodes?: string;
  maxEpisodes?: string;
  search?: string;
}

interface Props {
  mediaType: CatalogMediaType;
  initialItems: CatalogItem[];
  initialHasMore: boolean;
  filters?: Filters;
  genreEntries?: [number, string][];
  query?: string;
  emptyMessage?: string;
}

export default function InfiniteGrid({
  mediaType,
  initialItems,
  initialHasMore,
  filters = {},
  genreEntries,
  query,
  emptyMessage = "No results found.",
}: Props) {
  const [items, setItems] = useState(initialItems);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const genreMap = useMemo(() => (genreEntries ? new Map(genreEntries) : undefined), [genreEntries]);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore) return;
    loadingRef.current = true;
    setLoading(true);
    const nextPage = page + 1;

    try {
      if (query) {
        if (mediaType === "anime") {
          const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&page=${nextPage}&perPage=24`);
          const data: { pageInfo: PageInfo; media: Anime[] } = await res.json();
          setItems((prev) => {
            const seen = new Set(prev.map((p) => `${p.kind}-${p.id}`));
            const newItems = data.media.map(fromAnime).filter((i) => !seen.has(`${i.kind}-${i.id}`));
            return [...prev, ...newItems];
          });
          setHasMore(data.pageInfo?.hasNextPage ?? false);
        } else {
          const res = await fetch(`/api/tmdb-search?query=${encodeURIComponent(query)}&type=${mediaType}&page=${nextPage}`);
          const data: TMDBSearchResponse = await res.json();
          setItems((prev) => {
            const seen = new Set(prev.map((p) => `${p.kind}-${p.id}`));
            const newItems = data.results.map((r) => fromTMDB(r, mediaType, genreMap)).filter((i) => !seen.has(`${i.kind}-${i.id}`));
            return [...prev, ...newItems];
          });
          setHasMore(nextPage < data.total_pages);
        }
        setPage(nextPage);
        loadingRef.current = false;
        setLoading(false);
        return;
      }

      const params = new URLSearchParams({ page: String(nextPage) });
      if (filters.sort) params.set("sort", filters.sort);
      if (filters.year) params.set("year", filters.year);
      if (filters.genres) params.set("genres", filters.genres);
      if (filters.tags) params.set("tags", filters.tags);
      if (filters.format) params.set("format", filters.format);
      if (filters.season) params.set("season", filters.season);
      if (filters.status) params.set("status", filters.status);
      if (filters.minDuration) params.set("minDuration", filters.minDuration);
      if (filters.maxDuration) params.set("maxDuration", filters.maxDuration);
      if (filters.minEpisodes) params.set("minEpisodes", filters.minEpisodes);
      if (filters.maxEpisodes) params.set("maxEpisodes", filters.maxEpisodes);
      if (filters.search) params.set("search", filters.search);

      if (mediaType === "anime") {
        const res = await fetch(`/api/anilist/discover?${params.toString()}`);
        const data: { pageInfo: PageInfo; media: Anime[] } = await res.json();
        setItems((prev) => {
          const seen = new Set(prev.map((p) => `${p.kind}-${p.id}`));
          const newItems = data.media.map(fromAnime).filter((i) => !seen.has(`${i.kind}-${i.id}`));
          return [...prev, ...newItems];
        });
        setHasMore(data.pageInfo?.hasNextPage ?? false);
      } else {
        const path = mediaType === "movie" ? "discover-movie" : "discover-tv";
        const res = await fetch(`/api/tmdb/${path}?${params.toString()}`);
        const data: TMDBSearchResponse = await res.json();
        setItems((prev) => {
          const seen = new Set(prev.map((p) => `${p.kind}-${p.id}`));
          const newItems = data.results.map((r) => fromTMDB(r, mediaType, genreMap)).filter((i) => !seen.has(`${i.kind}-${i.id}`));
          return [...prev, ...newItems];
        });
        setHasMore(nextPage < data.total_pages);
      }
      setPage(nextPage);
    } catch {
      setHasMore(false);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [loading, hasMore, page, filters, mediaType, genreMap, query]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: "600px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  if (items.length === 0) {
    return (
      <p style={{ color: "var(--text-muted)", padding: "40px 0", textAlign: "center" }}>
        {emptyMessage}
      </p>
    );
  }

  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
          gap: 16,
        }}
      >
        {items.map((item) => (
          <MediaCard key={`${item.kind}-${item.id}`} item={item} />
        ))}
      </div>
      {hasMore && (
        <div ref={sentinelRef} style={{ display: "flex", justifyContent: "center", padding: 24 }}>
          <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin" style={{ opacity: loading ? 1 : 0 }} />
        </div>
      )}
    </div>
  );
}
