"use client";

// Client-side Miruro API - fetches directly from browser to bypass Cloudflare datacenter IP blocking

const OBF_KEY_HEX = "71951034f8fbcf53d89db52ceb3dc22c";
const PIPE_BASE = "https://www.miruro.ru/api/secure/pipe";

function hexToBytes(hex: string): Uint8Array {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < arr.length; i++) {
    arr[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return arr;
}

const OBF_KEY = hexToBytes(OBF_KEY_HEX);

function base64urlEncode(obj: unknown): string {
  const json = JSON.stringify(obj);
  const encoded = encodeURIComponent(json).replace(
    /%([0-9A-F]{2})/g,
    (_, p1) => String.fromCharCode(parseInt(p1, 16)),
  );
  return btoa(encoded).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(text: string): Uint8Array {
  const b64 = text.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4;
  const padded = pad ? b64 + "=".repeat(4 - pad) : b64;
  const binStr = atob(padded);
  const arr = new Uint8Array(binStr.length);
  for (let i = 0; i < binStr.length; i++) arr[i] = binStr.charCodeAt(i);
  return arr;
}

function xorBytes(data: Uint8Array, key: Uint8Array): Uint8Array {
  const result = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    result[i] = data[i] ^ key[i % key.length];
  }
  return result;
}

async function gunzip(bytes: Uint8Array): Promise<string> {
  const cs = new DecompressionStream("gzip");
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(cs);
  return await new Response(stream).text();
}

async function decodeResponse(text: string, obfuscated: string | null): Promise<any> {
  if (!obfuscated) {
    try {
      return JSON.parse(text);
    } catch {
      const bytes = base64urlDecode(text);
      if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
        return JSON.parse(await gunzip(bytes));
      }
      return JSON.parse(new TextDecoder().decode(bytes));
    }
  }

  let bytes = base64urlDecode(text);

  if (obfuscated === "2") {
    bytes = xorBytes(bytes, OBF_KEY);
  }

  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    return JSON.parse(await gunzip(bytes));
  }

  return JSON.parse(new TextDecoder().decode(bytes));
}

const MIRURO_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Referer: "https://www.miruro.ru/",
  Origin: "https://www.miruro.ru",
  Accept: "*/*",
  "Accept-Language": "en-US,en;q=0.9",
  "sec-fetch-site": "same-origin",
  "sec-fetch-mode": "cors",
  "sec-fetch-dest": "empty",
  "sec-ch-ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
};

async function pipeGet(
  path: string,
  query: Record<string, any>,
): Promise<any> {
  const payload = { path, method: "GET", query, body: null, version: "0.1.0" };
  const encoded = base64urlEncode(payload);
  const url = `${PIPE_BASE}?e=${encoded}`;

  const resp = await fetch(url, {
    headers: MIRURO_HEADERS,
    mode: "cors",
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Miruro API error: HTTP ${resp.status} - ${text.substring(0, 200)}`);
  }

  const text = await resp.text();
  const obfuscated = resp.headers.get("x-obfuscated");
  return decodeResponse(text, obfuscated);
}

export interface ClientMiruroEpisode {
  id: string;
  number: number;
  title?: string;
  image?: string;
  description?: string;
  filler?: boolean;
  hasDub?: boolean;
  duration?: number;
  airDate?: string;
}

export interface ClientProviderInfo {
  name: string;
  hasSub: boolean;
  hasDub: boolean;
  episodeCount: number;
  subCount: number;
  dubCount: number;
}

export interface ClientMiruroSource {
  url: string;
  quality: string;
  isM3U8: boolean;
  referer?: string;
  type: string;
  default?: boolean;
}

export interface ClientMiruroSub {
  url: string;
  lang: string;
}

export interface ClientMiruroSources {
  sources: ClientMiruroSource[];
  subs: ClientMiruroSub[];
  download?: { url: string; label?: string }[];
}

export async function fetchMiruroEpisodes(
  anilistId: number,
  provider?: string,
  category?: "sub" | "dub",
): Promise<{ episodes: ClientMiruroEpisode[]; providers: ClientProviderInfo[] }> {
  const data = await pipeGet("episodes", { anilistId });

  const providersObj = data.providers || {};
  const providerNames = Object.keys(providersObj);

  const providers: ClientProviderInfo[] = providerNames.map((name) => {
    const prov = providersObj[name];
    const subEps = prov?.episodes?.sub || [];
    const dubEps = prov?.episodes?.dub || [];
    return {
      name,
      hasSub: subEps.length > 0,
      hasDub: dubEps.length > 0,
      episodeCount: Math.max(subEps.length, dubEps.length),
      subCount: subEps.length,
      dubCount: dubEps.length,
    };
  });

  // Pick the provider
  let useProvider = provider;
  if (!useProvider) {
    // Prefer providers with most sub episodes
    const sorted = [...providers].sort((a, b) => b.subCount - a.subCount);
    useProvider = sorted[0]?.name;
  }
  if (!useProvider) {
    return { episodes: [], providers };
  }

  const cat = category || "sub";
  const provData = providersObj[useProvider];
  const eps = provData?.episodes?.[cat] || provData?.episodes?.sub || [];

  const episodes: ClientMiruroEpisode[] = eps.map((ep: any) => ({
    id: ep.id,
    number: ep.number,
    title: ep.title,
    image: ep.image,
    description: ep.description,
    filler: ep.filler,
    hasDub: !!(provData?.episodes?.dub?.length),
    duration: ep.duration,
    airDate: ep.airDate,
  }));

  return { episodes, providers };
}

export async function fetchMiruroSources(
  episodeId: string,
  provider: string,
  category: string,
  anilistId: number,
): Promise<ClientMiruroSources> {
  let useProvider = provider;
  let useCategory = category;

  // Auto-detect provider if not specified
  if (!useProvider) {
    const epData = await pipeGet("episodes", { anilistId });
    const providersObj = epData.providers || {};
    const providerNames = Object.keys(providersObj);
    // Prefer providers with most sub episodes
    const sorted = providerNames
      .map((name) => {
        const prov = providersObj[name];
        const subEps = prov?.episodes?.sub || [];
        const dubEps = prov?.episodes?.dub || [];
        return { name, subCount: subEps.length, dubCount: dubEps.length };
      })
      .sort((a, b) => b.subCount - a.subCount);
    useProvider = sorted[0]?.name;
    if (!useProvider) {
      return { sources: [], subs: [], download: [] };
    }
  }

  const data = await pipeGet("sources", {
    episodeId,
    provider: useProvider,
    category: useCategory,
    anilistId,
  });

  const streams = data.streams || [];
  const hlsStreams = streams.filter((s: any) => s.type === "hls" && s.isActive !== false);
  const embedStreams = streams.filter((s: any) => s.type === "embed");
  const allStreams = [...hlsStreams, ...embedStreams];

  return {
    sources: allStreams.map((s: any, i: number) => ({
      url: s.url,
      quality: s.server || `Server ${i + 1}`,
      isM3U8: s.type === "hls",
      referer: s.referer,
      type: s.type,
      default: s.default,
    })),
    subs: (data.subtitles || []).map((sub: any) => ({
      url: sub.file,
      lang: sub.label || "English",
    })),
    download: Array.isArray(data.download)
      ? data.download.map((d: any) => ({ url: d.url, label: d.label || d.quality || "Download" }))
      : [],
  };
}
