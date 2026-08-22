"use client";

import type { AnimeRelation } from "@/lib/anilist";
import Link from "next/link";
import { fromAnime } from "@/components/catalog/toCatalogItem";

interface SeasonsGridProps {
  relations?: { edges: AnimeRelation[] };
  currentAnilistId: number;
}

export default function SeasonsGrid({ relations, currentAnilistId }: SeasonsGridProps) {
  const edges = relations?.edges || [];
  // Filter for sequels, prequels, and maybe alternative settings/parent stories that look like seasons
  const seasonRelations = edges.filter((r) => 
    ["PREQUEL", "SEQUEL", "ALTERNATIVE", "PARENT", "SPIN_OFF"].includes(r.relationType)
  );

  if (!seasonRelations || seasonRelations.length === 0) return null;

  return (
    <div className="watch-rail">
      <h3 className="watch-rail-title">Seasons</h3>
      <div className="seasons-grid">
        {seasonRelations.map((rel) => {
          const isCurrent = rel.node.id === currentAnilistId;
          const formatText = rel.node.format ? rel.node.format.replace("_", " ") : "Unknown";
          
          return (
            <Link
              key={rel.node.id}
              href={`/anime/${rel.node.id}`}
              className={`season-card${isCurrent ? " is-current" : ""}`}
              title={rel.node.title.english || rel.node.title.romaji}
            >
              <div className="season-card-img-wrap">
                <img
                  src={rel.node.coverImage?.large || ""}
                  alt={rel.node.title.romaji}
                  className="season-card-img"
                  loading="lazy"
                />
                <div className="season-card-overlay">
                  <span className="season-card-name">{rel.node.title.english || rel.node.title.romaji}</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
