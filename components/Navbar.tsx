"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Search, Heart, X } from "lucide-react";
import { anton } from "@/lib/fonts";
import { getWatchlistCount, WATCHLIST_EVENT } from "@/lib/watchlist";

const NAV_LINKS = [
  { href: "/home", label: "Home" },
  { href: "/movies", label: "Movies" },
  { href: "/tv", label: "TV Shows" },
  { href: "/anime", label: "Anime" },
  { href: "/browse", label: "Browse" },
];

export default function Navbar() {
  const [query, setQuery] = useState("");
  const [searchType, setSearchType] = useState<"anime" | "movie" | "tv">("anime");
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [watchlistCount, setWatchlistCount] = useState(0);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const sync = () => setWatchlistCount(getWatchlistCount());
    sync();
    window.addEventListener(WATCHLIST_EVENT, sync);
    return () => window.removeEventListener(WATCHLIST_EVENT, sync);
  }, []);

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    router.push(`/search?type=${searchType}&q=${encodeURIComponent(query.trim())}`);
    setSearchOpen(false);
    setQuery("");
  }

  return (
    <nav
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        gap: 24,
        padding: "14px 24px",
        borderBottom: `1px solid ${scrolled ? "var(--ring)" : "transparent"}`,
        background: scrolled ? "rgba(0,0,0,0.92)" : "rgba(0,0,0,0.0)",
        backdropFilter: scrolled ? "blur(12px)" : "none",
        transition: "background 0.3s ease, border-color 0.3s ease, backdrop-filter 0.3s ease",
      }}
    >
      <a href="/home" className={anton.className} style={{ fontSize: 22, letterSpacing: 1, flexShrink: 0 }}>
        <span style={{ color: "#fff" }}>KINO</span>
        <span style={{ color: "var(--accent)" }}>VA</span>
      </a>

      <div style={{ display: "flex", gap: 20, flex: 1 }}>
        {NAV_LINKS.map((link) => {
          const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
          return (
            <a
              key={link.href}
              href={link.href}
              style={{
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: 0.5,
                textTransform: "uppercase",
                color: active ? "#fff" : "var(--text-muted)",
                paddingBottom: 4,
                borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
              }}
            >
              {link.label}
            </a>
          );
        })}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        {searchOpen ? (
          <form onSubmit={onSearch} style={{ display: "flex", alignItems: "center", gap: 0 }}>
            <select
              value={searchType}
              onChange={(e) => setSearchType(e.target.value as "anime" | "movie" | "tv")}
              style={{
                padding: "7px 6px",
                border: "1px solid var(--ring)",
                borderRight: "none",
                background: "var(--card)",
                color: "var(--text)",
                fontSize: 12,
              }}
            >
              <option value="anime">Anime</option>
              <option value="movie">Movies</option>
              <option value="tv">TV</option>
            </select>
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
              style={{
                width: 200,
                padding: "7px 10px",
                border: "1px solid var(--ring)",
                borderLeft: "none",
                borderRight: "none",
                background: "var(--card)",
                color: "var(--text)",
                fontSize: 13,
              }}
            />
            <button
              type="button"
              onClick={() => setSearchOpen(false)}
              aria-label="Close search"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "8px 10px",
                border: "1px solid var(--ring)",
                background: "var(--card)",
                color: "var(--text-muted)",
                cursor: "pointer",
              }}
            >
              <X size={14} />
            </button>
          </form>
        ) : (
          <button
            onClick={() => setSearchOpen(true)}
            aria-label="Search"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 36,
              height: 36,
              background: "transparent",
              border: "1px solid var(--ring)",
              color: "var(--text)",
              cursor: "pointer",
              transition: "border-color 0.2s ease",
            }}
          >
            <Search size={16} />
          </button>
        )}

        <a
          href="/my-list"
          aria-label="My List"
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 36,
            height: 36,
            border: "1px solid var(--ring)",
            color: pathname === "/my-list" ? "var(--accent)" : "var(--text)",
            transition: "border-color 0.2s ease",
          }}
        >
          <Heart size={16} fill={watchlistCount > 0 ? "currentColor" : "none"} />
          {watchlistCount > 0 && (
            <span
              style={{
                position: "absolute",
                top: -6,
                right: -6,
                minWidth: 16,
                height: 16,
                padding: "0 3px",
                background: "var(--accent)",
                color: "#fff",
                fontSize: 10,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 100,
              }}
            >
              {watchlistCount}
            </span>
          )}
        </a>
      </div>
    </nav>
  );
}
