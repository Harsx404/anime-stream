"use client";

import type { AnimeRecommendation } from "@/lib/anilist";

interface RecommendationsRailProps {
  recommendations?: { nodes: { mediaRecommendation: AnimeRecommendation }[] };
}

export default function RecommendationsRail({ recommendations }: RecommendationsRailProps) {
  const nodes = recommendations?.nodes || [];
  if (nodes.length === 0) return null;

  return (
    <div className="watch-rail">
      <h3 className="watch-rail-title">Recommendations</h3>
      <div className="watch-rail-scroll">
        {nodes.map((node) => {
          const rec = node.mediaRecommendation;
          if (!rec) return null;
          const title = rec.title.english || rec.title.romaji;
          return (
            <a
              key={rec.id}
              href={`/anime/${rec.id}`}
              className="watch-rail-item"
            >
              <img
                src={rec.coverImage.large}
                alt={title}
                className="watch-rail-item-img"
                loading="lazy"
              />
              <p className="watch-rail-item-title">{title}</p>
              <span className="watch-rail-item-relation">{rec.format}</span>
            </a>
          );
        })}
      </div>
    </div>
  );
}
