import { getMovieDetails, tmdbImage, getDirector, getTrailerKey } from "@/lib/tmdb";
import { notFound } from "next/navigation";
import DetailHero from "@/components/DetailHero";
import TrailerModal from "@/components/TrailerModal";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function MoviePage({ params }: Props) {
  const { id } = await params;
  const movieId = Number(id);
  if (!movieId) notFound();

  const movie = await getMovieDetails(movieId).catch(() => null);
  if (!movie) notFound();

  const year = movie.release_date ? new Date(movie.release_date).getFullYear() : null;
  const director = getDirector(movie.credits);
  const trailerKey = getTrailerKey(movie.videos);

  const metaItems: string[] = [];
  if (movie.vote_average != null && movie.vote_average > 0) metaItems.push(`★ ${movie.vote_average.toFixed(1)}`);
  if (year) metaItems.push(String(year));
  if (movie.runtime) metaItems.push(`${Math.floor(movie.runtime / 60)}h ${movie.runtime % 60}m`);
  if (movie.status) metaItems.push(movie.status);

  const similar = (movie.similar?.results || []).filter((m) => m.poster_path).slice(0, 4);

  return (
    <div>
      <DetailHero
        backdropUrl={movie.backdrop_path ? tmdbImage(movie.backdrop_path, "w1280") : undefined}
        eyebrow={movie.status && year ? `${movie.status} · ${year}` : movie.status || (year ? String(year) : undefined)}
        title={movie.title}
        subtitle={movie.tagline}
        genres={movie.genres?.map((g) => g.name)}
        metaItems={metaItems}
        overview={movie.overview}
        primaryHref={`/watch/movie/${movie.id}`}
        primaryLabel="Watch Now"
        trailer={trailerKey ? <TrailerModal videoKey={trailerKey} /> : undefined}
        credit={director ? { role: "Director", name: director.name, avatarUrl: director.profile_path ? tmdbImage(director.profile_path, "w185") : undefined } : undefined}
        rail={{
          title: "You May Also Like",
          items: similar.map((m) => ({
            href: `/movie/${m.id}`,
            image: tmdbImage(m.poster_path, "w342"),
            label: m.title || m.name || "Untitled",
            sublabel: m.release_date ? String(new Date(m.release_date).getFullYear()) : undefined,
          })),
        }}
      />
    </div>
  );
}
