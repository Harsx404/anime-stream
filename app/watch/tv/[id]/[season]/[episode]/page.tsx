import { notFound } from "next/navigation";
import { getTVDetails, getTVSeason, tmdbImage, getLogoUrl } from "@/lib/tmdb";
import CineplayWatchClient from "@/components/CineplayWatchClient";
import WatchBreadcrumb from "@/components/WatchBreadcrumb";

interface Props {
  params: Promise<{ id: string; season: string; episode: string }>;
}

export default async function TVWatchPage({ params }: Props) {
  const { id, season: seasonStr, episode: episodeStr } = await params;
  const tmdbId = Number(id);
  const season = Number(seasonStr);
  const episode = Number(episodeStr);
  if (!tmdbId || !season || !episode) notFound();

  const tv = await getTVDetails(tmdbId).catch(() => null);
  if (!tv) notFound();

  const seasonData = await getTVSeason(tmdbId, season).catch(() => null);
  const episodeData = seasonData?.episodes?.find(
    (e) => e.episode_number === episode
  );

  const totalEpisodes = seasonData?.episodes?.length || tv.number_of_episodes || 1;

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "clamp(8px, 2vw, 16px)" }}>
      <WatchBreadcrumb
        backHref={`/tv/${tmdbId}`}
        backLabel={tv.name}
        current={`S${season} E${episode}`}
      />
      <CineplayWatchClient
        tmdbId={tmdbId}
        mediaType="tv"
        title={tv.name}
        imdbId={tv.external_ids?.imdb_id}
        poster={episodeData?.still_path ? tmdbImage(episodeData.still_path, "w1280") : tv.backdrop_path ? tmdbImage(tv.backdrop_path, "w1280") : undefined}
        titleLogo={getLogoUrl(tv.images)}
        description={episodeData?.overview || tv.overview}
        season={season}
        episode={episode}
        totalEpisodes={totalEpisodes}
        totalSeasons={tv.number_of_seasons}
        seasonEpisodes={seasonData?.episodes?.map((e) => ({
          episode_number: e.episode_number,
          name: e.name,
          still_path: e.still_path,
        }))}
      />
    </div>
  );
}
