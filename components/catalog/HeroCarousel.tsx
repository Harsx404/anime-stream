"use client";

import React, { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { anton } from "@/lib/fonts";
import WatchlistButton from "@/components/catalog/WatchlistButton";
import type { MediaKind } from "@/lib/history";
import { stripHtml } from "@/lib/text";

export interface HeroCarouselItem {
  id: number;
  title: string;
  backdropUrl?: string;
  overview?: string;
  genres?: string[];
  metaItems?: string[];
  watchHref: string;
  watchlist: { kind: MediaKind; id: number; title: string; cover: string; href: string };
}

interface Props {
  items: HeroCarouselItem[];
  eyebrow?: string;
}

export default function HeroCarousel({ items, eyebrow }: Props) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, duration: 40 }, [
    Autoplay({ delay: 6000, stopOnInteraction: true }),
  ]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
  }, [emblaApi, onSelect]);

  if (!items || items.length === 0) return null;

  return (
    <section className="hero-content-anim" style={{ position: "relative", width: "100%", minHeight: 520, overflow: "hidden", marginBottom: 40 }}>
      <div ref={emblaRef} style={{ overflow: "hidden", height: "100%" }}>
        <div style={{ display: "flex", height: "100%" }}>
          {items.map((item, index) => {
            const isActive = index === selectedIndex;
            return (
              <div
                key={item.id}
                style={{
                  flex: "0 0 100%",
                  minWidth: 0,
                  position: "relative",
                  height: 520,
                  opacity: isActive ? 1 : 0.4,
                  transition: "opacity 0.5s ease",
                }}
              >
                {item.backdropUrl && (
                  <Image src={item.backdropUrl} alt="" fill priority={index === 0} sizes="100vw" className="object-cover" />
                )}
                <div className="hero-overlay" />

                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    zIndex: 1,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "flex-end",
                    padding: "32px clamp(16px, 4vw, 64px) 60px",
                    opacity: isActive ? 1 : 0,
                    transform: isActive ? "translateY(0)" : "translateY(10px)",
                    transition: "opacity 0.6s ease, transform 0.6s ease",
                    pointerEvents: isActive ? "auto" : "none",
                  }}
                >
                  <div style={{ maxWidth: 620 }}>
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
                      {item.title}
                    </h1>

                    {item.genres && item.genres.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                        {item.genres.slice(0, 3).map((g) => (
                          <span key={g} className="status-chip">
                            {g}
                          </span>
                        ))}
                      </div>
                    )}

                    {item.metaItems && item.metaItems.length > 0 && (
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
                        {item.metaItems.map((m, i) => (
                          <span key={i}>{m}</span>
                        ))}
                      </div>
                    )}

                    {item.overview && (
                      <p
                        style={{
                          fontSize: 14,
                          lineHeight: 1.6,
                          color: "rgba(255,255,255,0.75)",
                          marginBottom: 20,
                          display: "-webkit-box",
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {item.overview}
                      </p>
                    )}

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                      <a href={item.watchHref} className="btn-square-accent">
                        ▶ Stream Now
                      </a>
                      <WatchlistButton item={item.watchlist} variant="button" />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pagination Dots */}
      <div
        style={{
          position: "absolute",
          bottom: 24,
          left: "clamp(16px, 4vw, 64px)",
          display: "flex",
          gap: 8,
          zIndex: 2,
        }}
      >
        {items.map((_, index) => (
          <button
            key={index}
            onClick={() => emblaApi?.scrollTo(index)}
            aria-label={`Go to slide ${index + 1}`}
            style={{
              width: index === selectedIndex ? 24 : 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: index === selectedIndex ? "var(--accent)" : "rgba(255, 255, 255, 0.4)",
              transition: "all 0.3s ease",
              cursor: "pointer",
              border: "none",
              padding: 0,
            }}
          />
        ))}
      </div>
    </section>
  );
}
