import { getTVDetails, getTVSeason, tmdbImage, getDirector, getTrailerKey } from "@/lib/tmdb";
import { notFound } from "next/navigation";
import SeasonEpisodeRail from "@/components/SeasonEpisodeRail";
import DetailHero from "@/components/DetailHero";
import TrailerModal from "@/components/TrailerModal";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function TVPage({ params }: Props) {
  const { id } = await params;
  const tvId = Number(id);
  if (!tvId) notFound();

  const tv = await getTVDetails(tvId).catch(() => null);
  if (!tv) notFound();

  const year = tv.first_air_date ? new Date(tv.first_air_date).getFullYear() : null;
  const trailerKey = getTrailerKey(tv.videos);

  const creator = tv.created_by?.[0];
  const director = creator ? null : getDirector(tv.credits);
  const credit = creator
    ? { role: "Creator", name: creator.name, avatarUrl: creator.profile_path ? tmdbImage(creator.profile_path, "w185") : undefined }
    : director
      ? { role: "Director", name: director.name, avatarUrl: director.profile_path ? tmdbImage(director.profile_path, "w185") : undefined }
      : undefined;

  const metaItems: string[] = [];
  if (tv.vote_average != null && tv.vote_average > 0) metaItems.push(`★ ${tv.vote_average.toFixed(1)}`);
  if (year) metaItems.push(String(year));
  if (tv.number_of_seasons) metaItems.push(`${tv.number_of_seasons} season${tv.number_of_seasons > 1 ? "s" : ""}`);
  if (tv.number_of_episodes) metaItems.push(`${tv.number_of_episodes} episodes`);
  if (tv.status) metaItems.push(tv.status);

  const firstSeason = (tv.seasons || []).find((s) => s.season_number > 0);
  const seasonEpisodes = firstSeason
    ? await getTVSeason(tvId, firstSeason.season_number).catch(() => null)
    : null;

  return (
    <div>
      <DetailHero
        backdropUrl={tv.backdrop_path ? tmdbImage(tv.backdrop_path, "w1280") : undefined}
        eyebrow={tv.status && year ? `${tv.status} · ${year}` : tv.status || (year ? String(year) : undefined)}
        title={tv.name}
        subtitle={tv.tagline}
        genres={tv.genres?.map((g) => g.name)}
        metaItems={metaItems}
        overview={tv.overview}
        primaryHref={`/watch/tv/${tv.id}/${firstSeason?.season_number || 1}/1`}
        primaryLabel="Watch Now"
        trailer={trailerKey ? <TrailerModal videoKey={trailerKey} /> : undefined}
        credit={credit}
        railSlot={
          <div className="hero-rail">
            <SeasonEpisodeRail
              tvId={tvId}
              seasons={tv.seasons || []}
              initialSeason={firstSeason?.season_number}
              initialEpisodes={seasonEpisodes?.episodes || []}
            />
          </div>
        }
      />
    </div>
  );
}
