"use client";

import { useState, useMemo } from "react";
import type { Anime } from "@/lib/anilist";
import { useAnimeEpisodes, type MiruroEpisode, type SourceBackend, ALL_BACKENDS, BACKEND_LABELS } from "@/lib/use-anime";
import VideoPlayer from "@/components/VideoPlayer";
import EpisodeSidebar from "@/components/watch/EpisodeSidebar";
import ServerSelector from "@/components/watch/ServerSelector";
import WatchActionRow from "@/components/watch/WatchActionRow";
import AnimeInfoCard from "@/components/watch/AnimeInfoCard";
import RelatedAnimeRail from "@/components/watch/RelatedAnimeRail";
import RecommendationsRail from "@/components/watch/RecommendationsRail";
import SeasonsGrid from "@/components/watch/SeasonsGrid";
import { Mic, Captions } from "lucide-react";

interface Props {
  anilistId: number;
  episode: number;
  anime: Anime;
}

export default function WatchClient({ anilistId, episode, anime }: Props) {
  const [selectedBackend, setSelectedBackend] = useState<SourceBackend>("miruro");
  const [selectedProvider, setSelectedProvider] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<"sub" | "dub">("sub");
  const [isTheater, setIsTheater] = useState(false);

  function handleBackendChange(backend: SourceBackend) {
    setSelectedBackend(backend);
    setSelectedProvider("");
  }

  const effectiveProvider = selectedProvider || undefined;
  const effectiveCategory = selectedCategory;

  const { episodes, providers, loading, error } = useAnimeEpisodes(
    anilistId,
    selectedBackend,
    effectiveProvider,
    effectiveCategory,
  );

  const currentEp: MiruroEpisode | undefined = useMemo(
    () => episodes.find((e) => e.number === episode),
    [episodes, episode],
  );

  const nextEp = episodes.find((e) => e.number === episode + 1);
  const episodeId = currentEp?.id || "";
  const totalEps = episodes.length || anime.episodes || 1;

  const showServerSelector = providers.length > 1 || ALL_BACKENDS.length > 1;

  const title = anime.title.english || anime.title.romaji;
  const episodeLabel = `Episode ${episode}${currentEp?.title ? ` - ${currentEp.title}` : ""}`;
  
  // Find currently selected provider stats
  const currentProviderStats = providers.find((p) => p.name === effectiveProvider);
  const subCount = currentProviderStats?.subCount || 0;
  const dubCount = currentProviderStats?.dubCount || 0;

  if (loading) {
    return (
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "16px" }}>
        <div className="relative w-full rounded-xl overflow-hidden" style={{ background: "#000", aspectRatio: "16/9", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
        <p style={{ color: "var(--text-muted)", marginTop: 16 }}>Loading episodes...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "64px 16px", textAlign: "center" }}>
        <p style={{ fontSize: 18, color: "#f87171", marginBottom: 8 }}>Failed to load episodes: {error}</p>
        <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 16 }}>
          Try a different source below.
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 24 }}>
          {ALL_BACKENDS.map((b) => (
            <button
              key={b}
              className={`server-tab${selectedBackend === b ? " is-active" : ""}`}
              onClick={() => handleBackendChange(b)}
            >
              {BACKEND_LABELS[b]}
            </button>
          ))}
        </div>
        <a href={`/anime/${anilistId}`} style={{ color: "#fff", textDecoration: "underline" }}>← Back to anime page</a>
      </div>
    );
  }

  if (!episodeId) {
    return (
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "64px 16px", textAlign: "center" }}>
        <p style={{ fontSize: 18, color: "#f87171", marginBottom: 16 }}>
          Episode {episode} not available.
        </p>
        <a href={`/anime/${anilistId}`} style={{ color: "#fff", textDecoration: "underline" }}>← Back to anime page</a>
      </div>
    );
  }

  return (
    <div className="watch-page">
      <div className={`watch-main-grid${isTheater ? " theater-mode" : ""}`}>
        <div className="watch-player-column">
          <VideoPlayer
            key={`${selectedBackend}-${episodeId}`}
            episodeId={episodeId}
            episode={episode}
            anilistId={anilistId}
            totalEpisodes={totalEps}
            title={title}
            episodeLabel={episodeLabel}
            description={currentEp?.description}
            posterUrl={currentEp?.image || anime.bannerImage || anime.coverImage.large}
            nextEpisodeTitle={nextEp?.title}
            nextEpisodeThumbnail={nextEp?.image}
            backend={selectedBackend}
            provider={effectiveProvider}
            category={effectiveCategory}
            isTheater={isTheater}
            onTheaterToggle={() => setIsTheater((v) => !v)}
          />
        </div>

        <div className="watch-sidebar-column">
          <EpisodeSidebar
            episodes={episodes}
            currentEpisode={episode}
            anilistId={anilistId}
            animeCover={anime.bannerImage || anime.coverImage.large}
          />
        </div>
      </div>

      <div className="watch-info-grid">
        <div className="watch-info-main">
          {/* Episode Header */}
          <div className="watch-ep-header">
            <h1 className="watch-ep-title">{episode}. {currentEp?.title || title}</h1>
            {showServerSelector && (
              <ServerSelector
                providers={providers}
                selectedBackend={selectedBackend}
                selectedProvider={selectedProvider || providers[0]?.name || ""}
                selectedCategory={selectedCategory}
                onBackendChange={handleBackendChange}
                onProviderChange={setSelectedProvider}
                onCategoryChange={setSelectedCategory}
              />
            )}
          </div>
          
          <div className="watch-ep-meta-row">
            <div className="watch-ep-meta-stats">
              {currentEp?.airDate && <span className="watch-ep-date">{new Date(currentEp.airDate).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })}</span>}
              {subCount > 0 && (
                <span className="watch-ep-stat-badge">
                  <Captions size={14} /> {subCount}
                </span>
              )}
              {dubCount > 0 && (
                <span className="watch-ep-stat-badge">
                  <Mic size={14} /> {dubCount}
                </span>
              )}
            </div>
            
            <WatchActionRow
              anilistId={anilistId}
              idMal={anime.idMal}
              title={title}
              coverImage={anime.coverImage?.large}
            />
          </div>
          
          {currentEp?.description && (
            <p className="watch-ep-desc">{currentEp.description}</p>
          )}

          <AnimeInfoCard anime={anime} />
        </div>

        <div className="watch-info-side">
          <SeasonsGrid relations={anime.relations} currentAnilistId={anilistId} />
          <RelatedAnimeRail relations={anime.relations} />
          <RecommendationsRail recommendations={anime.recommendations} />
        </div>
      </div>
    </div>
  );
}
