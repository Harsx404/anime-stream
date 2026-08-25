import Image from "next/image";
import { Star, Play } from "lucide-react";
import type { CatalogItem } from "@/components/catalog/toCatalogItem";
import WatchlistButton from "@/components/catalog/WatchlistButton";

export default function MediaCard({ item, width }: { item: CatalogItem; width?: number }) {
  const rootStyle = width
    ? { width: `var(--card-w, ${width}px)`, flexShrink: 0 }
    : { width: "100%" };
  const playSize = width && width < 140 ? 32 : 40;
  return (
    <a href={item.href} className="media-card" style={rootStyle}>
      <div className="media-card-thumb" style={{ width: "100%", aspectRatio: "2 / 3" }}>
        {item.poster ? (
          <Image
            src={item.poster}
            alt={item.title}
            fill
            sizes={width ? `${width}px` : "(max-width: 600px) 45vw, 140px"}
            className="object-cover"
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-muted)",
              fontSize: 12,
              textAlign: "center",
              padding: 8,
            }}
          >
            No Image
          </div>
        )}

        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(180deg, rgba(0,0,0,0) 55%, rgba(0,0,0,0.75) 100%)",
          }}
        />

        <div
          className="play-icon"
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: playSize,
            height: playSize,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.92)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#000",
          }}
        >
          <Play size={playSize * 0.4} fill="currentColor" />
        </div>

        {item.rating != null && item.rating > 0 && (
          <div className="media-card-rating">
            <Star size={10} fill="currentColor" />
            {item.rating.toFixed(1)}
          </div>
        )}

        {item.badge && <div className="media-card-badge">{item.badge}</div>}

        <div style={{ position: "absolute", top: 6, left: 6 }}>
          <WatchlistButton
            item={{ kind: item.kind, id: item.id, title: item.title, cover: item.poster, href: item.href }}
            size={12}
          />
        </div>
      </div>

      <p
        style={{
          fontSize: 12,
          fontWeight: 600,
          marginTop: 6,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {item.title}
      </p>
      {item.meta && (
        <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{item.meta}</p>
      )}
    </a>
  );
}
