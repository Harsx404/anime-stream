"use client";

import { useState, useEffect } from "react";

export interface MiruroEpisode {
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

export function useMiruroEpisodes(
  anilistId: number,
  provider?: string,
  category?: "sub" | "dub",
) {
  const [episodes, setEpisodes] = useState<MiruroEpisode[]>([]);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!anilistId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      setEpisodes([]);
      setProviders([]);
      try {
        const params = new URLSearchParams();
        if (provider) params.set("provider", provider);
        if (category) params.set("category", category);
        const qs = params.toString();
        const res = await fetch(`/api/episodes/${anilistId}${qs ? `?${qs}` : ""}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        const data = await res.json();
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
  }, [anilistId, provider, category]);

  return { episodes, providers, loading, error };
}

export interface NormalizedSource {
  url: string;
  quality: string;
  isM3U8: boolean;
  referer?: string;
  type: string;
  default?: boolean;
}

export interface NormalizedSources {
  sources: NormalizedSource[];
  subs: { url: string; lang: string }[];
  download?: { url: string; label?: string }[];
}

export function useMiruroSources(
  episodeId: string,
  anilistId: number,
  provider?: string,
  category?: "sub" | "dub",
) {
  const [sources, setSources] = useState<NormalizedSources | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!episodeId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      setSources(null);
      try {
        const params = new URLSearchParams({ episodeId, anilistId: String(anilistId) });
        if (provider) params.set("provider", provider);
        if (category) params.set("category", category);
        const res = await fetch(`/api/sources?${params.toString()}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        const data: NormalizedSources = await res.json();
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
  }, [episodeId, anilistId, provider, category]);

  return { sources, loading, error };
}
