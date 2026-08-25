"use client";

import { useState, useEffect, useRef } from "react";

// --- Shared types (unified across all backends) ---

export interface AnimeEpisodeInfo {
  id: string;
  number: number;
  title?: string;
  image?: string;
  description?: string;
  filler?: boolean;
  hasDub?: boolean;
  duration?: number;
  airDate?: string;
}

export interface ProviderInfo {
  name: string;
  hasSub: boolean;
  hasDub: boolean;
  episodeCount: number;
  subCount: number;
  dubCount: number;
}

export interface SourceInfo {
  url: string;
  quality: string;
  isM3U8: boolean;
  referer?: string;
  type: string;
  default?: boolean;
}

export interface SubtitleInfo {
  url: string;
  lang: string;
}

export interface SourcesResult {
  sources: SourceInfo[];
  subs: SubtitleInfo[];
  download?: { url: string; label?: string }[];
}

// --- Source backend type ---

export type SourceBackend = "miruro" | "2dhive" | "animegg";

export const ALL_BACKENDS: SourceBackend[] = ["miruro", "2dhive", "animegg"];

export const BACKEND_LABELS: Record<SourceBackend, string> = {
  miruro: "Miruro",
  "2dhive": "2DHive",
  animegg: "AnimeGG",
};

// --- Episodes hook ---

export function useAnimeEpisodes(
  anilistId: number,
  backend: SourceBackend,
  provider?: string,
  category?: "sub" | "dub",
) {
  const [episodes, setEpisodes] = useState<AnimeEpisodeInfo[]>([]);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Sync reset: clear state immediately when deps change, before async fetch
  const depsKey = `${anilistId}-${backend}-${provider ?? ""}-${category ?? ""}`;
  const lastDepsKey = useRef(depsKey);
  if (lastDepsKey.current !== depsKey) {
    lastDepsKey.current = depsKey;
    setEpisodes([]);
    setProviders([]);
    setLoading(true);
    setError("");
  }

  useEffect(() => {
    if (!anilistId) return;
    let cancelled = false;

    async function load() {
      try {
        let data: { episodes: AnimeEpisodeInfo[]; providers: ProviderInfo[] };

        if (backend === "miruro") {
          // Use server-side API route (wreq-js bypasses Cloudflare)
          const params = new URLSearchParams();
          if (provider) params.set("provider", provider);
          if (category) params.set("category", category);
          const qs = params.toString();
          const url = `/api/episodes/${anilistId}${qs ? `?${qs}` : ""}`;
          const resp = await fetch(url);
          if (!resp.ok) {
            const err = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
            throw new Error(err.error || `Failed to load episodes`);
          }
          data = await resp.json();
        } else {
          // Use anime-providers API route (2dhive / animegg)
          const params = new URLSearchParams();
          params.set("provider", backend);
          const resp = await fetch(`/api/anime-episodes/${anilistId}?${params}`);
          if (!resp.ok) {
            const err = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
            throw new Error(err.error || `Failed to load episodes`);
          }
          data = await resp.json();
        }

        if (cancelled) return;
        setEpisodes(data.episodes || []);
        setProviders(data.providers || []);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load episodes");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [anilistId, backend, provider ?? "", category ?? ""]);

  return { episodes, providers, loading, error };
}

// --- Sources hook ---

export function useAnimeSources(
  episodeId: string,
  anilistId: number,
  backend: SourceBackend,
  provider?: string,
  category?: "sub" | "dub",
  episodeNum?: number,
) {
  const [sources, setSources] = useState<SourcesResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Sync reset: clear state immediately when deps change
  const srcDepsKey = `${episodeId}-${backend}-${provider ?? ""}-${category ?? ""}-${episodeNum ?? 0}`;
  const lastSrcDepsKey = useRef(srcDepsKey);
  if (lastSrcDepsKey.current !== srcDepsKey) {
    lastSrcDepsKey.current = srcDepsKey;
    setSources(null);
    setLoading(true);
    setError("");
  }

  useEffect(() => {
    if (!episodeId) return;
    let cancelled = false;

    async function load() {
      try {
        let data: SourcesResult;

        if (backend === "miruro") {
          // Use server-side API route (wreq-js)
          const params = new URLSearchParams();
          params.set("episodeId", episodeId);
          params.set("anilistId", String(anilistId));
          if (provider) params.set("provider", provider);
          if (category) params.set("category", category);
          if (episodeNum) params.set("episodeNum", String(episodeNum));
          const resp = await fetch(`/api/sources?${params}`);
          if (!resp.ok) {
            const err = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
            throw new Error(err.error || `Failed to load sources`);
          }
          data = await resp.json();
        } else {
          // Use anime-providers API route (2dhive / animegg)
          const params = new URLSearchParams();
          params.set("provider", backend);
          params.set("anilistId", String(anilistId));
          params.set("episode", String(episodeNum || 1));
          params.set("category", category || "sub");
          const resp = await fetch(`/api/anime-sources?${params}`);
          if (!resp.ok) {
            const err = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
            throw new Error(err.error || `Failed to load sources`);
          }
          data = await resp.json();
        }

        if (cancelled) return;
        setSources(data);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load sources");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [episodeId, anilistId, backend, provider ?? "", category ?? "", episodeNum ?? 0]);

  return { sources, loading, error };
}

// --- Backwards-compatible exports ---

export type MiruroEpisode = AnimeEpisodeInfo;
