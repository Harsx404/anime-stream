"use client";

import { useState, useRef, useEffect } from "react";
import type { MiruroEpisode } from "@/lib/use-miruro";

interface EpisodeSidebarProps {
  episodes: MiruroEpisode[];
  currentEpisode: number;
  anilistId: number;
  loading?: boolean;
}

export default function EpisodeSidebar({
  episodes,
  currentEpisode,
  anilistId,
  loading,
  animeCover,
}: EpisodeSidebarProps & { animeCover?: string }) {
  const [search, setSearch] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!listRef.current) return;
    const active = listRef.current.querySelector(`[data-ep="${currentEpisode}"]`);
    if (active) {
      active.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [currentEpisode]);

  const filtered = episodes.filter((ep) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      String(ep.number).includes(q) ||
      (ep.title || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="episode-sidebar">
      <div className="episode-sidebar-header">
        <h3 className="episode-sidebar-title">Episodes</h3>
        <span className="episode-sidebar-count">{episodes.length} total</span>
      </div>
      <input
        className="episode-sidebar-search"
        type="text"
        placeholder="Search episodes..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="episode-sidebar-list" ref={listRef}>
        {loading && <p className="episode-sidebar-loading">Loading episodes...</p>}
        {!loading && filtered.length === 0 && (
          <p className="episode-sidebar-loading">No episodes found.</p>
        )}
        {filtered.map((ep) => {
          const isActive = ep.number === currentEpisode;
          const thumbnail = ep.image || animeCover || "";
          
          return (
            <a
              key={ep.id}
              data-ep={ep.number}
              href={`/watch/${anilistId}/${ep.number}`}
              className={`episode-sidebar-item${isActive ? " is-active" : ""}`}
            >
              <div className="episode-sidebar-thumbnail-wrapper">
                {thumbnail ? (
                  <img src={thumbnail} alt={`Episode ${ep.number}`} className="episode-sidebar-thumbnail" />
                ) : (
                  <div className="episode-sidebar-thumbnail-fallback" />
                )}
                <div className="episode-sidebar-item-num">{ep.number}</div>
                {isActive && <div className="episode-sidebar-item-playing"><div className="playing-indicator" /></div>}
              </div>
              <div className="episode-sidebar-item-info">
                <p className="episode-sidebar-item-title">
                  {ep.title || `Episode ${ep.number}`}
                </p>
                <div className="episode-sidebar-item-meta">
                  {ep.filler && <span className="episode-filler-badge">Filler</span>}
                  {ep.duration && (
                    <span className="episode-sidebar-item-duration">
                      {Math.floor(ep.duration / 60)}m
                    </span>
                  )}
                </div>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
