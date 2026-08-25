"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Search,
  Radio,
  Calendar,
  Clock,
  Flame,
  ChevronRight,
  RefreshCw,
  Trophy,
  CircleDot,
  Play,
} from "lucide-react";
import type { SportsMatch, SportCategory, GroupedMatches } from "@/lib/sports";
import {
  formatMatchTime,
  formatMatchTimeShort,
  formatMatchDate,
} from "@/lib/sports";

interface SportsClientProps {
  initialMatches: GroupedMatches;
  sports: SportCategory[];
  initialSport: string;
}

export default function SportsClient({
  initialMatches,
  sports,
  initialSport,
}: SportsClientProps) {
  const [matches, setMatches] = useState(initialMatches);
  const [activeSport, setActiveSport] = useState(initialSport);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestIdRef = useRef(0);

  const fetchMatches = useCallback(
    async (sport: string, query: string) => {
      const myId = ++requestIdRef.current;
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        if (sport !== "all") params.set("sport", sport);
        const res = await fetch(`/api/sports/matches?${params.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (myId !== requestIdRef.current) return;

        let grouped: GroupedMatches = {
          live: data.live || [],
          today: data.today || [],
          upcoming: data.upcoming || [],
        };

        if (query) {
          const q = query.toLowerCase();
          const filterFn = (m: SportsMatch) =>
            m.title.toLowerCase().includes(q) ||
            m.category.toLowerCase().includes(q) ||
            (m.teams?.home?.name || "").toLowerCase().includes(q) ||
            (m.teams?.away?.name || "").toLowerCase().includes(q);
          grouped = {
            live: grouped.live.filter(filterFn),
            today: grouped.today.filter(filterFn),
            upcoming: grouped.upcoming.filter(filterFn),
          };
        }

        setMatches(grouped);
      } catch (e) {
        if (myId === requestIdRef.current) setError(String(e));
      } finally {
        if (myId === requestIdRef.current) setLoading(false);
      }
    },
    []
  );

  // Refetch on sport change
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchMatches(activeSport, search);
    }, search ? 400 : 0);
    return () => clearTimeout(timer);
  }, [activeSport, search, fetchMatches]);

  const totalMatches =
    matches.live.length + matches.today.length + matches.upcoming.length;

  return (
    <>
      {/* Sport filter pills */}
      <div className="sports-filter-bar">
        <div className="sports-pills-row carousel-track">
          <button
            onClick={() => setActiveSport("all")}
            className={`filter-pill${activeSport === "all" ? " is-active" : ""}`}
          >
            <Trophy size={14} style={{ marginRight: 4, verticalAlign: -2 }} />
            All Sports
          </button>
          {sports.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSport(s.id)}
              className={`filter-pill${activeSport === s.id ? " is-active" : ""}`}
            >
              {s.name}
            </button>
          ))}
        </div>

        <div style={{ position: "relative", flexShrink: 0, width: "100%", maxWidth: 280 }}>
          <input
            type="text"
            placeholder="Search matches..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input"
            style={{ paddingLeft: 36 }}
          />
          <Search
            size={15}
            style={{
              position: "absolute",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
              color: "rgba(255,255,255,0.4)",
              pointerEvents: "none",
            }}
          />
        </div>
      </div>

      {/* Status bar */}
      <div className="sports-status-bar">
        <Radio size={15} style={{ color: "var(--accent)" }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)" }}>
          {loading
            ? "Loading matches..."
            : error
            ? `Error: ${error}`
            : `${totalMatches} MATCHES`}
        </span>
        <button
          onClick={() => fetchMatches(activeSport, search)}
          className="sports-refresh-btn"
          title="Refresh"
        >
          <RefreshCw size={14} className={loading ? "spin" : ""} />
        </button>
      </div>

      {/* Content */}
      {loading && totalMatches === 0 ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
          <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      ) : totalMatches === 0 ? (
        <div className="sports-empty">
          <div className="sports-empty-icon">
            <Search size={28} opacity={0.5} />
          </div>
          <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>No matches found</p>
          <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
            {search
              ? "Try a different search term."
              : "No matches scheduled for this sport right now."}
          </p>
        </div>
      ) : (
        <div className="sports-content">
          {/* LIVE section */}
          {matches.live.length > 0 && (
            <SportsSection
              title="Live Now"
              icon={<CircleDot size={18} className="live-pulse" />}
              matches={matches.live}
              variant="live"
            />
          )}

          {/* TODAY section */}
          {matches.today.length > 0 && (
            <SportsSection
              title="Today"
              icon={<Calendar size={18} />}
              matches={matches.today}
              variant="today"
            />
          )}

          {/* UPCOMING section */}
          {matches.upcoming.length > 0 && (
            <SportsSection
              title="Upcoming"
              icon={<Clock size={18} />}
              matches={matches.upcoming}
              variant="upcoming"
            />
          )}
        </div>
      )}
    </>
  );
}

function SportsSection({
  title,
  icon,
  matches,
  variant,
}: {
  title: string;
  icon: React.ReactNode;
  matches: SportsMatch[];
  variant: "live" | "today" | "upcoming";
}) {
  return (
    <div className={`sports-section sports-section--${variant}`}>
      <div className="sports-section-header">
        <div className="sports-section-title">
          {icon}
          <span>{title}</span>
          <span className="sports-section-count">{matches.length}</span>
        </div>
      </div>
      <div className="sports-match-grid">
        {matches.map((m) => (
          <MatchCard key={m.id} match={m} variant={variant} />
        ))}
      </div>
    </div>
  );
}

function MatchCard({
  match,
  variant,
}: {
  match: SportsMatch;
  variant: "live" | "today" | "upcoming";
}) {
  const homeName = match.teams?.home?.name || match.title.split(" vs ")[0] || match.title;
  const awayName = match.teams?.away?.name || match.title.split(" vs ")[1] || "";
  const isLive = variant === "live";
  const hasStreams = match.sources.length > 0;
  const watchUrl = hasStreams
    ? `/sports/watch?source=${encodeURIComponent(match.sources[0].source)}&id=${encodeURIComponent(match.sources[0].id)}&title=${encodeURIComponent(match.title)}`
    : null;

  const cardContent = (
    <>
      {/* Top bar: sport + status */}
      <div className="sports-card-top">
        <span className="sports-card-sport">{match.category}</span>
        {isLive ? (
          <span className="sports-card-live-badge">
            <span className="live-badge-dot" />
            LIVE
          </span>
        ) : (
          <span className="sports-card-time">
            {formatMatchDate(match.date)} · {formatMatchTimeShort(match.date)}
          </span>
        )}
      </div>

      {/* Teams */}
      <div className="sports-card-teams">
        <div className="sports-card-team">
          <div className="sports-card-team-badge">
            {match.teams?.home?.badge ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/sports/badge?badge=${encodeURIComponent(match.teams.home.badge)}`}
                alt={homeName}
                loading="lazy"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <span className="sports-card-team-initial">
                {homeName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <span className="sports-card-team-name">{homeName}</span>
        </div>

        <div className="sports-card-vs">VS</div>

        <div className="sports-card-team">
          <div className="sports-card-team-badge">
            {match.teams?.away?.badge ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/sports/badge?badge=${encodeURIComponent(match.teams.away.badge)}`}
                alt={awayName}
                loading="lazy"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <span className="sports-card-team-initial">
                {awayName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <span className="sports-card-team-name">{awayName}</span>
        </div>
      </div>

      {/* Bottom bar: countdown + stream count */}
      <div className="sports-card-bottom">
        <span className="sports-card-countdown">
          {isLive ? (
            <>
              <Flame size={12} style={{ verticalAlign: -1, marginRight: 3 }} />
              {formatMatchTime(match.date)}
            </>
          ) : (
            <>
              <Clock size={12} style={{ verticalAlign: -1, marginRight: 3 }} />
              {formatMatchTime(match.date)}
            </>
          )}
        </span>
        {match.sources.length > 0 && (
          <span className="sports-card-streams">
            {match.sources.length} source{match.sources.length > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {match.popular && (
        <div className="sports-card-popular">
          <Flame size={10} />
          <span>POPULAR</span>
        </div>
      )}

      {hasStreams && (
        <div className="sports-card-play-overlay">
          <Play size={24} fill="currentColor" />
        </div>
      )}
    </>
  );

  if (watchUrl) {
    return (
      <a href={watchUrl} className={`sports-card sports-card--link${isLive ? " sports-card--live" : ""}`}>
        {cardContent}
      </a>
    );
  }

  return (
    <div className={`sports-card${isLive ? " sports-card--live" : ""}`}>
      {cardContent}
    </div>
  );
}
