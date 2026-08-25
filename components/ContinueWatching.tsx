"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { getContinueWatching, type WatchProgress } from "@/lib/history";

export default function ContinueWatching() {
  const [items, setItems] = useState<WatchProgress[]>([]);

  useEffect(() => {
    setItems(getContinueWatching(12));
  }, []);

  if (items.length === 0) return null;

  return (
    <section style={{ marginBottom: 40 }}>
      <h2 className="section-heading">Continue Watching</h2>
      <div className="carousel-track">
        {items.map((item) => {
          const progress = item.duration > 0 ? Math.min(1, item.currentTime / item.duration) : 0;
          return (
            <a
              key={`${item.kind}-${item.id}-${item.season || 0}-${item.episode || 0}`}
              href={item.href}
              style={{ display: "block", width: "var(--cw-w, 200px)", flexShrink: 0 }}
            >
              <div
                style={{
                  position: "relative",
                  width: "var(--cw-w, 200px)",
                  height: "calc(var(--cw-w, 200px) * 0.56)",
                  overflow: "hidden",
                  border: "1px solid var(--border)",
                  background: "var(--card)",
                }}
              >
                {item.cover && (
                  <Image
                    src={item.cover}
                    alt={item.title}
                    fill
                    sizes="(max-width: 767px) 160px, 200px"
                    className="object-cover"
                  />
                )}
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: 3,
                    background: "rgba(255,255,255,0.25)",
                  }}
                >
                  <div style={{ width: `${progress * 100}%`, height: "100%", background: "var(--accent)" }} />
                </div>
              </div>
              <p style={{ fontSize: 13, fontWeight: 600, marginTop: 6 }}>{item.title}</p>
              <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
                {item.kind === "anime" && item.episode ? `Episode ${item.episode}` : null}
                {item.kind === "tv" && item.season && item.episode ? `S${item.season} · E${item.episode}` : null}
                {item.kind === "movie" ? "Movie" : null}
              </p>
            </a>
          );
        })}
      </div>
    </section>
  );
}
