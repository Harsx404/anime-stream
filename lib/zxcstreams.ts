// ZxcStreams 4K stream resolver
// Uses session-based auth + AES-encrypted link decryption
// Flow: POST /backend/session → GET /backend_/servers/{server} → AES decrypt links

import { createDecipheriv, createHash } from "node:crypto";
import { fetchTmdbMeta } from "./videasy";

const BASE = "https://player.zxcstream.xyz";
const SERVERS = ["icarus", "berkas", "orion", "athena"];
const AES_KEY = "7f4c9e2a81d63b05c4f7a9e8126d3b50e1a8c7f23d9465ab0c6e9f1d4a7b832c";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36";

export interface ZxcStreamSource {
  quality: string;
  url: string;
  type: string;
  server: string;
}

export interface ZxcStreamResult {
  sources: ZxcStreamSource[];
  subtitles: { url: string; language: string; label?: string }[];
  provider: string;
}

// CryptoJS-compatible AES-256-CBC decryption (OpenSSL Salted__ format)
function evpBytesToKey(password: string, salt: Buffer, keyLen: number, ivLen: number) {
  const data = Buffer.concat([Buffer.from(password, "utf8"), salt]);
  let hash = createHash("md5").update(data).digest();
  let result = hash;
  while (result.length < keyLen + ivLen) {
    hash = createHash("md5").update(Buffer.concat([hash, data])).digest();
    result = Buffer.concat([result, hash]);
  }
  return { key: result.subarray(0, keyLen), iv: result.subarray(keyLen, keyLen + ivLen) };
}

function decryptLink(encrypted: string): string {
  const encBytes = Buffer.from(encrypted, "base64");
  if (encBytes.subarray(0, 8).toString() !== "Salted__") {
    throw new Error("Not OpenSSL Salted format");
  }
  const salt = encBytes.subarray(8, 16);
  const ciphertext = encBytes.subarray(16);
  const { key, iv } = evpBytesToKey(AES_KEY, salt, 32, 16);
  const decipher = createDecipheriv("aes-256-cbc", key, iv);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

function resolutionLabel(res: number | undefined, source?: string): string {
  if (typeof res === "number" && res <= 4) {
    return ["360p", "480p", "720p", "1080p", "4K"][res] ?? `q${res}`;
  }
  if (typeof res === "number") return `${res}p`;
  if (source && source !== "default") return source;
  return "Auto";
}

async function fetchWithTimeout(url: string, opts: RequestInit = {}, ms = 12000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  try {
    const resp = await fetch(url, { ...opts, signal: controller.signal });
    clearTimeout(timeout);
    return resp;
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}

async function getSessionToken(
  server: string,
  tmdbId: string,
  mediaType: string,
  season?: number,
  episode?: number,
) {
  const body: Record<string, unknown> = {
    id: tmdbId,
    media_type: mediaType,
    path: server,
  };
  if (mediaType === "tv" && season != null && episode != null) {
    body.season = season;
    body.episode = episode;
  }

  const resp = await fetchWithTimeout(`${BASE}/backend/session`, {
    method: "POST",
    headers: {
      "User-Agent": UA,
      Accept: "application/json, text/plain, */*",
      "Content-Type": "application/json",
      Origin: BASE,
      Referer: `${BASE}/player/${mediaType}/${tmdbId}`,
    },
    body: JSON.stringify(body),
  }, 10000);

  if (!resp.ok) throw new Error(`Session failed: ${resp.status}`);
  const data = await resp.json();
  if (!data.token || !data.ts) throw new Error("No token/ts in session response");
  return { token: data.token as string, ts: data.ts as number };
}

async function fetchServerLinks(
  server: string,
  tmdbId: string,
  mediaType: string,
  title: string,
  year: string,
  date: string,
  imdbId: string,
  season?: number,
  episode?: number,
): Promise<ZxcStreamSource[]> {
  const { token, ts } = await getSessionToken(server, tmdbId, mediaType, season, episode);

  const params = new URLSearchParams({
    id: tmdbId,
    b: mediaType,
    ts: String(ts),
    token,
    title,
    year,
    date,
  });
  if (imdbId) params.set("imdbId", imdbId);
  if (mediaType === "tv" && season != null && episode != null) {
    params.set("season", String(season));
    params.set("episode", String(episode));
  }

  const resp = await fetchWithTimeout(`${BASE}/backend_/servers/${server}?${params}`, {
    headers: {
      "User-Agent": UA,
      Accept: "application/json, text/plain, */*",
      Origin: BASE,
      Referer: `${BASE}/player/${mediaType}/${tmdbId}`,
    },
  }, 10000);

  if (!resp.ok) return [];
  const data = await resp.json();
  if (!data.success || !Array.isArray(data.links)) return [];

  const sources: ZxcStreamSource[] = [];
  for (const link of data.links) {
    if (!link.link) continue;
    try {
      const decryptedUrl = decryptLink(link.link);
      const type = link.type || (decryptedUrl.includes(".m3u8") ? "hls" : "mp4");
      const quality = resolutionLabel(link.resolution, link.source);
      sources.push({ quality, url: decryptedUrl, type, server });
    } catch {
      // skip undecryptable links
    }
  }
  return sources;
}

export async function getZxcStreams(params: {
  tmdbId: number;
  mediaType?: "movie" | "tv";
  title?: string;
  year?: number;
  imdbId?: string;
  season?: number;
  episode?: number;
}): Promise<ZxcStreamResult> {
  const { tmdbId, mediaType = "movie", season, episode } = params;
  let { title, year, imdbId } = params;

  if (!title || !imdbId) {
    try {
      const meta = await fetchTmdbMeta(mediaType, tmdbId);
      title = title || meta.title;
      year = year ?? Number(meta.year);
      imdbId = imdbId || meta.imdbId;
    } catch {
      // continue with what we have
    }
  }

  if (!title) return { sources: [], subtitles: [], provider: "ZxcStreams" };

  const dateStr = year ? `${year}-01-01` : "";
  const tmdbStr = String(tmdbId);

  const results = await Promise.allSettled(
    SERVERS.map((s) =>
      fetchServerLinks(s, tmdbStr, mediaType, title, String(year || ""), dateStr, imdbId || "", season, episode),
    ),
  );

  const allSources: ZxcStreamSource[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") allSources.push(...r.value);
  }

  // Sort: higher resolution first, MP4 over HLS
  const resOrder: Record<string, number> = { "4K": 0, "2160p": 0, "1080p": 1, "720p": 2, "480p": 3, "360p": 4 };
  allSources.sort((a, b) => {
    const aRank = resOrder[a.quality] ?? 99;
    const bRank = resOrder[b.quality] ?? 99;
    if (aRank !== bRank) return aRank - bRank;
    return (a.type === "mp4" ? 0 : 1) - (b.type === "mp4" ? 0 : 1);
  });

  return { sources: allSources, subtitles: [], provider: "ZxcStreams" };
}
