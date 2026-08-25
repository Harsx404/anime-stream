import { notFound } from "next/navigation";
import { getMovieDetails, tmdbImage, getLogoUrl } from "@/lib/tmdb";
import CineplayWatchClient from "@/components/CineplayWatchClient";
import WatchBreadcrumb from "@/components/WatchBreadcrumb";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function MovieWatchPage({ params }: Props) {
  const { id } = await params;
  const tmdbId = Number(id);
  if (!tmdbId) notFound();

  const movie = await getMovieDetails(tmdbId).catch(() => null);
  if (!movie) notFound();

  const year = movie.release_date
    ? new Date(movie.release_date).getFullYear()
    : undefined;

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "clamp(8px, 2vw, 16px)" }}>
      <WatchBreadcrumb
        backHref={`/movie/${tmdbId}`}
        backLabel={movie.title}
        current="Watch"
      />
      <CineplayWatchClient
        tmdbId={tmdbId}
        mediaType="movie"
        title={movie.title}
        year={year}
        imdbId={movie.imdb_id}
        poster={movie.backdrop_path ? tmdbImage(movie.backdrop_path, "w1280") : undefined}
        titleLogo={getLogoUrl(movie.images)}
        description={movie.overview}
      />
    </div>
  );
}
