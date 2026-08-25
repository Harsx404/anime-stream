"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Search, Radio, X } from "lucide-react";
import type { IPTVChannel } from "@/lib/iptv";
import FilterDropdown from "./FilterDropdown";

interface ChannelGridProps {
  initialChannels: IPTVChannel[];
  initialTotal: number;
  categories: { id: string; name: string; count?: number }[];
  countries: { code: string; name: string; count: number }[];
  initialCategory: string;
  initialCountry: string;
  pageSize: number;
}

export default function ChannelGrid({
  initialChannels,
  initialTotal,
  categories,
  countries,
  initialCategory,
  initialCountry,
  pageSize,
}: ChannelGridProps) {
  const [channels, setChannels] = useState(initialChannels);
  const [total, setTotal] = useState(initialTotal);
  const [hasMore, setHasMore] = useState(initialChannels.length < initialTotal);
  const [activeCategory, setActiveCategory] = useState(initialCategory);
  const [activeCountry, setActiveCountry] = useState(initialCountry);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  // Refs mirror latest values so the intersection observer callback (set up once)
  // never fetches against a stale category/country/search/offset.
  const categoryRef = useRef(activeCategory);
  const countryRef = useRef(activeCountry);
  const searchRef = useRef(search);
  const offsetRef = useRef(initialChannels.length);
  const hasMoreRef = useRef(hasMore);
  const loadingRef = useRef(false);
  const requestIdRef = useRef(0);

  categoryRef.current = activeCategory;
  countryRef.current = activeCountry;
  searchRef.current = search;
  hasMoreRef.current = hasMore;

  const fetchPage = useCallback(async (offset: number, replace: boolean) => {
    const myRequestId = ++requestIdRef.current;
    const params = new URLSearchParams();
    if (searchRef.current) params.set("search", searchRef.current);
    params.set("category", categoryRef.current);
    params.set("country", countryRef.current);
    params.set("offset", String(offset));
    params.set("limit", String(pageSize));

    if (replace) setLoading(true);
    else setLoadingMore(true);
    setError("");
    try {
      const res = await fetch(`/api/iptv/channels?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (myRequestId !== requestIdRef.current) return; // stale response
      setChannels((prev) => (replace ? data.channels || [] : [...prev, ...(data.channels || [])]));
      setTotal(data.total ?? 0);
      setHasMore(Boolean(data.hasMore));
      offsetRef.current = replace ? (data.channels || []).length : offsetRef.current + (data.channels || []).length;
    } catch (e) {
      if (myRequestId === requestIdRef.current) setError(String(e));
    } finally {
      if (myRequestId === requestIdRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [pageSize]);

  // Reset + refetch first page whenever a filter or (debounced) search changes.
  const isFirstRun = useRef(true);
  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    const timer = setTimeout(() => {
      offsetRef.current = 0;
      fetchPage(0, true);
    }, search ? 400 : 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory, activeCountry, search]);

  // Infinite scroll sentinel
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMoreRef.current && !loadingRef.current) {
          loadingRef.current = true;
          fetchPage(offsetRef.current, false).finally(() => {
            loadingRef.current = false;
          });
        }
      },
      { rootMargin: "600px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [fetchPage]);

  const categoryOptions = categories.map((c) => ({ id: c.id, name: c.name, count: c.count }));
  const countryOptions = countries.map((c) => ({ id: c.code, name: c.name, count: c.count }));
  const activeCategoryName = categories.find((c) => c.id === activeCategory)?.name;
  const activeCountryName = countries.find((c) => c.code === activeCountry)?.name;
  const hasActiveFilters = activeCategory !== "all" || activeCountry !== "all";

  return (
    <>
      {/* Filters + search */}
      <div style={{ display: "flex", gap: 16, marginBottom: 16, alignItems: "center", flexWrap: "wrap", justifyContent: "space-between" }}>
        <div className="live-filters-row">
          <FilterDropdown
            label="Category"
            allLabel="All Categories"
            value={activeCategory}
            options={categoryOptions}
            onChange={setActiveCategory}
          />
          <FilterDropdown
            label="Country"
            allLabel="All Countries"
            value={activeCountry}
            options={countryOptions}
            onChange={setActiveCountry}
          />
        </div>
        <div style={{ position: "relative", flexShrink: 0, width: "100%", maxWidth: 300 }}>
          <input
            type="text"
            placeholder="Search channels..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              padding: "10px 16px 10px 40px",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid var(--border)",
              color: "var(--text)",
              fontSize: 14,
              borderRadius: 100,
              width: "100%",
              outline: "none",
              transition: "border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease",
            }}
            onFocus={(e) => {
              e.target.style.background = "rgba(255,255,255,0.08)";
              e.target.style.borderColor = "var(--accent)";
              e.target.style.boxShadow = "0 0 0 3px rgba(225,29,60,0.15)";
            }}
            onBlur={(e) => {
              e.target.style.background = "rgba(255,255,255,0.05)";
              e.target.style.borderColor = "var(--border)";
              e.target.style.boxShadow = "none";
            }}
          />
          <Search
            size={16}
            style={{
              position: "absolute",
              left: 14,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-muted)",
              pointerEvents: "none"
            }}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              style={{
                position: "absolute",
                right: 10,
                top: "50%",
                transform: "translateY(-50%)",
                background: "rgba(255,255,255,0.1)",
                border: "none",
                color: "#fff",
                cursor: "pointer",
                padding: 4,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Active filter chips */}
      {hasActiveFilters && (
        <div className="live-active-filters" style={{ marginBottom: 20 }}>
          {activeCategory !== "all" && (
            <span className="live-active-filter-chip">
              {activeCategoryName || activeCategory}
              <button onClick={() => setActiveCategory("all")} aria-label="Clear category filter">
                <X size={10} />
              </button>
            </span>
          )}
          {activeCountry !== "all" && (
            <span className="live-active-filter-chip">
              {activeCountryName || activeCountry}
              <button onClick={() => setActiveCountry("all")} aria-label="Clear country filter">
                <X size={10} />
              </button>
            </span>
          )}
        </div>
      )}

      {/* Status bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
        <Radio size={16} style={{ color: "var(--accent)" }} />
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-muted)", letterSpacing: 0.5 }}>
          {loading
            ? "Loading channels..."
            : error
            ? `Error: ${error}`
            : `SHOWING ${channels.length} OF ${total} CHANNELS`}
        </span>
      </div>

      {/* Channel grid */}
      {loading && channels.length === 0 ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
          <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      ) : channels.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 20px", color: "var(--text-muted)" }}>
          <div style={{ width: 64, height: 64, margin: "0 auto 16px", background: "rgba(255,255,255,0.05)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Search size={28} opacity={0.5} />
          </div>
          <p style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: "#fff" }}>No channels found</p>
          <p style={{ fontSize: 14 }}>We couldn't find any channels matching your criteria.</p>
        </div>
      ) : (
        <>
          <div className="live-channel-grid">
            {channels.map((ch) => (
              <a key={ch.id} href={`/live/${ch.id}`} className="live-channel-card">
                <div className="live-channel-card-thumb">
                  {ch.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={ch.logo}
                      alt={ch.name}
                      loading="lazy"
                      decoding="async"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "rgba(255,255,255,0.2)",
                        fontSize: 48,
                        fontWeight: 800,
                      }}
                    >
                      {ch.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="live-channel-card-overlay">
                    <div className="live-badge">
                      <span className="live-badge-dot" />
                      LIVE
                    </div>
                    <div className="live-channel-play-btn">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                        <path d="M5 3L19 12L5 21V3Z" />
                      </svg>
                    </div>
                  </div>
                </div>
                <div className="live-channel-card-info">
                  <p className="live-channel-card-name">{ch.name}</p>
                  <div className="live-channel-card-meta">
                    <span className="live-channel-card-country" title={ch.country}>{ch.country}</span>
                    {ch.categories.slice(0, 2).map((cat) => (
                      <span key={cat} className="live-channel-card-tag">{cat}</span>
                    ))}
                  </div>
                </div>
              </a>
            ))}
          </div>

          {hasMore && (
            <div className="live-load-more-sentinel" ref={sentinelRef}>
              {loadingMore && <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin" />}
            </div>
          )}
        </>
      )}
    </>
  );
}
