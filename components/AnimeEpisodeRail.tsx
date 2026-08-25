"use client";

import { useAnimeEpisodes } from "@/lib/use-anime";
import DetailRail from "@/components/DetailRail";

interface Props {
  anilistId: number;
  fallbackImage?: string;
}

export default function AnimeEpisodeRail({ anilistId, fallbackImage }: Props) {
  const { episodes, loading } = useAnimeEpisodes(anilistId, "miruro");

  if (loading || episodes.length === 0) return null;

  const items = episodes.slice(0, 4).map((ep) => ({
    href: `/watch/${anilistId}/${ep.number}`,
    image: ep.image || fallbackImage,
    label: `Episode ${ep.number}`,
    sublabel: ep.title,
  }));

  return (
    <div className="hero-rail">
      <DetailRail title="Episodes" items={items} />
    </div>
  );
}
