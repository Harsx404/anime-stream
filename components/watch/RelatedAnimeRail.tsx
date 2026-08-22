"use client";

import type { AnimeRelation } from "@/lib/anilist";

interface RelatedAnimeRailProps {
  relations?: { edges: AnimeRelation[] };
}

export default function RelatedAnimeRail({ relations }: RelatedAnimeRailProps) {
  const edges = relations?.edges || [];
  if (edges.length === 0) return null;

  return (
    <div className="watch-rail">
      <h3 className="watch-rail-title">Related</h3>
      <div className="watch-rail-scroll">
        {edges.map((edge) => {
          const title = edge.node.title.english || edge.node.title.romaji;
          return (
            <a
              key={edge.node.id}
              href={`/anime/${edge.node.id}`}
              className="watch-rail-item"
            >
              <img
                src={edge.node.coverImage.large}
                alt={title}
                className="watch-rail-item-img"
                loading="lazy"
              />
              <p className="watch-rail-item-title">{title}</p>
              <span className="watch-rail-item-relation">{edge.relationType}</span>
            </a>
          );
        })}
      </div>
    </div>
  );
}
