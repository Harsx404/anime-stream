"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Search, Heart, X, Settings, Menu } from "lucide-react";
import { anton } from "@/lib/fonts";
import { getWatchlistCount, WATCHLIST_EVENT } from "@/lib/watchlist";

const NAV_LINKS = [
  { href: "/home", label: "Home" },
  { href: "/movies", label: "Movies" },
  { href: "/tv", label: "TV Shows" },
  { href: "/anime", label: "Anime" },
  { href: "/live", label: "Live TV" },
  { href: "/sports", label: "Sports" },
  { href: "/browse", label: "Browse" },
];

export default function Navbar() {
  const [query, setQuery] = useState("");
  const [searchType, setSearchType] = useState<"anime" | "movie" | "tv">("anime");
  const [searchOpen, setSearchOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [watchlistCount, setWatchlistCount] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

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
    <>
    <nav
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        gap: "clamp(8px, 3vw, 24px)",
        padding: "14px clamp(12px, 4vw, 24px)",
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

      <div className="nav-links-desktop" style={{ display: "flex", gap: 20, flex: 1 }}>
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

      <button
        className="nav-hamburger"
        onClick={() => setMobileMenuOpen((v) => !v)}
        aria-label="Menu"
        style={{
          display: "none",
          alignItems: "center",
          justifyContent: "center",
          width: 36,
          height: 36,
          background: "transparent",
          border: "1px solid var(--ring)",
          color: "var(--text)",
          cursor: "pointer",
          flex: 1,
          maxWidth: 36,
        }}
      >
        {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        {searchOpen ? (
          <form
            onSubmit={onSearch}
            style={{
              display: "flex",
              alignItems: "stretch",
              height: 36,
              gap: 0,
              border: `1px solid ${isFocused ? "var(--text)" : "var(--ring)"}`,
              transition: "border-color 0.2s ease",
              flex: 1,
              minWidth: 0,
              maxWidth: "min(280px, 55vw)",
            }}
            onFocus={() => setIsFocused(true)}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setIsFocused(false);
              }
            }}
          >
            <select
              value={searchType}
              onChange={(e) => setSearchType(e.target.value as "anime" | "movie" | "tv")}
              style={{
                padding: "0 10px",
                border: "none",
                borderRight: "1px solid var(--ring)",
                background: "var(--card)",
                color: "var(--text)",
                fontSize: 12,
                outline: "none",
                flexShrink: 0,
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
                width: "100%",
                minWidth: 0,
                padding: "0 12px",
                border: "none",
                background: "var(--card)",
                color: "var(--text)",
                fontSize: 13,
                outline: "none"
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
                padding: "0 10px",
                border: "none",
                background: "var(--card)",
                color: "var(--text-muted)",
                cursor: "pointer",
                outline: "none",
                flexShrink: 0,
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

        <a
          href="/settings"
          aria-label="Settings"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 36,
            height: 36,
            border: "1px solid var(--ring)",
            color: pathname === "/settings" ? "var(--accent)" : "var(--text)",
            transition: "border-color 0.2s ease",
          }}
        >
          <Settings size={16} />
        </a>
      </div>
    </nav>

      {mobileMenuOpen && (
        <div
          className="nav-mobile-menu"
          style={{
            display: "none",
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 49,
            paddingTop: 64,
            paddingBottom: 24,
            paddingLeft: "clamp(12px, 4vw, 24px)",
            paddingRight: "clamp(12px, 4vw, 24px)",
            background: "rgba(0,0,0,0.97)",
            backdropFilter: "blur(12px)",
            borderBottom: "1px solid var(--ring)",
            flexDirection: "column",
            gap: 0,
          }}
        >
          {NAV_LINKS.map((link) => {
            const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <a
                key={link.href}
                href={link.href}
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  letterSpacing: 0.5,
                  textTransform: "uppercase",
                  color: active ? "#fff" : "var(--text-muted)",
                  padding: "14px 0",
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                  borderLeft: active ? "3px solid var(--accent)" : "3px solid transparent",
                  paddingLeft: 12,
                }}
              >
                {link.label}
              </a>
            );
          })}
        </div>
      )}
    </>
  );
}
