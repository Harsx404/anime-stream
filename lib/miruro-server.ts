// Miruro.ru API client - server-side, uses wreq-js for TLS fingerprint bypass
// No browser needed — wreq-js uses native Rust bindings to impersonate Chrome's TLS fingerprint

import { gunzipSync } from "zlib";

const OBF_KEY_HEX = "71951034f8fbcf53d89db52ceb3dc22c";
const PIPE_BASE = "https://www.miruro.ru/api/secure/pipe";

function hexToBytes(hex: string): Buffer {
  return Buffer.from(hex.match(/.{2}/g)!.map((e) => parseInt(e, 16)));
}

const OBF_KEY = hexToBytes(OBF_KEY_HEX);

function base64urlEncode(obj: unknown): string {
  const json = JSON.stringify(obj);
  const encoded = encodeURIComponent(json).replace(
    /%([0-9A-F]{2})/g,
    (_, p1) => String.fromCharCode(parseInt(p1, 16)),
  );
  return Buffer.from(encoded, "binary").toString("base64url");
}

function base64urlDecode(text: string): Buffer {
  return Buffer.from(text, "base64url");
}

function xorBytes(data: Buffer, key: Buffer): Buffer {
  const result = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i++) {
    result[i] = data[i] ^ key[i % key.length];
  }
  return result;
}

function decodeResponse(text: string, obfuscated: string | null): any {
  if (!obfuscated) {
    try {
      return JSON.parse(text);
    } catch {
      const bytes = base64urlDecode(text);
      if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
        return JSON.parse(gunzipSync(bytes).toString("utf-8"));
      }
      return JSON.parse(bytes.toString("utf-8"));
    }
  }

  let bytes = base64urlDecode(text);

  if (obfuscated === "2") {
    bytes = xorBytes(bytes, OBF_KEY);
  }

  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    return JSON.parse(gunzipSync(bytes).toString("utf-8"));
  }

  return JSON.parse(bytes.toString("utf-8"));
}

// --- wreq-js HTTP client ---

function headersForProfile(profile: string): Record<string, string> {
  const versions: Record<string, { ua: string; chua: string }> = {
    chrome_131: {
      ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      chua: '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    },
    chrome_120: {
      ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      chua: '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    },
    chrome_110: {
      ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36",
      chua: '"Chromium";v="110", "Not A(Brand";v="24", "Google Chrome";v="110"',
    },
  };
  const v = versions[profile] || versions.chrome_131;
  return {
    "User-Agent": v.ua,
    Referer: "https://www.miruro.ru/",
    Origin: "https://www.miruro.ru",
    Accept: "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "sec-fetch-site": "same-origin",
    "sec-fetch-mode": "cors",
    "sec-fetch-dest": "empty",
    "sec-ch-ua": v.chua,
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
  };
}

const BROWSER_PROFILES = ["chrome_131", "chrome_120", "chrome_110"];

let wreqFetch: ((url: string, init?: any) => Promise<any>) | null = null;

async function getWreqFetch() {
  if (wreqFetch) return wreqFetch;
  const wreq = await import("wreq-js");
  wreqFetch = (wreq as any).fetch;
  return wreqFetch;
}

async function pipeGet(
  path: string,
  query: Record<string, any>,
): Promise<any> {
  const fetchFn = await getWreqFetch();
  if (!fetchFn) throw new Error("wreq-js fetch not initialized");

  const payload = { path, method: "GET", query, body: null, version: "0.1.0" };
  const encoded = base64urlEncode(payload);
  const url = `${PIPE_BASE}?e=${encoded}`;

  let resp: any;
  let lastError = "";
  let profileUsed = "";

  for (const profile of BROWSER_PROFILES) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        resp = await fetchFn(url, {
          browser: profile,
          headers: headersForProfile(profile),
          timeout: 10000,
        });
      } catch (e: any) {
        lastError = `wreq-js error with ${profile}: ${String(e)}`;
        continue;
      }

      if (resp.status === 200) {
        profileUsed = profile;
        console.log(`[Miruro] Success with profile ${profile}`);
        break;
      }

      const text = await resp.text();
      lastError = `Miruro API error: HTTP ${resp.status} - ${text.substring(0, 200)}`;

      // Retry on 444 (upstream timeout) or 502/503/504 (gateway errors)
      if (resp.status === 444 || resp.status === 502 || resp.status === 503 || resp.status === 504) {
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }

      // 403 = Cloudflare challenge, try next profile
      if (resp.status === 403) {
        console.log(`[Miruro] Profile ${profile} got 403, trying next...`);
        break;
      }

      // Non-retryable error
      throw new Error(lastError);
    }
    if (resp?.status === 200) break;
  }

  if (resp?.status !== 200) {
    throw new Error(lastError);
  }

  const text = await resp.text();
  const obfuscated = resp.headers.get("x-obfuscated");
  return decodeResponse(text, obfuscated);
}

// --- Types ---

export interface MiruroEpisode {
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

export interface MiruroProviderData {
  meta: { id: string; title?: string; totalEpisodes?: number };
  episodes: { sub?: MiruroEpisode[]; dub?: MiruroEpisode[] };
}

export interface MiruroEpisodesResponse {
  mappings: {
    id: number;
    title: string;
    type: string;
    episodes?: number;
    aniId: number;
    malId?: number;
    providers: Record<string, { id: number; provider_id: string[] }>;
  };
  providers: Record<string, MiruroProviderData>;
}

export interface MiruroStream {
  url: string;
  type: string;
  referer?: string;
  server?: string;
  default?: boolean;
  isActive?: boolean;
}

export interface MiruroSubtitle {
  file: string;
  label: string;
  kind?: string;
}

export interface MiruroSourcesResponse {
  streams: MiruroStream[];
  subtitles: MiruroSubtitle[];
  download?: any[];
}

// --- Public API ---

const episodesCache = new Map<number, { data: MiruroEpisodesResponse | null; ts: number }>();
const EPISODES_CACHE_TTL = 60000; // 1 minute

export async function getMiruroEpisodes(
  anilistId: number,
): Promise<MiruroEpisodesResponse | null> {
  const cached = episodesCache.get(anilistId);
  if (cached && Date.now() - cached.ts < EPISODES_CACHE_TTL) {
    return cached.data;
  }
  try {
    const data = await pipeGet("episodes", { anilistId: String(anilistId) });
    console.log(`[Miruro] Episodes for ${anilistId}: providers=${Object.keys(data?.providers || {}).join(",") || "none"}`);
    episodesCache.set(anilistId, { data, ts: Date.now() });
    return data;
  } catch (e) {
    console.error(`[Miruro] Episodes error for ${anilistId}:`, String(e));
    episodesCache.set(anilistId, { data: null, ts: Date.now() });
    return null;
  }
}

export async function getMiruroSources(
  episodeId: string,
  provider: string,
  category: string,
  anilistId: number,
): Promise<MiruroSourcesResponse | null> {
  try {
    return await pipeGet("sources", {
      episodeId,
      provider,
      category,
      anilistId,
    });
  } catch (e) {
    console.error("Miruro sources error:", e);
    return null;
  }
}

const PROVIDER_PRIORITY = ["ally", "kiwi", "bonk", "pewe", "bee", "hop"];

export interface ProviderInfo {
  name: string;
  hasSub: boolean;
  hasDub: boolean;
  episodeCount: number;
  subCount: number;
  dubCount: number;
}

export async function getMiruroProviderList(
  anilistId: number,
): Promise<ProviderInfo[]> {
  const data = await getMiruroEpisodes(anilistId);
  if (!data?.providers) return [];

  const result: ProviderInfo[] = [];
  for (const [name, p] of Object.entries(data.providers)) {
    const hasSub = !!(p?.episodes?.sub?.length);
    const hasDub = !!(p?.episodes?.dub?.length);
    if (hasSub || hasDub) {
      const subCount = p.episodes.sub?.length || 0;
      const dubCount = p.episodes.dub?.length || 0;
      result.push({
        name,
        hasSub,
        hasDub,
        episodeCount: subCount + dubCount,
        subCount,
        dubCount,
      });
    }
  }
  return result;
}

export async function getMiruroEpisodeList(
  anilistId: number,
  provider?: string,
  category?: "sub" | "dub",
): Promise<MiruroEpisode[]> {
  const data = await getMiruroEpisodes(anilistId);
  if (!data?.providers) return [];

  if (provider && data.providers[provider]) {
    const p = data.providers[provider];
    const cat = category || "sub";
    const eps = cat === "dub" ? p.episodes?.dub : p.episodes?.sub;
    if (eps?.length) return eps;
  }

  for (const prov of PROVIDER_PRIORITY) {
    const p = data.providers[prov];
    if (p?.episodes?.sub?.length) return p.episodes.sub;
  }

  for (const p of Object.values(data.providers)) {
    if (p?.episodes?.sub?.length) return p.episodes.sub;
  }

  return [];
}

export async function getMiruroProvider(
  anilistId: number,
): Promise<{ name: string; category: string } | null> {
  const data = await getMiruroEpisodes(anilistId);
  if (!data?.providers) return null;

  for (const provider of PROVIDER_PRIORITY) {
    const p = data.providers[provider];
    if (p?.episodes?.sub?.length) return { name: provider, category: "sub" };
    if (p?.episodes?.dub?.length) return { name: provider, category: "dub" };
  }

  return null;
}
