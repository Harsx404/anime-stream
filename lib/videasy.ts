// VIDEASY 4K stream resolver
// Reverse-engineered from vidking.net's VideoPlayer bundle
// Uses a custom PRNG-based XOR cipher for response decryption

const API_BASE = "https://api.speedracelight.com";
const TMDB_BASE = "https://db.speedracelight.com/3";
const SUBS_BASE = "https://subs.videasy.to";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36";
const REFERER = "https://www.vidking.net/";
const ORIGIN = "https://www.vidking.net";
const FETCH_TIMEOUT_MS = 5000;

async function fetchWithTimeout(url: string, init?: RequestInit & { timeoutMs?: number }): Promise<Response> {
  const timeoutMs = init?.timeoutMs ?? FETCH_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// --- Constants from the minified JS ---
const Hl = [
  1116352408, 1899447441, 3049323471, 3921009573, 961987163, 1508970993,
  2453635748, 2870763221, 3624381080, 310598401, 607225278, 1426881987,
  1925078388, 2162078206, 2614888103, 3248222580,
];
const _f = [1732584193, 4023233417, 2562383102, 271733878];
const Js = 61;
const Sf = 8;
const ms = 2654435769;
const Ys = [109, 118, 109, 49]; // "mvm1" magic bytes

// --- Helper functions ---
function ci(l: number): number {
  l >>>= 0;
  l ^= l >>> 16;
  l = Math.imul(l, 2246822507) >>> 0;
  l ^= l >>> 13;
  l = Math.imul(l, 3266489909) >>> 0;
  l ^= l >>> 16;
  return l >>> 0;
}

function ps(l: number, o: number): number {
  l >>>= 0;
  o &= 31;
  if (o === 0) return l >>> 0;
  return ((l << o) | (l >>> (32 - o))) >>> 0;
}

function bf(l: number): boolean {
  return (l * (l + 1) & 1) === 0;
}

function If(l: number): boolean {
  return (l * (l + 1) & 1) === 1;
}

function Af(l: string): number {
  let o = _f[0] >>> 0;
  for (let e = 0; e < l.length; e++) {
    o = ps((o ^ Math.imul(l.charCodeAt(e), Hl[e & 15])) >>> 0, 5);
  }
  return ci(o);
}

function wf(l: string): number[] {
  const o = new Array(256);
  for (let i = 0; i < 256; i++) o[i] = i;
  let e = 0;
  for (let i = 0; i < 256; i++) {
    e = (e + o[i] + l.charCodeAt(i % l.length)) & 255;
    const r = o[i];
    o[i] = o[e];
    o[e] = r;
  }
  return o;
}

function vf(l: string): number {
  let o = 2166136261;
  for (let e = 0; e < l.length; e++) {
    o = Math.imul(o ^ l.charCodeAt(e), 16777619) >>> 0;
  }
  return ci(o);
}

function Nf(l: number, o: number, e: number): number {
  return (((l ^ o) >>> 0) | ((l & o & e) >>> 0)) >>> 0;
}

interface PRNGState {
  S: number[];
  acc: number;
}

function Rf(l: string, o: number): PRNGState {
  if (If(l.length)) {
    return { S: wf(l), acc: Af(l) };
  }
  const e = new Array(Js);
  let i = ci(vf(l) ^ ci((o >>> 0) ^ ms)) >>> 0;
  for (let r = 0; r < Sf; r++) {
    if (bf(r)) {
      const n = i % Js;
      i = ps((i + ms) >>> 0, 7 + (r & 7));
      e[n] = (i ^ ci(i)) >>> 0;
      i = ci((i + n) >>> 0);
    } else {
      e[r] = Hl[r & 15];
    }
  }
  return { S: e, acc: ci(i ^ 2779096485) >>> 0 };
}

function Cf(state: PRNGState, o: number): number {
  const e = state.S;
  let i = state.acc;
  const r = i % Js;
  const n = 0 - +(r in e);
  const u = e[r] >>> 0;
  const d = Math.imul(ms, o + 1) >>> 0;
  let g = Nf(i, (u ^ d) >>> 0, n);
  g = (ps((g + i) >>> 0, r & 31) ^ ps(i, Math.imul(r, 7) & 31)) >>> 0;
  i = ci((g + ms) >>> 0);
  e[r] = i >>> 0;
  state.acc = i;
  return i >>> 0;
}

function xf(l: string, o: number, e: number): Uint8Array {
  const state = Rf(l, o);
  const r = new Uint8Array(e);
  let n = 0;
  for (let u = 0; u < e; ) {
    const d = Cf(state, n++);
    r[u++] = d & 255;
    if (u < e) r[u++] = (d >>> 8) & 255;
    if (u < e) r[u++] = (d >>> 16) & 255;
    if (u < e) r[u++] = (d >>> 24) & 255;
  }
  return r;
}

function Df(l: string): Uint8Array {
  const o = l
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(l.length / 4) * 4, "=");
  const e = Buffer.from(o, "base64");
  const i = new Uint8Array(e.length);
  for (let r = 0; r < e.length; r++) i[r] = e[r];
  return i;
}

function Pf(l: string, o: string, e: number): string {
  const i = Df(l);
  const r = xf(o, e, i.length);
  for (let n = 0; n < i.length; n++) i[n] ^= r[n];
  for (let n = 0; n < Ys.length; n++) {
    if (i[n] !== Ys[n])
      throw new Error("decrypt failed: bad seed or tampered payload");
  }
  return new TextDecoder("utf-8").decode(i.subarray(Ys.length));
}

// --- Seed caching ---
interface CachedSeed {
  seed: string;
  expiresAt: number;
}
const seedCache = new Map<string, CachedSeed>();
const SEED_PRELOAD = 5000;

async function getSeed(tmdbId: number): Promise<string> {
  const key = `${API_BASE}|${tmdbId}`;
  const now = Date.now();
  const cached = seedCache.get(key);
  if (cached && cached.expiresAt - SEED_PRELOAD > now) {
    return cached.seed;
  }
  const resp = await fetchWithTimeout(
    `${API_BASE}/seed?mediaId=${encodeURIComponent(String(tmdbId))}`,
    {
      headers: {
        "User-Agent": UA,
        Referer: REFERER,
        Origin: ORIGIN,
        Accept: "application/json",
      },
    }
  );
  if (!resp.ok) throw new Error(`Seed request failed: ${resp.status}`);
  const data = await resp.json();
  const seed = data.seed as string;
  const ttl = data.ttlMs ?? 30000;
  seedCache.set(key, { seed, expiresAt: now + ttl });
  return seed;
}

function invalidateSeed(tmdbId: number): void {
  seedCache.delete(`${API_BASE}|${tmdbId}`);
}

// --- TMDB metadata fetch ---
export async function fetchTmdbMeta(
  mediaType: "movie" | "tv",
  tmdbId: number
): Promise<{ title: string; year: string; imdbId: string }> {
  const resp = await fetchWithTimeout(
    `${TMDB_BASE}/${mediaType}/${tmdbId}?append_to_response=external_ids`,
    {
      headers: {
        "User-Agent": UA,
        Referer: REFERER,
        Accept: "application/json",
      },
    }
  );
  if (!resp.ok) throw new Error(`TMDB meta fetch failed: ${resp.status}`);
  const data = await resp.json();
  let title: string;
  let year: string;
  if (mediaType === "movie") {
    title = data.title;
    year = data.release_date
      ? new Date(data.release_date).getFullYear().toString()
      : "";
  } else {
    title = data.name;
    year = data.first_air_date
      ? new Date(data.first_air_date).getFullYear().toString()
      : "";
  }
  const imdbId = data.external_ids?.imdb_id || "";
  return { title, year, imdbId };
}

// --- Providers ---
export const PROVIDERS = {
  YORU: { name: "Yoru", endpoint: "cdn/sources-with-title" },
  CYPHER: { name: "Cypher", endpoint: "downloader2/sources-with-title" },
  BREACH: { name: "Breach", endpoint: "m4uhd/sources-with-title" },
  NEON: { name: "Neon", endpoint: "vsrc/sources-with-title" },
  VYSE: { name: "Vyse", endpoint: "hdmovie/sources-with-title" },
  KILLJOY: { name: "Killjoy", endpoint: "meine/sources-with-title" },
  FADE: { name: "Fade", endpoint: "hdmovie/sources-with-title" },
  OMEN: { name: "Omen", endpoint: "lamovie/sources-with-title" },
  RAZE: { name: "Raze", endpoint: "superflix/sources-with-title" },
} as const;

export const PROVIDER_ORDER = [
  "Yoru",
  "Cypher",
  "Breach",
  "Neon",
  "Vyse",
  "Omen",
  "Raze",
];

// --- Types ---
export interface VideasySource {
  quality: string;
  url: string;
  type: string;
}

export interface VideasySubtitle {
  url: string;
  language: string;
  label?: string;
  flagUrl?: string;
  display?: string;
}

export interface VideasyResult {
  sources: VideasySource[];
  subtitles: VideasySubtitle[];
  thumbnail?: string;
  playlist?: string;
  provider?: string;
}

interface RawSourceResponse {
  sources: Array<{ quality: string; url: string; type: string }>;
  subtitles?: Array<{
    file?: string;
    url?: string;
    label?: string;
    lang?: string;
    language?: string;
  }>;
  thumbnail?: string;
  playlist?: string;
  tmdbId?: string;
  mediaType?: string;
}

// --- Language names ---
const LANG_NAMES: Record<string, string> = {
  eng: "English", hin: "Hindi", chi: "Chinese", dan: "Danish", dut: "Dutch",
  fin: "Finnish", fre: "French", ger: "German", gre: "Greek", ita: "Italian",
  nor: "Norwegian", pol: "Polish", por: "Portuguese", rum: "Romanian",
  spa: "Spanish", swe: "Swedish", vie: "Vietnamese", jpn: "Japanese",
  kor: "Korean", ara: "Arabic", rus: "Russian", tur: "Turkish", tha: "Thai",
  ind: "Indonesian", may: "Malay", heb: "Hebrew", cze: "Czech", hun: "Hungarian",
  bul: "Bulgarian", ukr: "Ukrainian", per: "Persian", ben: "Bengali",
  tam: "Tamil", tel: "Telugu", mal: "Malayalam", kan: "Kannada",
  mar: "Marathi", pun: "Punjabi", fil: "Filipino", est: "Estonian",
  lav: "Latvian", lit: "Lithuanian", slk: "Slovak", slv: "Slovenian",
  hrv: "Croatian", srp: "Serbian", bos: "Bosnian", mkd: "Macedonian",
  isl: "Icelandic", gle: "Irish", wel: "Welsh", cat: "Catalan",
  baq: "Basque", glg: "Galician",
  // 2-letter codes
  en: "English", ar: "Arabic", pb: "Portuguese (BR)", de: "German",
  bs: "Bosnian", zt: "Chinese (Traditional)", et: "Estonian", ml: "Malayalam",
  fa: "Persian", nl: "Dutch", cs: "Czech", ru: "Russian", lt: "Lithuanian",
  lv: "Latvian", id: "Indonesian", ja: "Japanese", mk: "Macedonian",
  vi: "Vietnamese", sk: "Slovak", sq: "Albanian", th: "Thai", es: "Spanish",
  da: "Danish", ro: "Romanian", hu: "Hungarian", sv: "Swedish", pt: "Portuguese",
  tr: "Turkish", fi: "Finnish", fr: "French", no: "Norwegian", pl: "Polish",
  he: "Hebrew", sr: "Serbian", el: "Greek", bg: "Bulgarian", hr: "Croatian",
  it: "Italian", ko: "Korean", bn: "Bengali", sl: "Slovenian", ms: "Malay",
  zh: "Chinese", ze: "Chinese (Simplified)", ea: "Spanish (Latin America)",
  si: "Sinhala", ta: "Tamil", te: "Telugu", uk: "Ukrainian", ka: "Georgian",
  zc: "Chinese (Cantonese)", is: "Icelandic", ku: "Kurdish", am: "Amharic",
  be: "Belarusian", aj: "Arabic (Jordanian)", my: "Malay (Burmese)",
  nob: "Norwegian (Bokmål)", mac: "Macedonian",
};

export function langLabel(code: string): string {
  const lower = code.toLowerCase();
  return LANG_NAMES[lower] || LANG_NAMES[code] || code;
}

// --- Main fetch function ---
export async function getVideasySources(params: {
  tmdbId: number;
  mediaType?: "movie" | "tv";
  title?: string;
  year?: number;
  imdbId?: string;
  season?: number;
  episode?: number;
  provider?: string;
}): Promise<VideasyResult> {
  const {
    tmdbId,
    mediaType = "movie",
    season,
    episode,
    provider,
  } = params;

  let { title, year, imdbId } = params;
  if (!title || !imdbId) {
    const meta = await fetchTmdbMeta(mediaType, tmdbId);
    title = title || meta.title;
    year = year ?? Number(meta.year);
    imdbId = imdbId || meta.imdbId;
  }

  let providerNames: string[];
  if (provider) {
    const found = Object.values(PROVIDERS).find(
      (p) => p.name.toLowerCase() === provider.toLowerCase()
    );
    providerNames = found ? [found.name] : PROVIDER_ORDER;
  } else {
    providerNames = PROVIDER_ORDER;
  }

  let lastError: Error | null = null;

  for (const providerName of providerNames) {
    try {
      const result = await fetchFromProvider(
        providerName,
        tmdbId,
        mediaType,
        title,
        year?.toString() || "",
        imdbId || "",
        season,
        episode
      );
      if (result.sources.length > 0) {
        if (imdbId) {
          const subs = await getVideasySubtitles(imdbId, mediaType, season, episode);
          if (subs.length > 0) {
            const seen = new Set(
              result.subtitles.map((s) => s.language.toLowerCase())
            );
            for (const s of subs) {
              if (!seen.has(s.language.toLowerCase())) {
                result.subtitles.push(s);
                seen.add(s.language.toLowerCase());
              }
            }
          }
        }
        result.provider = providerName;
        return result;
      }
    } catch (e) {
      lastError = e as Error;
    }
  }

  throw lastError || new Error("No sources found from any Videasy provider");
}

async function fetchFromProvider(
  providerName: string,
  tmdbId: number,
  mediaType: string,
  title: string,
  year: string,
  imdbId: string,
  season?: number,
  episode?: number
): Promise<VideasyResult> {
  const providerConfig = Object.values(PROVIDERS).find(
    (p) => p.name === providerName
  );
  if (!providerConfig) throw new Error(`Unknown provider: ${providerName}`);

  const buildUrl = (seed: string): string => {
    const url = new URL(`${API_BASE}/${providerConfig.endpoint}`);
    url.searchParams.append("title", title);
    url.searchParams.append("mediaType", mediaType);
    url.searchParams.append("year", year);
    url.searchParams.append("episodeId", String(episode || 1));
    url.searchParams.append("seasonId", String(season || 1));
    url.searchParams.append("tmdbId", String(tmdbId));
    url.searchParams.append("imdbId", imdbId);
    url.searchParams.append("enc", "2");
    url.searchParams.append("seed", seed);
    return url.toString();
  };

  const fetchSources = async (): Promise<RawSourceResponse> => {
    const seed = await getSeed(tmdbId);
    const resp = await fetchWithTimeout(buildUrl(seed), {
      headers: {
        "User-Agent": UA,
        Referer: REFERER,
        Origin: ORIGIN,
        Accept: "*/*",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
    if (resp.status === 401 || resp.status === 500) {
      invalidateSeed(tmdbId);
      const newSeed = await getSeed(tmdbId);
      const retryResp = await fetchWithTimeout(buildUrl(newSeed), {
        headers: {
          "User-Agent": UA,
          Referer: REFERER,
          Origin: ORIGIN,
          Accept: "*/*",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      });
      if (!retryResp.ok)
        throw new Error(`Source API failed: ${retryResp.status}`);
      const retryText = await retryResp.text();
      return JSON.parse(Pf(retryText, newSeed, tmdbId));
    }
    if (!resp.ok) throw new Error(`Source API failed: ${resp.status}`);
    const text = await resp.text();
    return JSON.parse(Pf(text, seed, tmdbId));
  };

  const raw = await fetchSources();

  const sources: VideasySource[] = (raw.sources || [])
    .filter((s) => s && s.url && s.quality)
    .map((s) => {
      const detectedType =
        s.type ||
        (s.url.includes(".mpd")
          ? "dash"
          : s.url.includes(".m3u8")
            ? "hls"
            : "hls");
      return {
        quality: s.quality,
        url: s.url,
        type: detectedType,
      };
    });

  const subtitles: VideasySubtitle[] = (raw.subtitles || [])
    .filter((s) => s && (s.url || s.file))
    .map((s) => {
      const code = s.lang || s.language || s.label || "en";
      return {
        url: s.url || s.file!,
        language: code,
        label: langLabel(code),
      };
    });

  return {
    sources,
    subtitles,
    thumbnail: raw.thumbnail,
    playlist: raw.playlist,
  };
}

// --- Fetch subtitles from subs.videasy.to ---
export async function getVideasySubtitles(
  imdbId: string,
  mediaType?: string,
  season?: number,
  episode?: number
): Promise<VideasySubtitle[]> {
  try {
    const params = new URLSearchParams({ id: imdbId });
    if (mediaType === "tv" && season && episode) {
      params.set("season", String(season));
      params.set("episode", String(episode));
    }
    const resp = await fetchWithTimeout(`${SUBS_BASE}/search?${params.toString()}`, {
      headers: {
        "User-Agent": UA,
        Referer: REFERER,
        Accept: "application/json",
      },
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    if (!Array.isArray(data)) return [];
    const seen = new Set<string>();
    const result: VideasySubtitle[] = [];
    for (const s of data) {
      const lang = s.language || s.lang || "en";
      if (seen.has(lang)) continue;
      seen.add(lang);
      result.push({
        url: s.url || s.file,
        language: lang,
        label: s.display || langLabel(lang),
        flagUrl: s.flagUrl,
        display: s.display,
      });
    }
    return result;
  } catch {
    return [];
  }
}
