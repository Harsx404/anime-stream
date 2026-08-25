// Anime streaming providers — ported from Anivexa-API
// These providers scrape public anime sites for episode lists and HLS streams
// Unlike Miruro, they don't use Cloudflare bot protection, so plain fetch works

// --- Utils ---

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function fetchHtml(url: string, headers: Record<string, string> = {}): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      ...headers,
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.text();
}

function decodeEntities(s = ""): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function stripTags(html = ""): string {
  return decodeEntities(html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " "));
}

function attr(tag: string, name: string): string {
  const m = tag.match(new RegExp(`${name}=["']([^"']*)["']`, "i"));
  return m ? decodeEntities(m[1]) : "";
}

function norm(s = ""): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function diceCoeff(a: string, b: string): number {
  const na = norm(a);
  const nb = norm(b);
  if (na === nb) return 1;
  if (na.length < 2 || nb.length < 2) return 0;
  const bigrams = new Map<string, number>();
  for (let i = 0; i < na.length - 1; i++) {
    const bg = na.slice(i, i + 1);
    bigrams.set(bg, (bigrams.get(bg) ?? 0) + 1);
  }
  let hits = 0;
  for (let i = 0; i < nb.length - 1; i++) {
    const bg = nb.slice(i, i + 1);
    const count = bigrams.get(bg) ?? 0;
    if (count > 0) {
      hits++;
      bigrams.set(bg, count - 1);
    }
  }
  return (2 * hits) / (na.length + nb.length - 2);
}

function titleScore(query: string, candidate: string, slug: string): number {
  const base = Math.max(diceCoeff(query, candidate), diceCoeff(query, slug.replace(/-/g, " ")));
  const queryFirstNum = norm(query).match(/\d+/)?.[0] ?? "";
  const slugFirstNum = slug.match(/\d+/)?.[0] ?? "";
  if (queryFirstNum && slugFirstNum && queryFirstNum !== slugFirstNum) return base * 0.65;
  if (queryFirstNum && !slugFirstNum) return base * 0.65;
  if (!queryFirstNum && slugFirstNum) {
    const n = parseInt(slugFirstNum);
    if (n > 1 && n < 1900) return base * (1 - 0.06 * (n - 1));
  }
  const isMovieQuery = /\b(movie|film|the movie)\b/i.test(query);
  const isMovieMatch = /\b(movie|film)\b/i.test(candidate) || /movie|film/.test(slug);
  if (isMovieQuery && !isMovieMatch) return base * 0.4;
  const qLen = norm(query).length;
  const sLen = norm(slug.replace(/-/g, " ")).length;
  return sLen > qLen * 1.6 + 4 ? base * 0.8 : base;
}

function buildSearchQueries(title: string): string[] {
  const queries = new Set([title]);
  const words = title.trim().split(/\s+/);
  if (words.length > 4) queries.add(words.slice(0, 4).join(" "));
  if (words.length > 3) queries.add(words.slice(0, 3).join(" "));
  const stripped = title
    .replace(/\bseason\s*\d+\b/gi, "")
    .replace(/\bpart\s*\d+\b/gi, "")
    .replace(/\b\d+rd\b|\b\d+th\b|\b\d+st\b|\b\d+nd\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  if (stripped && stripped !== title) queries.add(stripped);
  return [...queries].filter((q) => q.length >= 3);
}

async function findTopSlugs(
  titles: string[],
  searchFn: (q: string) => Promise<{ slug: string; text: string }[]>,
  n = 6,
): Promise<{ slug: string; title: string; score: number }[]> {
  const allCandidates = new Map<string, string>();
  const searchQueries = new Set<string>();
  for (const title of titles.slice(0, 4)) {
    for (const q of buildSearchQueries(title)) searchQueries.add(q);
  }
  await Promise.all(
    [...searchQueries].map(async (q) => {
      try {
        const results = await searchFn(q);
        for (const r of results) if (!allCandidates.has(r.slug)) allCandidates.set(r.slug, r.text);
      } catch {}
    }),
  );
  const scored: { slug: string; title: string; score: number }[] = [];
  for (const [slug, text] of allCandidates) {
    let best = 0;
    for (const title of titles.slice(0, 2)) best = Math.max(best, titleScore(title, text, slug));
    if (best >= 0.5) scored.push({ slug, title: text, score: best });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, n);
}

// --- AniList media fetch ---

const ARM = "https://arm.haglund.dev/api/v2/ids";
const JIKAN = "https://api.jikan.moe/v4";

interface MediaInfo {
  id: number;
  idMal: number | null;
  title: { english: string | null; romaji: string | null; native: string | null };
  status: string;
  format: string | null;
  episodes: number | null;
  seasonYear: number | null;
  synonyms: string[];
}

const mediaCache = new Map<number, MediaInfo>();

export async function getMedia(anilistId: number): Promise<MediaInfo> {
  const id = Number(anilistId);
  if (mediaCache.has(id)) return mediaCache.get(id)!;

  const arm = await fetch(`${ARM}?source=anilist&id=${id}`, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    signal: AbortSignal.timeout(10000),
  })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);

  const malId = arm?.myanimelist ?? null;

  const alQuery = `query($id:Int){Media(id:$id,type:ANIME){id title{english romaji native} status format episodes seasonYear synonyms nextAiringEpisode{episode airingAt}}}`;
  const alRes = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query: alQuery, variables: { id } }),
    signal: AbortSignal.timeout(10000),
  }).catch(() => null);

  const al = alRes?.ok ? (await alRes.json()).data?.Media : null;

  let jikan: any = null;
  if (malId) {
    for (let attempt = 0; attempt <= 3; attempt++) {
      const r = await fetch(`${JIKAN}/anime/${malId}`, {
        headers: { "User-Agent": UA, Accept: "application/json" },
        signal: AbortSignal.timeout(10000),
      });
      if (r.status === 429) {
        await new Promise((res) => setTimeout(res, 1000 * (attempt + 1)));
        continue;
      }
      if (!r.ok) break;
      jikan = await r.json();
      break;
    }
  }

  const d = jikan?.data ?? null;
  const media: MediaInfo = {
    id,
    idMal: malId,
    title: {
      english: al?.title?.english ?? d?.title_english ?? null,
      romaji: al?.title?.romaji ?? d?.title ?? null,
      native: al?.title?.native ?? d?.title_japanese ?? null,
    },
    status: al?.status ?? "RELEASING",
    format: al?.format ?? d?.type ?? null,
    episodes: al?.episodes ?? d?.episodes ?? null,
    seasonYear: al?.seasonYear ?? d?.year ?? null,
    synonyms: [
      ...(d?.titles?.map((t: any) => t.title).filter(Boolean) ?? []),
      ...(Array.isArray(al?.synonyms) ? al.synonyms : []),
    ],
  };

  mediaCache.set(id, media);
  return media;
}

function buildTitles(media: MediaInfo): string[] {
  return [
    media?.title?.english,
    media?.title?.romaji,
    media?.title?.native,
    ...(media?.synonyms ?? []),
  ].filter(Boolean) as string[];
}

// --- Types ---

export interface AnimeEpisode {
  id: string;
  number: number;
  title?: string;
  duration?: number;
  description?: string;
  image?: string;
  airDate?: string;
  filler?: boolean;
  hasDub?: boolean;
}

export interface AnimeProviderInfo {
  name: string;
  hasSub: boolean;
  hasDub: boolean;
  episodeCount: number;
  subCount: number;
  dubCount: number;
}

export interface AnimeSource {
  url: string;
  quality: string;
  isM3U8: boolean;
  referer?: string;
  type: string;
  default?: boolean;
}

export interface AnimeSubtitle {
  url: string;
  lang: string;
}

export interface AnimeSourcesResult {
  sources: AnimeSource[];
  subs: AnimeSubtitle[];
  download?: { url: string; label?: string }[];
}

export interface AnimeEpisodesResult {
  episodes: AnimeEpisode[];
  providers: AnimeProviderInfo[];
}

// --- Provider: 2dhive ---

const TWODHIVE_BASE = "https://2dhive.com";

function astroDecode(v: any): any {
  if (!Array.isArray(v)) return v;
  const [type, data] = v;
  if (type === 0) {
    if (data === null || typeof data !== "object" || Array.isArray(data)) return data;
    return Object.fromEntries(Object.entries(data).map(([k, val]) => [k, astroDecode(val)]));
  }
  if (type === 1) return Array.isArray(data) ? data.map(astroDecode) : data;
  return data;
}

function decodeProps(raw: Record<string, any>): Record<string, any> {
  return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, astroDecode(v)]));
}

function parseEpisodeNums(html: string, malId: number): number[] {
  const re = new RegExp(`/episode\\?anime=${malId}&(?:amp;)?ep_num=(\\d+)`, "gi");
  const nums = new Set<number>();
  for (const m of html.matchAll(re)) nums.add(Number(m[1]));
  return [...nums].sort((a, b) => a - b);
}

function extractEpisodePlayerProps(html: string): any {
  const idx = html.indexOf("prefetchedHls");
  if (idx === -1) return null;
  const propsIdx = html.lastIndexOf('props="', idx);
  if (propsIdx === -1) return null;
  const valueIdx = propsIdx + 7;
  const endIdx = html.indexOf('"', valueIdx);
  if (endIdx === -1) return null;
  const raw = html
    .slice(valueIdx, endIdx)
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
  try {
    return decodeProps(JSON.parse(raw));
  } catch {
    return null;
  }
}

async function twodhiveGetEpisodes(anilistId: number): Promise<AnimeEpisodesResult> {
  const media = await getMedia(anilistId);
  if (!media?.idMal) throw new Error("2dhive: no MAL ID");
  const malId = media.idMal;

  const animeHtml = await fetchHtml(`${TWODHIVE_BASE}/anime?anime=${malId}`);
  const epNums = parseEpisodeNums(animeHtml, malId);
  if (!epNums.length) throw new Error(`2dhive: no episodes for MAL ${malId}`);

  // Probe episode 1 to check for dub availability
  let hasDub = false;
  try {
    const epHtml = await fetchHtml(`${TWODHIVE_BASE}/episode?anime=${malId}&ep_num=${epNums[0]}`);
    const props = extractEpisodePlayerProps(epHtml);
    hasDub = Boolean(props?.prefetchedHls?.dub?.content);
  } catch {}

  const sub: AnimeEpisode[] = [];
  const dub: AnimeEpisode[] = [];
  for (const num of epNums) {
    const ep: AnimeEpisode = {
      id: `2dhive:${anilistId}:${num}`,
      number: num,
      title: `Episode ${num}`,
      hasDub,
    };
    sub.push(ep);
    if (hasDub) dub.push({ ...ep, hasDub: true });
  }

  return {
    episodes: sub,
    providers: [
      {
        name: "2dhive",
        hasSub: sub.length > 0,
        hasDub: dub.length > 0,
        episodeCount: Math.max(sub.length, dub.length),
        subCount: sub.length,
        dubCount: dub.length,
      },
    ],
  };
}

// Extract upstream URL from Cloudflare worker proxy URLs
// Format: https://worker.workers.dev/m3u8-proxy?url=<encoded>&headers=<encoded_json>
// Or: https://worker.workers.dev/ts-proxy?url=<encoded>&referer=<encoded>
function extractWorkerProxyUrl(workerUrl: string): { url: string; referer?: string } {
  try {
    const u = new URL(workerUrl);
    const upstreamUrl = u.searchParams.get("url");
    if (!upstreamUrl) return { url: workerUrl };

    // Try headers param (JSON with referer)
    const headersParam = u.searchParams.get("headers");
    if (headersParam) {
      try {
        const headers = JSON.parse(headersParam);
        return { url: upstreamUrl, referer: headers.referer || headers.Referer };
      } catch {}
    }

    // Try direct referer param
    const referer = u.searchParams.get("referer");
    if (referer) {
      return { url: upstreamUrl, referer };
    }

    return { url: upstreamUrl };
  } catch {
    return { url: workerUrl };
  }
}

async function twodhiveGetSources(
  anilistId: number,
  episodeNum: number,
  category: string,
): Promise<AnimeSourcesResult> {
  const media = await getMedia(anilistId);
  if (!media?.idMal) throw new Error("2dhive: no MAL ID");
  const malId = media.idMal;
  const referer = `${TWODHIVE_BASE}/episode?anime=${malId}&ep_num=${episodeNum}`;
  const wantDub = category === "dub";

  const sources: AnimeSource[] = [];
  const subs: AnimeSubtitle[] = [];

  // 1. Scrape the episode page for the correct audio (sub/dub) HLS URL
  // The episode page contains prefetchedHls.sub.content and prefetchedHls.dub.content
  try {
    const epHtml = await fetchHtml(referer);
    const props = extractEpisodePlayerProps(epHtml);
    if (props?.prefetchedHls) {
      const audioKey = wantDub ? "dub" : "sub";
      const hlsEntry = props.prefetchedHls[audioKey];
      if (hlsEntry?.content) {
        const extracted = extractWorkerProxyUrl(hlsEntry.content);
        sources.push({
          url: extracted.url,
          quality: wantDub ? "2DHive Dub" : "2DHive Sub",
          isM3U8: true,
          referer: extracted.referer || "https://megaplay.buzz/",
          type: "hls",
          default: true,
        });
      }
      // Check for subtitle in props
      if (props.subtitle) {
        const subExtracted = extractWorkerProxyUrl(props.subtitle);
        subs.push({ url: subExtracted.url, lang: "English" });
      }
    }
  } catch {}

  // 2. Fall back to hiAnime API for sub if episode page scraping didn't yield a source
  if (sources.length === 0 && !wantDub) {
    try {
      const hiRes = await fetch(`${TWODHIVE_BASE}/api/hianime?mal_id=${malId}&ep_num=${episodeNum}`, {
        headers: { "User-Agent": UA, Referer: referer },
        signal: AbortSignal.timeout(8000),
      });
      if (hiRes.ok) {
        const hiData = await hiRes.json();
        if (hiData?.m3u8) {
          const extracted = extractWorkerProxyUrl(hiData.m3u8);
          sources.push({
            url: extracted.url,
            quality: "HiAnime",
            isM3U8: true,
            referer: extracted.referer || "https://megaplay.buzz/",
            type: "hls",
            default: true,
          });
        }
        if (hiData?.subtitle) {
          const subExtracted = extractWorkerProxyUrl(hiData.subtitle);
          subs.push({ url: subExtracted.url, lang: "English" });
        }
      }
    } catch {}
  }

  // 3. Add MegaPlay and BabaStream embeds as fallbacks
  const audioPath = wantDub ? "dub" : "sub";
  sources.push({
    url: `https://megaplay.buzz/stream/mal/${malId}/${episodeNum}/${audioPath}`,
    quality: wantDub ? "MegaPlay Dub" : "MegaPlay Sub",
    isM3U8: false,
    referer: TWODHIVE_BASE,
    type: "embed",
  });
  sources.push({
    url: `https://babastream.top/embed/${malId}/${episodeNum}/${audioPath}`,
    quality: "BabaStream",
    isM3U8: false,
    referer: TWODHIVE_BASE,
    type: "embed",
  });

  return { sources, subs };
}

// --- Provider: AnimeGG ---

const ANIMEGG_BASE = "https://www.animegg.org";

async function animeggSearch(query: string): Promise<{ slug: string; text: string }[]> {
  const html = await fetchHtml(`${ANIMEGG_BASE}/search/?q=${encodeURIComponent(query)}`);
  const results: { slug: string; text: string }[] = [];
  for (const m of html.matchAll(/<a\b[^>]*class=["'][^"']*\bmse\b[^"']*["'][^>]*>[\s\S]*?<\/a>/gi)) {
    const tag = m[0].match(/<a\b[^>]*>/i)?.[0] ?? "";
    const href = attr(tag, "href");
    const slug = href.match(/^\/series\/([^/?#]+)/)?.[1];
    if (!slug) continue;
    const strong = m[0].match(/<strong[^>]*>([\s\S]*?)<\/strong>/i)?.[1];
    results.push({ slug, text: strong ? stripTags(strong) : slug.replace(/-/g, " ") });
  }
  return results;
}

async function animeggScrapeSeries(slug: string): Promise<any[]> {
  const html = await fetchHtml(`${ANIMEGG_BASE}/series/${slug}`);
  const episodes: any[] = [];
  for (const m of html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)) {
    const block = m[1];
    if (!/\banm_det_pop\b/.test(block)) continue;
    const link = block.match(/<a\b[^>]*class=["'][^"']*anm_det_pop[^"']*["'][^>]*>/i)?.[0] ?? "";
    const href = attr(link, "href").replace(/#.*$/, "").replace(/^\//, "");
    const strong = stripTags(block.match(/<strong[^>]*>([\s\S]*?)<\/strong>/i)?.[1] ?? "");
    const numMatch = strong.match(/(\d+)-(\d+)\s*$/) || strong.match(/(\d+)\s*$/);
    if (!numMatch || !href) continue;
    const number = parseInt(numMatch[1]);
    const title = stripTags(block.match(/<i\b[^>]*class=["'][^"']*anititle[^"']*["'][^>]*>([\s\S]*?)<\/i>/i)?.[1] ?? "") || strong;
    const hasSub = /\bbtn-subbed\b/.test(block);
    const hasDub = /\bbtn-dubbed\b/.test(block);
    episodes.push({ number, title, epSlug: href, hasSub, hasDub });
  }
  episodes.sort((a, b) => a.number - b.number);
  const seen = new Set<number>();
  return episodes.filter((e) => (seen.has(e.number) ? false : (seen.add(e.number), true)));
}

async function animeggScrapeEmbed(embedId: string): Promise<any[]> {
  const html = await fetchHtml(`${ANIMEGG_BASE}/embed/${embedId}`, { Referer: ANIMEGG_BASE });
  const m = html.match(/var\s+videoSources\s*=\s*(\[[\s\S]*?\]);/);
  if (!m) return [];
  try {
    const asJson = m[1]
      .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
      .replace(/:\s*'([^']*)'/g, ': "$1"');
    const parsed = JSON.parse(asJson);
    return parsed
      .map((s: any) => ({
        quality: s.label || "unknown",
        url: s.file ? (s.file.startsWith("http") ? s.file : `${ANIMEGG_BASE}${s.file}`) : "",
      }))
      .filter((s: any) => s.url);
  } catch {
    return [];
  }
}

async function animeggResolveSeries(anilistId: number): Promise<{ slug: string; mode: string; offset: number }> {
  const media = await getMedia(anilistId);
  const titles = buildTitles(media);
  const candidates = await findTopSlugs(titles, async (q) => {
    const r1 = await animeggSearch(q);
    const compact = q.split(/\s+/)[0].replace(/[^a-zA-Z0-9]/g, "");
    if (compact.length >= 4 && compact.toLowerCase() !== q.toLowerCase()) {
      try {
        const r2 = await animeggSearch(compact);
        const seen = new Set(r1.map((r) => r.slug));
        r2.forEach((r) => !seen.has(r.slug) && r1.push(r));
      } catch {}
    }
    return r1;
  });

  if (!candidates.length) throw new Error(`AnimeGG: no match for AniList ${anilistId}`);

  // Pick best candidate by scraping episode counts
  for (const c of candidates.slice(0, 3)) {
    try {
      const eps = await animeggScrapeSeries(c.slug);
      if (eps.length > 0) return { slug: c.slug, mode: "local", offset: 0 };
    } catch {}
  }
  throw new Error(`AnimeGG: no viable series for AniList ${anilistId}`);
}

const animeggSeriesCache = new Map<number, { slug: string; mode: string; offset: number }>();

async function animeggGetEpisodes(anilistId: number): Promise<AnimeEpisodesResult> {
  let series = animeggSeriesCache.get(anilistId);
  if (!series) {
    series = await animeggResolveSeries(anilistId);
    animeggSeriesCache.set(anilistId, series);
  }

  const episodes = await animeggScrapeSeries(series.slug);
  const sub: AnimeEpisode[] = [];
  const dub: AnimeEpisode[] = [];

  for (const ep of episodes) {
    const e: AnimeEpisode = {
      id: `animegg:${anilistId}:${ep.number}`,
      number: ep.number,
      title: ep.title || `Episode ${ep.number}`,
      hasDub: ep.hasDub,
    };
    if (ep.hasSub) sub.push(e);
    if (ep.hasDub) dub.push({ ...e, hasDub: true });
  }

  return {
    episodes: sub.length > 0 ? sub : dub,
    providers: [
      {
        name: "animegg",
        hasSub: sub.length > 0,
        hasDub: dub.length > 0,
        episodeCount: Math.max(sub.length, dub.length),
        subCount: sub.length,
        dubCount: dub.length,
      },
    ],
  };
}

async function animeggGetSources(
  anilistId: number,
  episodeNum: number,
  category: string,
): Promise<AnimeSourcesResult> {
  let series = animeggSeriesCache.get(anilistId);
  if (!series) {
    series = await animeggResolveSeries(anilistId);
    animeggSeriesCache.set(anilistId, series);
  }

  const episodes = await animeggScrapeSeries(series.slug);
  const ep = episodes.find((e) => e.number === episodeNum);
  if (!ep) throw new Error(`AnimeGG: episode ${episodeNum} not found`);

  const html = await fetchHtml(`${ANIMEGG_BASE}/${ep.epSlug}`, { Referer: ANIMEGG_BASE });
  const tabs: { embedId: string; server: string; normalized: string }[] = [];
  for (const m of html.matchAll(/<a\b[^>]*data-toggle=["']tab["'][^>]*>/gi)) {
    const tag = m[0];
    const embedId = attr(tag, "data-id");
    const server = attr(tag, "data-mirror") || "AnimeGG";
    const version = attr(tag, "data-version") || "subbed";
    if (!embedId) continue;
    const normalized = version.startsWith("dub") ? "dub" : "sub";
    if (category === "all" || normalized === category) {
      tabs.push({ embedId, server, normalized });
    }
  }

  const sources: AnimeSource[] = [];
  for (let i = 0; i < tabs.length; i++) {
    try {
      const srcs = await animeggScrapeEmbed(tabs[i].embedId);
      for (let j = 0; j < srcs.length; j++) {
        sources.push({
          url: srcs[j].url,
          quality: srcs[j].quality || tabs[i].server,
          isM3U8: srcs[j].url.includes(".m3u8"),
          referer: `${ANIMEGG_BASE}/`,
          type: srcs[j].url.includes(".m3u8") ? "hls" : "mp4",
          default: i === 0 && j === 0,
        });
      }
    } catch {}
  }

  return { sources, subs: [] };
}


// --- Unified API ---

export type ProviderName = "2dhive" | "animegg";

export const ALL_PROVIDERS: ProviderName[] = ["2dhive", "animegg"];

export async function getProviderEpisodes(
  provider: ProviderName,
  anilistId: number,
): Promise<AnimeEpisodesResult> {
  switch (provider) {
    case "2dhive":
      return twodhiveGetEpisodes(anilistId);
    case "animegg":
      return animeggGetEpisodes(anilistId);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

export async function getProviderSources(
  provider: ProviderName,
  anilistId: number,
  episodeNum: number,
  category: string,
): Promise<AnimeSourcesResult> {
  switch (provider) {
    case "2dhive":
      return twodhiveGetSources(anilistId, episodeNum, category);
    case "animegg":
      return animeggGetSources(anilistId, episodeNum, category);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

// Try all providers, return the first that works
export async function getBestEpisodes(anilistId: number): Promise<{
  provider: ProviderName;
  result: AnimeEpisodesResult;
}> {
  const errors: string[] = [];
  for (const p of ALL_PROVIDERS) {
    try {
      const result = await getProviderEpisodes(p, anilistId);
      if (result.episodes.length > 0) return { provider: p, result };
    } catch (e) {
      errors.push(`${p}: ${String(e)}`);
    }
  }
  throw new Error(`All providers failed: ${errors.join("; ")}`);
}
