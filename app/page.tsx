import VideoHero from "@/components/VideoHero";
import { anton } from "@/lib/fonts";
import { getTrending, getPopularSeason } from "@/lib/anilist";
import { getPopularMovies, getTopRatedTV, getMovieGenres, getTVGenres } from "@/lib/tmdb";
import { fromAnime, fromTMDB } from "@/components/catalog/toCatalogItem";
import LottieFeatureCard from "@/components/LottieFeatureCard";
import filmLottie from "@/public/doodle-black-62-film-play-hover-pinch.json";
import monsterLottie from "@/public/doodle-black-1872-monster-hover-pinch.json";
import fireworkLottie from "@/public/doodle-black-2234-firework-hover-lunch.json";
import eyeLottie from "@/public/doodle-black-69-eye-hover-pinch.json";

export default async function LandingPage() {
  const [trending, seasonal, popularMovies, topRatedTV, movieGenres, tvGenres] = await Promise.all([
    getTrending(6).catch(() => []),
    getPopularSeason(6).catch(() => []),
    getPopularMovies().catch(() => []),
    getTopRatedTV().catch(() => []),
    getMovieGenres().catch(() => []),
    getTVGenres().catch(() => []),
  ]);

  const movieGenreMap = new Map(movieGenres.map((g) => [g.id, g.name] as [number, string]));
  const tvGenreMap = new Map(tvGenres.map((g) => [g.id, g.name] as [number, string]));

  const features = [
    { lottieSrc: filmLottie, title: "Movies & TV", desc: "Thousands of titles in 4K and 1080p, updated daily." },
    { lottieSrc: monsterLottie, title: "Anime Library", desc: "Subbed and dubbed episodes from every season, current and classic." },
    { lottieSrc: fireworkLottie, title: "Instant Streaming", desc: "No downloads, no ads, no waiting. Click play and go." },
    { lottieSrc: eyeLottie, title: "Watch Anywhere", desc: "Works on desktop, mobile, tablet — anywhere with a browser." },
  ];

  return (
    <div style={{ background: "#000" }}>
      <VideoHero />

      {/* Feature section */}
      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "clamp(40px, 8vw, 80px) clamp(16px, 4vw, 24px)" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <span className="status-chip status-chip-accent" style={{ marginBottom: 16 }}>
            Why KINOVA
          </span>
          <h2
            className={anton.className}
            style={{
              fontSize: "clamp(32px, 5vw, 56px)",
              fontWeight: 400,
              lineHeight: 1.05,
              letterSpacing: "-1px",
              color: "#fff",
              textTransform: "uppercase",
              marginTop: 12,
            }}
          >
            Everything you need. <span style={{ color: "var(--accent)" }}>Nothing you don&apos;t.</span>
          </h2>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 16,
          }}
        >
          {features.map((f) => (
            <LottieFeatureCard
              key={f.title}
              title={f.title}
              desc={f.desc}
              lottieSrc={f.lottieSrc}
            />
          ))}
        </div>
      </section>

      {/* Trending preview */}
      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "0 clamp(16px, 4vw, 24px) clamp(40px, 8vw, 80px)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
          <h2
            className={anton.className}
            style={{
              fontSize: "clamp(24px, 4vw, 40px)",
              fontWeight: 400,
              letterSpacing: "-0.5px",
              color: "#fff",
              textTransform: "uppercase",
            }}
          >
            Trending <span style={{ color: "var(--accent)" }}>Now</span>
          </h2>
          <a href="/home" className="btn-ghost" style={{ padding: "8px 18px", fontSize: 12 }}>
            View All →
          </a>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
            gap: 12,
          }}
        >
          {trending.slice(0, 6).map((anime) => {
            const item = fromAnime(anime);
            return (
              <a
                key={`a-${item.id}`}
                href={item.href}
                className="media-card"
                style={{ width: "100%" }}
              >
                <div className="media-card-thumb" style={{ width: "100%", aspectRatio: "2 / 3" }}>
                  {item.poster && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.poster}
                      alt={item.title}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  )}
                  {item.badge && <div className="media-card-badge">{item.badge}</div>}
                </div>
                <p
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    marginTop: 6,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    color: "#fff",
                  }}
                >
                  {item.title}
                </p>
              </a>
            );
          })}
        </div>
      </section>

      {/* Movies + TV preview */}
      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "0 clamp(16px, 4vw, 24px) clamp(40px, 8vw, 80px)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
          <div>
            <h3
              className={anton.className}
              style={{
                fontSize: 24,
                fontWeight: 400,
                color: "#fff",
                textTransform: "uppercase",
                marginBottom: 16,
                letterSpacing: "-0.5px",
              }}
            >
              Popular <span style={{ color: "var(--accent)" }}>Movies</span>
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))", gap: 8 }}>
              {popularMovies.slice(0, 3).map((m) => {
                const item = fromTMDB(m, "movie", movieGenreMap);
                return (
                  <a key={`m-${item.id}`} href={item.href} className="media-card" style={{ width: "100%" }}>
                    <div className="media-card-thumb" style={{ width: "100%", aspectRatio: "2 / 3" }}>
                      {item.poster && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.poster} alt={item.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      )}
                    </div>
                    <p style={{ fontSize: 11, fontWeight: 600, marginTop: 4, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.title}
                    </p>
                  </a>
                );
              })}
            </div>
          </div>

          <div>
            <h3
              className={anton.className}
              style={{
                fontSize: 24,
                fontWeight: 400,
                color: "#fff",
                textTransform: "uppercase",
                marginBottom: 16,
                letterSpacing: "-0.5px",
              }}
            >
              Top Rated <span style={{ color: "var(--accent)" }}>TV</span>
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))", gap: 8 }}>
              {topRatedTV.slice(0, 3).map((t) => {
                const item = fromTMDB(t, "tv", tvGenreMap);
                return (
                  <a key={`t-${item.id}`} href={item.href} className="media-card" style={{ width: "100%" }}>
                    <div className="media-card-thumb" style={{ width: "100%", aspectRatio: "2 / 3" }}>
                      {item.poster && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.poster} alt={item.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      )}
                    </div>
                    <p style={{ fontSize: 11, fontWeight: 600, marginTop: 4, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.title}
                    </p>
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* CTA section */}
      <section
        style={{
          position: "relative",
          overflow: "hidden",
          padding: "clamp(50px, 10vw, 100px) clamp(16px, 4vw, 24px)",
          textAlign: "center",
          background:
            "radial-gradient(circle at center, rgba(225,29,60,0.10) 0%, transparent 55%), #000",
        }}
      >
        <div style={{ position: "relative", zIndex: 1, maxWidth: 600, margin: "0 auto" }}>
          <h2
            className={anton.className}
            style={{
              fontSize: "clamp(36px, 6vw, 72px)",
              fontWeight: 400,
              lineHeight: 1,
              letterSpacing: "-2px",
              color: "#fff",
              textTransform: "uppercase",
              marginBottom: 16,
            }}
          >
            Ready to <span style={{ color: "var(--accent)" }}>stream?</span>
          </h2>
          <p style={{ fontSize: 16, color: "var(--text-muted)", marginBottom: 32, lineHeight: 1.6 }}>
            Jump straight into trending anime, blockbuster movies, and binge-worthy TV — no signup required.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a href="/home" className="btn-square-accent">
              ▶ Enter KINOVA
            </a>
            <a href="/browse" className="btn-ghost">
              Browse Catalog
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
