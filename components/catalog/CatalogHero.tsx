import Image from "next/image";
import { anton } from "@/lib/fonts";
import WatchlistButton from "@/components/catalog/WatchlistButton";
import type { MediaKind } from "@/lib/history";

interface Props {
  backdropUrl?: string;
  eyebrow?: string;
  title: string;
  overview?: string;
  genres?: string[];
  metaItems?: string[];
  watchHref: string;
  watchlist: { kind: MediaKind; id: number; title: string; cover: string; href: string };
}

export default function CatalogHero({
  backdropUrl,
  eyebrow,
  title,
  overview,
  genres = [],
  metaItems = [],
  watchHref,
  watchlist,
}: Props) {
  return (
    <section
      className="hero-content-anim"
      style={{
        position: "relative",
        width: "100%",
        minHeight: "clamp(380px, 60vh, 520px)",
        overflow: "hidden",
        marginBottom: 40,
      }}
    >
      {backdropUrl && (
        <Image src={backdropUrl} alt="" fill priority sizes="100vw" className="object-cover" />
      )}
      <div className="hero-overlay" />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          minHeight: "clamp(380px, 60vh, 520px)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          padding: "clamp(20px, 4vw, 32px) clamp(16px, 4vw, 64px) 40px",
        }}
      >
        <div style={{ maxWidth: "min(620px, 100%)" }}>
          {eyebrow && (
            <p
              style={{
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: 2,
                color: "rgba(255,255,255,0.7)",
                marginBottom: 8,
                textTransform: "uppercase",
              }}
            >
              {eyebrow}
            </p>
          )}

          <h1
            className={anton.className}
            style={{
              fontSize: "clamp(32px, 5.5vw, 60px)",
              fontWeight: 400,
              lineHeight: 1.05,
              color: "#fff",
              marginBottom: 12,
              letterSpacing: 0.5,
              textTransform: "uppercase",
            }}
          >
            {title}
          </h1>

          {genres.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              {genres.slice(0, 3).map((g) => (
                <span
                  key={g}
                  className="status-chip"
                >
                  {g}
                </span>
              ))}
            </div>
          )}

          {metaItems.length > 0 && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 16,
                fontSize: 14,
                color: "rgba(255,255,255,0.75)",
                marginBottom: 12,
              }}
            >
              {metaItems.map((m, i) => (
                <span key={i}>{m}</span>
              ))}
            </div>
          )}

          {overview && (
            <p
              style={{
                fontSize: "clamp(13px, 1.8vw, 14px)",
                lineHeight: 1.6,
                color: "rgba(255,255,255,0.75)",
                marginBottom: 20,
                display: "-webkit-box",
                WebkitLineClamp: "auto",
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {overview}
            </p>
          )}

          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            <a
              href={watchHref}
              className="btn-square-accent"
            >
              ▶ Stream Now
            </a>
            <WatchlistButton item={watchlist} variant="button" />
          </div>
        </div>
      </div>
    </section>
  );
}
