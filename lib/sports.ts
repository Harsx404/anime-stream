import { dnsFetch } from "./dns-fix";

const API_BASE = "https://streamed.pk/api";

export interface SportCategory {
  id: string;
  name: string;
}

export interface MatchSource {
  source: string;
  id: string;
}

export interface MatchTeam {
  name: string;
  badge?: string;
}

export interface SportsMatch {
  id: string;
  title: string;
  category: string;
  date: number;
  popular: boolean;
  teams?: {
    home: MatchTeam;
    away: MatchTeam;
  };
  sources: MatchSource[];
}

export interface MatchStream {
  id: string;
  streamNo: number;
  language: string;
  hd: boolean;
  embedUrl: string;
  source: string;
}

let sportsCache: { sports: SportCategory[]; expiresAt: number } | null = null;
const CACHE_TTL = 600_000; // 10 minutes

export async function getSports(): Promise<SportCategory[]> {
  const now = Date.now();
  if (sportsCache && sportsCache.expiresAt > now) {
    return sportsCache.sports;
  }
  const res = await dnsFetch(`${API_BASE}/sports`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Failed to fetch sports: ${res.status}`);
  const data = await res.json();
  const sports: SportCategory[] = (data || []).map((s: any) => ({
    id: s.id,
    name: s.name,
  }));
  sportsCache = { sports, expiresAt: now + CACHE_TTL };
  return sports;
}

export async function getLiveMatches(): Promise<SportsMatch[]> {
  const res = await dnsFetch(`${API_BASE}/matches/live`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Failed to fetch live matches: ${res.status}`);
  const data = await res.json();
  return (data || []).map(normalizeMatch);
}

export async function getMatchesBySport(sport: string): Promise<SportsMatch[]> {
  const res = await dnsFetch(`${API_BASE}/matches/${encodeURIComponent(sport)}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Failed to fetch matches for ${sport}: ${res.status}`);
  const data = await res.json();
  return (data || []).map(normalizeMatch);
}

export async function getAllMatches(): Promise<SportsMatch[]> {
  const sports = await getSports();
  const results = await Promise.all(
    sports.map((s) =>
      getMatchesBySport(s.id).catch(() => [] as SportsMatch[])
    )
  );
  // Flatten and deduplicate by id
  const seen = new Set<string>();
  const all: SportsMatch[] = [];
  for (const matches of results) {
    for (const m of matches) {
      if (!seen.has(m.id)) {
        seen.add(m.id);
        all.push(m);
      }
    }
  }
  return all;
}

export async function getMatchStreams(
  source: string,
  id: string
): Promise<MatchStream[]> {
  const res = await dnsFetch(
    `${API_BASE}/stream/${encodeURIComponent(source)}/${encodeURIComponent(id)}`,
    { headers: { Accept: "application/json" } }
  );
  if (!res.ok) throw new Error(`Failed to fetch streams: ${res.status}`);
  const data = await res.json();
  return (data || []).map((s: any) => ({
    id: s.id,
    streamNo: s.streamNo,
    language: s.language,
    hd: s.hd,
    embedUrl: s.embedUrl,
    source: s.source,
  }));
}

export interface GroupedMatches {
  live: SportsMatch[];
  today: SportsMatch[];
  upcoming: SportsMatch[];
}

export function groupMatchesByStatus(matches: SportsMatch[]): GroupedMatches {
  const now = Date.now();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);

  const live: SportsMatch[] = [];
  const today: SportsMatch[] = [];
  const upcoming: SportsMatch[] = [];

  for (const m of matches) {
    if (!m.date) {
      upcoming.push(m);
      continue;
    }
    // "Live" = within 2 hours of start time (matches typically last 1.5-2h)
    if (Math.abs(m.date - now) < 2 * 60 * 60 * 1000 && m.date <= now + 30 * 60 * 1000) {
      live.push(m);
    } else if (m.date >= startOfToday.getTime() && m.date < endOfToday.getTime()) {
      today.push(m);
    } else if (m.date > now) {
      upcoming.push(m);
    }
  }

  // Sort by date ascending
  live.sort((a, b) => a.date - b.date);
  today.sort((a, b) => a.date - b.date);
  upcoming.sort((a, b) => a.date - b.date);

  return { live, today, upcoming };
}

function normalizeMatch(m: any): SportsMatch {
  return {
    id: m.id,
    title: m.title,
    category: m.category,
    date: m.date,
    popular: m.popular || false,
    teams: m.teams
      ? {
          home: { name: m.teams.home?.name || "", badge: m.teams.home?.badge },
          away: { name: m.teams.away?.name || "", badge: m.teams.away?.badge },
        }
      : undefined,
    sources: (m.sources || []).map((s: any) => ({
      source: s.source,
      id: s.id,
    })),
  };
}

export function formatMatchTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = timestamp - now.getTime();
  const diffMin = Math.round(diffMs / 60000);
  const diffHr = Math.round(diffMin / 60);
  const diffDay = Math.round(diffHr / 24);

  if (Math.abs(diffMin) < 1) return "Now";
  if (diffMin > 0 && diffMin < 60) return `In ${diffMin}m`;
  if (diffMin < 0 && diffMin > -120) return `${Math.abs(diffMin)}m ago`;
  if (diffHr > 0 && diffHr < 24) return `In ${diffHr}h`;
  if (diffHr < 0 && diffHr > -48) return `${Math.abs(diffHr)}h ago`;
  if (diffDay > 0 && diffDay < 7) return `In ${diffDay}d`;

  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatMatchTimeShort(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatMatchDate(timestamp: number): string {
  const date = new Date(timestamp);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const matchDay = new Date(date);
  matchDay.setHours(0, 0, 0, 0);
  const diffDays = Math.round((matchDay.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  if (diffDays > 0 && diffDays < 7) {
    return date.toLocaleDateString("en-US", { weekday: "long" });
  }
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
