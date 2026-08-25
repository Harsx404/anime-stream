import { dnsFetch } from "./dns-fix";

const API_BASE = "https://dearbulut.github.io/iptv/api/v1";

export interface IPTVStream {
  url: string;
  quality: string | null;
  label?: string;
}

export interface IPTVChannel {
  id: string;
  name: string;
  country: string;
  categories: string[];
  logo?: string;
  online: boolean;
  streams: IPTVStream[];
  guides?: { title?: string; description?: string }[];
}

export interface IPTVCategory {
  id: string;
  name: string;
  count?: number;
}

let channelCache: { channels: IPTVChannel[]; expiresAt: number } | null = null;
const CACHE_TTL = 300_000; // 5 minutes

export async function getAllChannels(forceRefresh = false): Promise<IPTVChannel[]> {
  const now = Date.now();
  if (!forceRefresh && channelCache && channelCache.expiresAt > now) {
    return channelCache.channels;
  }

  const res = await dnsFetch(`${API_BASE}/channels.json`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Failed to fetch channels: ${res.status}`);
  const data = await res.json();
  const channels: IPTVChannel[] = (data || []).map((ch: any) => ({
    id: String(ch.id),
    name: ch.name || "Unknown",
    country: ch.country || "??",
    categories: ch.categories || [],
    logo: ch.logo || ch.logoUrl || undefined,
    online: ch.online !== false,
    streams: (ch.streams || []).map((s: any) => ({
      url: s.url,
      quality: s.quality || null,
      label: s.label || s.quality || undefined,
    })),
    guides: ch.guides || undefined,
  }));

  channelCache = { channels, expiresAt: now + CACHE_TTL };
  return channels;
}

export async function getCategories(): Promise<IPTVCategory[]> {
  const res = await dnsFetch(`${API_BASE}/categories.json`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Failed to fetch categories: ${res.status}`);
  const data = await res.json();
  return (data || []).map((c: any) => ({
    id: String(c.id || c.slug || c.name),
    name: c.name || c.id,
    count: c.count,
  }));
}

export async function getChannelsByCategory(category: string): Promise<IPTVChannel[]> {
  const res = await dnsFetch(`${API_BASE}/by-category/${encodeURIComponent(category)}.json`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Failed to fetch category ${category}: ${res.status}`);
  const data = await res.json();
  return (data || [])
    .filter((ch: any) => ch.online !== false && ch.streams?.length > 0)
    .map((ch: any) => ({
      id: String(ch.id),
      name: ch.name || "Unknown",
      country: ch.country || "??",
      categories: ch.categories || [category],
      logo: ch.logo || ch.logoUrl || undefined,
      online: true,
      streams: (ch.streams || []).map((s: any) => ({
        url: s.url,
        quality: s.quality || null,
        label: s.label || s.quality || undefined,
      })),
      guides: ch.guides || undefined,
    }));
}

export async function getChannelById(id: string): Promise<IPTVChannel | null> {
  const channels = await getAllChannels();
  return channels.find((ch) => ch.id === id) || null;
}

export async function getOnlineChannelsByCategory(category?: string): Promise<IPTVChannel[]> {
  if (category && category !== "all") {
    return getChannelsByCategory(category);
  }
  const all = await getAllChannels();
  return all.filter((ch) => ch.online && ch.streams.length > 0);
}

export async function searchChannels(query: string): Promise<IPTVChannel[]> {
  const all = await getAllChannels();
  const q = query.toLowerCase();
  return all.filter(
    (ch) =>
      ch.online &&
      ch.streams.length > 0 &&
      (ch.name.toLowerCase().includes(q) || ch.country.toLowerCase().includes(q))
  );
}

export interface ChannelFilter {
  category?: string;
  country?: string;
  search?: string;
}

// Combines category + country + free-text search in one pass so filters can be
// applied together (the old per-filter functions only supported one at a time).
export async function filterChannels(filter: ChannelFilter): Promise<IPTVChannel[]> {
  const all = await getAllChannels();
  let result = all.filter((ch) => ch.online && ch.streams.length > 0);

  if (filter.category && filter.category !== "all") {
    const cat = filter.category.toLowerCase();
    result = result.filter((ch) => ch.categories.some((c) => c.toLowerCase() === cat));
  }
  if (filter.country && filter.country !== "all") {
    const country = filter.country.toLowerCase();
    result = result.filter((ch) => ch.country.toLowerCase() === country);
  }
  if (filter.search) {
    const q = filter.search.toLowerCase();
    result = result.filter(
      (ch) => ch.name.toLowerCase().includes(q) || ch.country.toLowerCase().includes(q)
    );
  }
  return result;
}

export interface CountryOption {
  code: string;
  name: string;
  count: number;
}

let regionNames: Intl.DisplayNames | null = null;
function countryName(code: string): string {
  if (!code || code === "??") return "Unknown";
  try {
    regionNames ||= new Intl.DisplayNames(["en"], { type: "region" });
    return regionNames.of(code.toUpperCase()) || code;
  } catch {
    return code;
  }
}

export async function getCountries(): Promise<CountryOption[]> {
  const all = await getAllChannels();
  const counts = new Map<string, number>();
  for (const ch of all) {
    if (!ch.online || ch.streams.length === 0) continue;
    counts.set(ch.country, (counts.get(ch.country) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([code, count]) => ({ code, name: countryName(code), count }))
    .sort((a, b) => b.count - a.count);
}
