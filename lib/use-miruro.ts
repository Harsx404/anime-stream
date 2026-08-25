"use client";

import { useState, useEffect } from "react";
import {
  fetchMiruroEpisodes,
  fetchMiruroSources,
  type ClientMiruroEpisode,
  type ClientProviderInfo,
  type ClientMiruroSource,
  type ClientMiruroSub,
} from "@/lib/miruro-client";

export type MiruroEpisode = ClientMiruroEpisode;
export type ProviderInfo = ClientProviderInfo;

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
        const data = await fetchMiruroEpisodes(anilistId, provider, category);
        if (cancelled) return;
        setEpisodes(data.episodes);
        setProviders(data.providers);
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

export interface NormalizedSource extends ClientMiruroSource {}
export interface NormalizedSources {
  sources: ClientMiruroSource[];
  subs: ClientMiruroSub[];
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
        const data = await fetchMiruroSources(
          episodeId,
          provider || "",
          category || "sub",
          anilistId,
        );
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
