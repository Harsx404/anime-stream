"use client";

import type { Anime } from "@/lib/anilist";

interface Props {
  anime: Anime;
}

export default function AnimeInfoCard({ anime }: Props) {
  const title = anime.title.english || anime.title.romaji;
  const genres = anime.genres || [];
  const score = anime.averageScore ? (anime.averageScore / 10).toFixed(1) : null;
  const studios = anime.studios?.nodes?.filter((n) => n.isAnimationStudio).map((n) => n.name).join(", ");
  const format = anime.format ? anime.format.replace("_", " ") : "TV";
  const startDate = anime.startDate?.year ? `${anime.startDate.month ? new Date(anime.startDate.year, anime.startDate.month - 1, anime.startDate.day || 1).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : anime.startDate.year}` : "Unknown";

  return (
    <div className="anime-info-card">
      <div className="anime-info-poster-col">
        <img src={anime.coverImage.large} alt={title} className="anime-info-poster" />
      </div>
      <div className="anime-info-details-col">
        <h2 className="anime-info-card-title">{title}</h2>
        {anime.title.english && anime.title.romaji && (
          <p className="anime-info-card-romaji">{anime.title.romaji}</p>
        )}
        
        <div className="anime-info-card-meta">
          {score && <span className="anime-info-card-score">⭐ {score}</span>}
          {anime.status && <span className="anime-info-card-tag">{anime.status.replace("_", " ")}</span>}
          {anime.season && anime.seasonYear && <span className="anime-info-card-tag">{anime.season} {anime.seasonYear}</span>}
        </div>

        <div className="anime-info-card-genres">
          {genres.map((g) => (
            <span key={g} className="anime-info-card-genre">{g}</span>
          ))}
        </div>

        <p className="anime-info-card-description">
          {anime.description?.replace(/<[^>]+>/g, "").slice(0, 400)}
          {anime.description && anime.description.length > 400 ? "..." : ""}
        </p>

        <div className="anime-info-card-footer">
          <div className="anime-info-card-stat">
            <span className="stat-label">Format:</span> <span className="stat-val">{format}</span>
          </div>
          <div className="anime-info-card-stat">
            <span className="stat-label">Start Date:</span> <span className="stat-val">{startDate}</span>
          </div>
          {studios && (
            <div className="anime-info-card-stat">
              <span className="stat-label">Studio:</span> <span className="stat-val">{studios}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
