"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { SORT_OPTIONS, type SortKey } from "@/lib/tmdb-client";
import { Trash2 } from "lucide-react";

type CatalogMediaType = "movie" | "tv" | "anime";

interface GenreOption {
  id: string;
  name: string;
}

const YEARS = Array.from({ length: 30 }, (_, i) => new Date().getFullYear() - i);
const SEASONS = ["WINTER", "SPRING", "SUMMER", "FALL"];
const FORMATS = ["TV", "TV_SHORT", "MOVIE", "SPECIAL", "OVA", "ONA", "MUSIC"];
const STATUSES = ["FINISHED", "RELEASING", "NOT_YET_RELEASED", "CANCELLED", "HIATUS"];

export default function FilterBar({ mediaType }: { mediaType: CatalogMediaType }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [genres, setGenres] = useState<GenreOption[]>([]);
  const [tags, setTags] = useState<string[]>([]);

  // State for all filter inputs
  const [filters, setFilters] = useState({
    genres: searchParams.get("genres") || "",
    tags: searchParams.get("tags") || "",
    format: searchParams.get("format") || "",
    year: searchParams.get("year") || "",
    season: searchParams.get("season") || "",
    status: searchParams.get("status") || "",
    sort: searchParams.get("sort") || "popularity",
    minDuration: searchParams.get("minDuration") || "",
    maxDuration: searchParams.get("maxDuration") || "",
    minEpisodes: searchParams.get("minEpisodes") || "",
    maxEpisodes: searchParams.get("maxEpisodes") || "",
    search: searchParams.get("search") || "",
  });

  // Sync state when URL changes (e.g. back button)
  useEffect(() => {
    setFilters({
      genres: searchParams.get("genres") || "",
      tags: searchParams.get("tags") || "",
      format: searchParams.get("format") || "",
      year: searchParams.get("year") || "",
      season: searchParams.get("season") || "",
      status: searchParams.get("status") || "",
      sort: searchParams.get("sort") || "popularity",
      minDuration: searchParams.get("minDuration") || "",
      maxDuration: searchParams.get("maxDuration") || "",
      minEpisodes: searchParams.get("minEpisodes") || "",
      maxEpisodes: searchParams.get("maxEpisodes") || "",
      search: searchParams.get("search") || "",
    });
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        if (mediaType === "anime") {
          const [resGenres, resTags] = await Promise.all([
            fetch("/api/anilist/genres").then((r) => r.json()),
            fetch("/api/anilist/tags").then((r) => r.json()),
          ]);
          if (!cancelled) {
            setGenres((resGenres.genres || []).map((name: string) => ({ id: name, name })));
            setTags((resTags.tags || []).map((t: any) => t.name));
          }
        } else {
          const res = await fetch(`/api/tmdb/genre/${mediaType}/list`);
          const data = await res.json();
          if (!cancelled) setGenres((data.genres || []).map((g: { id: number; name: string }) => ({ id: String(g.id), name: g.name })));
          if (!cancelled) setTags([]);
        }
      } catch {
        if (!cancelled) {
          setGenres([]);
          setTags([]);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [mediaType]);

  const handleChange = (key: keyof typeof filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const applyFilters = () => {
    const params = new URLSearchParams();
    // Only set params that have a value and are not default
    Object.entries(filters).forEach(([key, value]) => {
      if (value && !(key === "sort" && value === "popularity")) {
        params.set(key, value);
      }
    });
    // Add type param if it's there
    const typeParam = searchParams.get("type");
    if (typeParam) params.set("type", typeParam);

    router.push(`${pathname}?${params.toString()}`);
  };

  const clearFilters = () => {
    setFilters({
      genres: "",
      tags: "",
      format: "",
      year: "",
      season: "",
      status: "",
      sort: "popularity",
      minDuration: "",
      maxDuration: "",
      minEpisodes: "",
      maxEpisodes: "",
      search: "",
    });
    const params = new URLSearchParams();
    const typeParam = searchParams.get("type");
    if (typeParam) params.set("type", typeParam);
    router.push(`${pathname}?${params.toString()}`);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    applyFilters();
  };

  const isAnime = mediaType === "anime";

  const selectStyle = {
    padding: "10px 12px",
    background: "var(--card)",
    border: "1px solid var(--border)",
    color: "var(--text)",
    fontSize: 14,
    borderRadius: 4,
    width: "100%",
  };

  const inputStyle = {
    ...selectStyle,
  };

  const labelStyle = {
    display: "block",
    fontSize: 12,
    fontWeight: 600,
    color: "rgba(255,255,255,0.7)",
    marginBottom: 6,
    textTransform: "capitalize" as const,
  };

  return (
    <form onSubmit={onSubmit} style={{ marginBottom: 32 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
          gap: "clamp(8px, 2vw, 16px)",
          alignItems: "end",
        }}
      >
        <div>
          <label style={labelStyle}>Genre</label>
          <select style={selectStyle} value={filters.genres} onChange={(e) => handleChange("genres", e.target.value)}>
            <option value="">Any</option>
            {genres.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>

        {isAnime && (
          <>
            <div>
              <label style={labelStyle}>Tags</label>
              <select style={selectStyle} value={filters.tags} onChange={(e) => handleChange("tags", e.target.value)}>
                <option value="">Any</option>
                {tags.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Format</label>
              <select style={selectStyle} value={filters.format} onChange={(e) => handleChange("format", e.target.value)}>
                <option value="">Any</option>
                {FORMATS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        <div>
          <label style={labelStyle}>Year</label>
          <select style={selectStyle} value={filters.year} onChange={(e) => handleChange("year", e.target.value)}>
            <option value="">Any</option>
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        {isAnime && (
          <>
            <div>
              <label style={labelStyle}>Season</label>
              <select style={selectStyle} value={filters.season} onChange={(e) => handleChange("season", e.target.value)}>
                <option value="">Any</option>
                {SEASONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select style={selectStyle} value={filters.status} onChange={(e) => handleChange("status", e.target.value)}>
                <option value="">Any</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        <div>
          <label style={labelStyle}>Sort By</label>
          <select style={selectStyle} value={filters.sort} onChange={(e) => handleChange("sort", e.target.value)}>
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={labelStyle}>Min Duration (min)</label>
          <input
            type="number"
            placeholder="0"
            style={inputStyle}
            value={filters.minDuration}
            onChange={(e) => handleChange("minDuration", e.target.value)}
          />
        </div>

        <div>
          <label style={labelStyle}>Max Duration (min)</label>
          <input
            type="number"
            placeholder="Any"
            style={inputStyle}
            value={filters.maxDuration}
            onChange={(e) => handleChange("maxDuration", e.target.value)}
          />
        </div>

        {isAnime && (
          <>
            <div>
              <label style={labelStyle}>Min Episodes</label>
              <input
                type="number"
                placeholder="0"
                style={inputStyle}
                value={filters.minEpisodes}
                onChange={(e) => handleChange("minEpisodes", e.target.value)}
              />
            </div>

            <div>
              <label style={labelStyle}>Max Episodes</label>
              <input
                type="number"
                placeholder="Any"
                style={inputStyle}
                value={filters.maxEpisodes}
                onChange={(e) => handleChange("maxEpisodes", e.target.value)}
              />
            </div>
          </>
        )}

        <div style={{ gridColumn: "span 2" }}>
          <label style={labelStyle}>Search</label>
          <div style={{ display: "flex", gap: 12 }}>
            <input
              type="text"
              placeholder={`Search ${mediaType === "anime" ? "anime" : mediaType}...`}
              style={{ ...inputStyle, flex: 1 }}
              value={filters.search}
              onChange={(e) => handleChange("search", e.target.value)}
            />
            <button
              type="submit"
              className="btn-square-accent"
              style={{ padding: "10px 16px", borderRadius: 4, height: 40 }}
            >
              Filter
            </button>
            <button
              type="button"
              className="btn-ghost"
              style={{ padding: "10px 16px", borderRadius: 4, height: 40, whiteSpace: "nowrap" }}
              onClick={clearFilters}
            >
              <Trash2 size={16} /> Clear
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
