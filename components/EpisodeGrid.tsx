"use client";

import { useState, useEffect } from "react";
import { useMiruroEpisodes } from "@/lib/use-miruro";
import type { Anime } from "@/lib/anilist";

interface Props {
  anilistId: number;
  anime: Anime;
}

export default function EpisodeGrid({ anilistId, anime }: Props) {
  const { episodes, loading, error } = useMiruroEpisodes(anilistId);
  const [episodeCount, setEpisodeCount] = useState(anime.episodes || 0);

  useEffect(() => {
    if (episodes.length > 0) setEpisodeCount(episodes.length);
  }, [episodes]);

  if (loading) {
    return (
      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Episodes</h2>
        <p style={{ color: "var(--text-muted)" }}>Loading episodes...</p>
      </section>
    );
  }

  if (error && episodeCount === 0) {
    return (
      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Episodes</h2>
        <p style={{ color: "red" }}>Failed to load episodes: {error}</p>
      </section>
    );
  }

  if (episodeCount === 0) {
    return (
      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Episodes</h2>
        <p style={{ color: "var(--text-muted)" }}>No episodes available.</p>
      </section>
    );
  }

  const episodeNumbers = Array.from({ length: episodeCount }, (_, i) => i + 1);

  return (
    <section style={{ marginTop: 32 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Episodes</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(48px, 1fr))",
          gap: 8,
        }}
      >
        {episodeNumbers.map((ep) => (
          <a
            key={ep}
            href={`/watch/${anilistId}/${ep}`}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: 44,
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              background: "var(--card)",
              border: "1px solid var(--border)",
            }}
          >
            {ep}
          </a>
        ))}
      </div>
    </section>
  );
}
