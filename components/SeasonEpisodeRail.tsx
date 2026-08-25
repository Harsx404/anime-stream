"use client";

import { useState, useEffect, useRef } from "react";
import type { TMDBSeasonSummary, TMDBSeason, TMDBEpisode } from "@/lib/tmdb";

interface Props {
  tvId: number;
  seasons: TMDBSeasonSummary[];
  initialSeason?: number;
  initialEpisodes?: TMDBEpisode[];
}

export default function SeasonEpisodeRail({
  tvId,
  seasons,
  initialSeason,
  initialEpisodes = [],
}: Props) {
  const validSeasons = seasons.filter((s) => s.season_number > 0);
  const [selectedSeason, setSelectedSeason] = useState(
    initialSeason || validSeasons[0]?.season_number || 1
  );
  const [episodes, setEpisodes] = useState<TMDBEpisode[]>(initialEpisodes);
  const [loading, setLoading] = useState(false);
  const [seasonOpen, setSeasonOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentSeason = validSeasons.find((s) => s.season_number === selectedSeason);
  const initialSeasonNum = initialSeason || validSeasons[0]?.season_number || 1;

  // Fetch episodes when season changes (skip if it's the initial season already loaded)
  useEffect(() => {
    if (selectedSeason === initialSeasonNum) return;

    setLoading(true);
    fetch(`/api/tmdb/tv/${tvId}/season/${selectedSeason}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data: TMDBSeason) => setEpisodes(data.episodes || []))
      .catch(() => setEpisodes([]))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSeason]);

  // Close dropdown on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setSeasonOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (validSeasons.length === 0) return null;

  return (
    <div className="season-rail">
      {/* Header: season dropdown — matches original "// SEASON N EPISODES" label */}
      <div className="season-rail-dropdown" ref={dropdownRef}>
        <button
          className="season-rail-dropdown-trigger"
          onClick={() => setSeasonOpen(!seasonOpen)}
        >
          <span className="season-rail-dropdown-label">
            // {currentSeason?.name || `Season ${selectedSeason}`} Episodes
          </span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            style={{
              transform: seasonOpen ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s ease",
            }}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {seasonOpen && (
          <div className="season-rail-dropdown-panel">
            {validSeasons.map((s) => (
              <button
                key={s.id}
                className={`season-rail-dropdown-option${
                  s.season_number === selectedSeason ? " is-active" : ""
                }`}
                onClick={() => {
                  setSelectedSeason(s.season_number);
                  setSeasonOpen(false);
                }}
              >
                <span>{s.name || `Season ${s.season_number}`}</span>
                <span className="season-rail-dropdown-count">
                  {s.episode_count} eps
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Episode list — original stacked-thumbnail style, scrollable */}
      <div className="season-rail-list">
        {loading ? (
          <div className="season-rail-loading">
            <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        ) : episodes.length === 0 ? (
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>
            No episodes found.
          </p>
        ) : (
          episodes.map((ep, i) => (
            <a
              key={ep.id || ep.episode_number}
              href={`/watch/tv/${tvId}/${selectedSeason}/${ep.episode_number}`}
              className="season-rail-item rail-item-anim"
              style={{ animationDelay: `${300 + i * 60}ms` }}
            >
              <div className="season-rail-thumb">
                {ep.still_path ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`https://image.tmdb.org/t/p/w300${ep.still_path}`}
                    alt={ep.name}
                    loading="lazy"
                  />
                ) : (
                  <div className="season-rail-thumb-fallback">
                    <span>{ep.episode_number}</span>
                  </div>
                )}
                <div className="season-rail-thumb-overlay" />
                <div className="season-rail-play">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M5 3L19 12L5 21V3Z" />
                  </svg>
                </div>
                <span className="season-rail-ep-num">
                  EPISODE {ep.episode_number}
                </span>
              </div>
              <p className="season-rail-name">{ep.name}</p>
            </a>
          ))
        )}
      </div>
    </div>
  );
}
