"use client";

import { useState } from "react";
import type { TMDBSeasonSummary } from "@/lib/tmdb";

interface Props {
  tvId: number;
  seasons: TMDBSeasonSummary[];
}

export default function SeasonEpisodePicker({ tvId, seasons }: Props) {
  const validSeasons = seasons.filter((s) => s.season_number > 0);
  const [selectedSeason, setSelectedSeason] = useState(
    validSeasons[0]?.season_number || 1,
  );

  const currentSeason = validSeasons.find((s) => s.season_number === selectedSeason);
  const episodeCount = currentSeason?.episode_count || 0;

  if (validSeasons.length === 0) {
    return (
      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Episodes</h2>
        <p style={{ color: "var(--text-muted)" }}>No seasons available.</p>
      </section>
    );
  }

  return (
    <section style={{ marginTop: 32 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Episodes</h2>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        {validSeasons.map((s) => (
          <button
            key={s.id}
            onClick={() => setSelectedSeason(s.season_number)}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              background: selectedSeason === s.season_number ? "var(--accent)" : "var(--card)",
              color: selectedSeason === s.season_number ? "#fff" : "var(--text-muted)",
              border: "1px solid var(--border)",
              cursor: "pointer",
            }}
          >
            {s.name || `Season ${s.season_number}`}
          </button>
        ))}
      </div>

      {episodeCount > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(48px, 1fr))",
            gap: 8,
          }}
        >
          {Array.from({ length: episodeCount }, (_, i) => i + 1).map((ep) => (
            <a
              key={ep}
              href={`/watch/tv/${tvId}/${selectedSeason}/${ep}`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: 40,
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
      )}
    </section>
  );
}
