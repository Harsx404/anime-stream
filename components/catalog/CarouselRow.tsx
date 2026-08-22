"use client";

import { useRef, useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import MediaCard from "@/components/catalog/MediaCard";
import type { CatalogItem } from "@/components/catalog/toCatalogItem";

interface Props {
  title: string;
  accentWord?: string;
  items: CatalogItem[];
  viewMoreHref?: string;
}

export default function CarouselRow({ title, accentWord, items, viewMoreHref }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  function updateArrows() {
    const el = trackRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }

  useEffect(() => {
    updateArrows();
  }, [items]);

  function scrollBy(dir: 1 | -1) {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: "smooth" });
    setTimeout(updateArrows, 350);
  }

  if (items.length === 0) return null;

  return (
    <section style={{ marginBottom: 40 }} className="hero-content-anim">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h2 className="section-heading" style={{ marginBottom: 0 }}>
          {title} {accentWord && <span className="accent">{accentWord}</span>}
        </h2>
        {viewMoreHref && (
          <a href={viewMoreHref} style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)" }}>
            View More
          </a>
        )}
      </div>

      <div className="carousel-row">
        <button
          className="carousel-arrow arrow-left"
          onClick={() => scrollBy(-1)}
          disabled={!canLeft}
          aria-label="Scroll left"
        >
          <ChevronLeft size={22} />
        </button>

        <div className="carousel-track" ref={trackRef} onScroll={updateArrows}>
          {items.map((item) => (
            <MediaCard key={`${item.kind}-${item.id}`} item={item} width={124} />
          ))}
        </div>

        <button
          className="carousel-arrow arrow-right"
          onClick={() => scrollBy(1)}
          disabled={!canRight}
          aria-label="Scroll right"
        >
          <ChevronRight size={22} />
        </button>
      </div>
    </section>
  );
}
