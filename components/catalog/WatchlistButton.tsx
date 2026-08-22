"use client";

import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { toggleWatchlist, isInWatchlist, WATCHLIST_EVENT, type WatchlistItem } from "@/lib/watchlist";

interface Props {
  item: Omit<WatchlistItem, "addedAt">;
  variant?: "icon" | "button";
  size?: number;
}

export default function WatchlistButton({ item, variant = "icon", size = 16 }: Props) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    setActive(isInWatchlist(item.kind, item.id));
    const sync = () => setActive(isInWatchlist(item.kind, item.id));
    window.addEventListener(WATCHLIST_EVENT, sync);
    return () => window.removeEventListener(WATCHLIST_EVENT, sync);
  }, [item.kind, item.id]);

  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setActive(toggleWatchlist(item));
  }

  if (variant === "button") {
    return (
      <button
        onClick={onClick}
        className="btn-ghost"
      >
        <Heart size={16} fill={active ? "currentColor" : "none"} style={{ color: active ? "var(--accent)" : undefined }} />
        {active ? "In My List" : "Add to My List"}
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      aria-label={active ? "Remove from My List" : "Add to My List"}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: size + 20,
        height: size + 20,
        background: "rgba(0,0,0,0.6)",
        border: "1px solid var(--ring)",
        color: active ? "var(--accent)" : "#fff",
        cursor: "pointer",
        borderRadius: "100px",
        transition: "border-color 0.2s ease",
      }}
    >
      <Heart size={size} fill={active ? "currentColor" : "none"} />
    </button>
  );
}
