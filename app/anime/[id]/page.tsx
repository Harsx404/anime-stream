import { getAnimeById } from "@/lib/anilist";
import { notFound } from "next/navigation";
import EpisodeGrid from "@/components/EpisodeGrid";
import DetailHero from "@/components/DetailHero";
import AnimeEpisodeRail from "@/components/AnimeEpisodeRail";
import { stripHtml } from "@/lib/text";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AnimePage({ params }: Props) {
  const { id } = await params;
  const anilistId = Number(id);
  if (!anilistId) notFound();

  const anime = await getAnimeById(anilistId).catch(() => null);
  if (!anime) notFound();

  const title = anime.title.english || anime.title.romaji;
  const studio = anime.studios.nodes.find((s) => s.isAnimationStudio) || anime.studios.nodes[0];

  const metaItems: string[] = [];
  if (anime.averageScore) metaItems.push(`★ ${(anime.averageScore / 10).toFixed(1)}`);
  if (anime.format) metaItems.push(anime.format);
  if (anime.status) metaItems.push(anime.status);
  if (anime.episodes) metaItems.push(`${anime.episodes} eps`);
  if (anime.duration) metaItems.push(`${anime.duration} min`);
  const yearLabel = anime.seasonYear || anime.startDate.year;
  if (yearLabel) metaItems.push(String(yearLabel));

  return (
    <div>
      <DetailHero
        backdropUrl={anime.bannerImage}
        eyebrow={anime.status && yearLabel ? `${anime.status} · ${yearLabel}` : anime.status}
        title={title}
        subtitle={anime.title.romaji !== title ? anime.title.romaji : undefined}
        genres={anime.genres}
        metaItems={metaItems}
        overview={anime.description ? stripHtml(anime.description) : undefined}
        primaryHref={`/watch/${anilistId}/1`}
        primaryLabel="Watch Now"
        credit={studio ? { role: "Studio", name: studio.name } : undefined}
        railSlot={<AnimeEpisodeRail anilistId={anilistId} fallbackImage={anime.coverImage.large} />}
      />

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 16px 24px" }}>
        <EpisodeGrid anilistId={anilistId} anime={anime} />
      </div>
    </div>
  );
}
