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

const MIRURO_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36",
  Referer: "https://www.miruro.ru/",
  Origin: "https://www.miruro.ru",
  Accept: "*/*",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "sec-fetch-site": "same-origin",
  "sec-fetch-mode": "cors",
  "sec-fetch-dest": "empty",
  "sec-ch-ua": '"Chromium";v="110", "Not A(Brand";v="24", "Google Chrome";v="110"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
};

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

  const payload = { path, method: "GET", query, body: null, version: "0.2.0" };
  const encoded = base64urlEncode(payload);
  const url = `${PIPE_BASE}?e=${encoded}`;

  let resp: any;
  let lastError = "";

  for (let attempt = 0; attempt < 3; attempt++) {
    resp = await fetchFn(url, {
      browser: "chrome_110",
      headers: MIRURO_HEADERS,
    });

    if (resp.status === 200) break;

    const text = await resp.text();
    lastError = `Miruro API error: HTTP ${resp.status} - ${text.substring(0, 200)}`;

    // Retry on 444 (upstream timeout) or 502/503/504 (gateway errors)
    if (resp.status === 444 || resp.status === 502 || resp.status === 503 || resp.status === 504) {
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      continue;
    }

    // Non-retryable error
    throw new Error(lastError);
  }

  if (resp.status !== 200) {
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

export async function getMiruroEpisodes(
  anilistId: number,
): Promise<MiruroEpisodesResponse | null> {
  try {
    return await pipeGet("episodes", { anilistId: String(anilistId) });
  } catch (e) {
    console.error("Miruro episodes error:", e);
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

const PROVIDER_PRIORITY = ["bonk", "kiwi", "ally", "pewe", "bee", "hop"];

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
