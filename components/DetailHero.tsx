import Image from "next/image";
import DetailRail, { type RailItem } from "@/components/DetailRail";
import { anton } from "@/lib/fonts";

export interface DetailCredit {
  role: string;
  name: string;
  avatarUrl?: string | null;
}

interface Props {
  backdropUrl?: string;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  genres?: string[];
  metaItems?: string[];
  overview?: string;
  primaryHref: string;
  primaryLabel?: string;
  trailer?: React.ReactNode;
  credit?: DetailCredit | null;
  rail?: { title: string; items: RailItem[] };
  railSlot?: React.ReactNode;
}

export default function DetailHero({
  backdropUrl,
  eyebrow,
  title,
  subtitle,
  genres = [],
  metaItems = [],
  overview,
  primaryHref,
  primaryLabel = "Watch Now",
  trailer,
  credit,
  rail,
  railSlot,
}: Props) {
  return (
    <section
      style={{
        position: "relative",
        width: "100%",
        minHeight: "clamp(420px, 70vh, 620px)",
        overflow: "hidden",
        background: "var(--bg)",
      }}
    >
      {backdropUrl && (
        <Image
          src={backdropUrl}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
      )}
      <div className="hero-overlay" />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          minHeight: "clamp(420px, 70vh, 620px)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          gap: "clamp(16px, 4vw, 32px)",
          padding: "clamp(20px, 4vw, 32px) clamp(16px, 4vw, 64px) 40px",
        }}
      >
        {credit && (
          <div className="hero-credit-anim" style={{ display: "flex", justifyContent: "flex-end" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  position: "relative",
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  overflow: "hidden",
                  background: "rgba(255,255,255,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: 14,
                  color: "#fff",
                  flexShrink: 0,
                }}
              >
                {credit.avatarUrl ? (
                  <Image src={credit.avatarUrl} alt={credit.name} fill sizes="40px" className="object-cover" />
                ) : (
                  credit.name.charAt(0).toUpperCase()
                )}
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{credit.name}</p>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>{credit.role}</p>
              </div>
            </div>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 32, flexWrap: "wrap" }}>
          <div className="hero-content-anim" style={{ maxWidth: "min(640px, 100%)", minWidth: 0 }}>
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
                fontSize: "clamp(32px, 5.5vw, 64px)",
                fontWeight: 400,
                lineHeight: 1.05,
                color: "#fff",
                marginBottom: subtitle ? 4 : 12,
                letterSpacing: 0.5,
                textTransform: "uppercase",
              }}
            >
              {title}
            </h1>

            {subtitle && (
              <p style={{ fontSize: 15, color: "rgba(255,255,255,0.65)", fontStyle: "italic", marginBottom: 12 }}>
                {subtitle}
              </p>
            )}

            {genres.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                {genres.map((g) => (
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
                href={primaryHref}
                className="btn-square-accent"
              >
                ▶ {primaryLabel}
              </a>
              {trailer}
            </div>
          </div>

          {railSlot}
          {!railSlot && rail && rail.items.length > 0 && (
            <div className="hero-rail">
              <DetailRail title={rail.title} items={rail.items} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
