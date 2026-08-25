"use client";

// Re-export from unified use-anime module for backwards compatibility
export {
  useAnimeEpisodes as useMiruroEpisodes,
  useAnimeSources as useMiruroSources,
  type AnimeEpisodeInfo as MiruroEpisode,
  type ProviderInfo,
  type SourceInfo as ClientMiruroSource,
  type SubtitleInfo as ClientMiruroSub,
  type SourcesResult as NormalizedSources,
  type SourceBackend,
  ALL_BACKENDS,
  BACKEND_LABELS,
} from "@/lib/use-anime";
