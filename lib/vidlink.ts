// VidLink Pro stream resolver
// Reverse-engineered from vidlink.pro's player bundle
// Uses XSalsa20-Poly1305 (NaCl secretbox) for token encryption

import nacl from "tweetnacl";

const API_BASE = "https://vidlink.pro/api/b";
const KEY_HEX = "c75136c5668bbfe65a7ecad431a745db68b5f381555b38d8f6c699449cf11fcd";
const KEY = hexToBytes(KEY_HEX);
const NONCE = new Uint8Array(24); // 24 zero bytes

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36";

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function encryptToken(mediaId: string): string {
  const timestamp = Math.floor(Date.now() / 1000) + 480;
  const idBytes = new TextEncoder().encode(mediaId);

  const tsBuf = new Uint8Array(8);
  const view = new DataView(tsBuf.buffer);
  view.setUint32(0, Math.floor(timestamp / 0x100000000));
  view.setUint32(4, timestamp >>> 0);

  const message = new Uint8Array(idBytes.length + 8);
  message.set(idBytes);
  message.set(tsBuf, idBytes.length);

  const encrypted = nacl.secretbox(message, NONCE, KEY);
  if (!encrypted) throw new Error("Token encryption failed");

  const payload = new Uint8Array(24 + encrypted.length);
  payload.set(NONCE);
  payload.set(encrypted, 24);

  let b64 = Buffer.from(payload).toString("base64");
  b64 = b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return b64;
}

// --- Types ---
export interface VidLinkSource {
  quality: string;
  url: string;
  type: string;
}

export interface VidLinkSubtitle {
  url: string;
  language: string;
  label?: string;
}

export interface VidLinkResult {
  sources: VidLinkSource[];
  subtitles: VidLinkSubtitle[];
  provider: string;
}

interface VidLinkQuality {
  type: string;
  url: string;
  codecName?: string;
  size?: string;
  headers?: Record<string, string>;
  requiresProxy?: boolean;
}

interface VidLinkCaption {
  id?: string;
  url: string;
  language?: string;
  lang?: string;
  label?: string;
  type?: string;
}

interface VidLinkApiResponse {
  sourceId?: string;
  stream?: {
    id?: string;
    type?: string;
    qualities?: Record<string, VidLinkQuality>;
    file?: string;
    playlist?: string;
    sources?: Array<{ file: string; label?: string; type?: string }>;
  };
  captions?: VidLinkCaption[];
  sources?: Array<{ file: string; label?: string; type?: string }>;
  playlist?: string;
  file?: string;
}

function detectType(url: string): string {
  if (url.includes(".mpd")) return "dash";
  if (url.includes(".m3u8")) return "hls";
  return "hls";
}

function extractQuality(label?: string, url?: string): string {
  if (label) {
    const match = label.match(/(\d{3,4})p?/i);
    if (match) return `${match[1]}p`;
    return label;
  }
  if (url) {
    const match = url.match(/(\d{3,4})p?/i);
    if (match) return `${match[1]}p`;
  }
  return "Auto";
}

export async function getVidLinkSources(params: {
  tmdbId: number;
  mediaType: "movie" | "tv";
  season?: number;
  episode?: number;
}): Promise<VidLinkResult> {
  const { tmdbId, mediaType, season, episode } = params;

  const token = encryptToken(String(tmdbId));
  const url =
    mediaType === "movie"
      ? `${API_BASE}/movie/${token}?multiLang=1`
      : `${API_BASE}/tv/${token}/${season || 1}/${episode || 1}?multiLang=1`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  let resp: Response;
  try {
    resp = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        Origin: "https://vidlink.pro",
        Referer: "https://vidlink.pro/",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "cross-site",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!resp.ok) {
    throw new Error(`VidLink API failed: ${resp.status}`);
  }

  const data: VidLinkApiResponse = await resp.json();

  const sources: VidLinkSource[] = [];
  const subtitles: VidLinkSubtitle[] = [];

  // Primary path: stream.qualities object (keyed by quality string)
  if (data.stream?.qualities) {
    for (const [qualityKey, q] of Object.entries(data.stream.qualities)) {
      if (q.url) {
        sources.push({
          quality: `${qualityKey}p`,
          url: q.url,
          type: q.type === "mp4" ? "mp4" : detectType(q.url),
        });
      }
    }
  }

  // Fallback: stream.sources array (older API format)
  if (sources.length === 0 && data.stream?.sources) {
    for (const s of data.stream.sources) {
      if (s.file) {
        sources.push({
          quality: extractQuality(s.label, s.file),
          url: s.file,
          type: s.type || detectType(s.file),
        });
      }
    }
  }

  // Fallback: top-level sources array
  if (sources.length === 0 && data.sources) {
    for (const s of data.sources) {
      if (s.file) {
        sources.push({
          quality: extractQuality(s.label, s.file),
          url: s.file,
          type: s.type || detectType(s.file),
        });
      }
    }
  }

  // Fallback: single file/playlist
  if (sources.length === 0) {
    const file = data.stream?.file || data.file || data.stream?.playlist || data.playlist;
    if (file) {
      sources.push({
        quality: "Auto",
        url: file,
        type: detectType(file),
      });
    }
  }

  // Extract subtitles from captions array
  if (data.captions) {
    for (const c of data.captions) {
      const subUrl = c.url || (c as any).file;
      if (subUrl) {
        const lang = c.language || c.lang || "en";
        subtitles.push({
          url: subUrl,
          language: lang,
          label: c.label || lang,
        });
      }
    }
  }

  if (sources.length === 0) {
    throw new Error("No streams found from VidLink");
  }

  return {
    sources,
    subtitles,
    provider: "VidLink",
  };
}
