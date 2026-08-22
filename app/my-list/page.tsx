"use client";

import { useEffect, useState } from "react";
import { getWatchlist, WATCHLIST_EVENT, type WatchlistItem } from "@/lib/watchlist";
import MediaCard from "@/components/catalog/MediaCard";

export default function MyListPage() {
  const [items, setItems] = useState<WatchlistItem[]>([]);

  useEffect(() => {
    const sync = () => setItems(getWatchlist());
    sync();
    window.addEventListener(WATCHLIST_EVENT, sync);
    return () => window.removeEventListener(WATCHLIST_EVENT, sync);
  }, []);

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "24px 16px" }}>
      <h1 className="section-heading" style={{ fontSize: 24 }}>My List</h1>

      {items.length === 0 ? (
        <p style={{ color: "var(--text-muted)", padding: "40px 0", textAlign: "center" }}>
          Your list is empty. Tap the heart icon on any title to save it here.
        </p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
            gap: 16,
          }}
        >
          {items.map((item) => (
            <MediaCard
              key={`${item.kind}-${item.id}`}
              item={{ kind: item.kind, id: item.id, title: item.title, poster: item.cover, href: item.href }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
