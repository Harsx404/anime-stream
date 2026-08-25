import { notFound } from "next/navigation";
import "./watch-page.css";
import { getAnimeByIdDetailed } from "@/lib/anilist";
import WatchClient from "@/components/WatchClient";
import HistoryTracker from "@/components/HistoryTracker";
import WatchBreadcrumb from "@/components/WatchBreadcrumb";

interface Props {
  params: Promise<{ anilistId: string; episode: string }>;
}

export default async function WatchPage({ params }: Props) {
  const { anilistId: anilistIdStr, episode: episodeStr } = await params;
  const anilistId = Number(anilistIdStr);
  const episode = Number(episodeStr);

  if (!anilistId || !episode || episode < 1) notFound();

  const anime = await getAnimeByIdDetailed(anilistId).catch(() => null);
  if (!anime) notFound();

  const title = anime.title.english || anime.title.romaji;

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "clamp(8px, 2vw, 16px)" }}>
      <HistoryTracker
        anilistId={anilistId}
        episode={episode}
        title={title}
        cover={anime.coverImage.medium}
      />

      <WatchBreadcrumb backHref={`/anime/${anilistId}`} backLabel={title} current={`Episode ${episode}`} />

      <WatchClient anilistId={anilistId} episode={episode} anime={anime} />
    </div>
  );
}
