// VixSrc stream resolver
// Fetches HLS streams from vixsrc.to with multi-audio and subtitles
// Flow: API → embed page → extract token → master HLS playlist

import { dnsFetch } from "./dns-fix";

const BASE_URL = "https://vixsrc.to";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36";

export interface VixSrcSource {
  url: string;
  quality: string;
  type: "hls";
  provider: string;
  headers?: Record<string, string>;
}

export interface VixSrcSubtitle {
  url: string;
  label: string;
  language: string;
}

export interface VixSrcResult {
  sources: VixSrcSource[];
  subtitles: VixSrcSubtitle[];
  provider: string;
}

function fetchWithTimeout(url: string, opts: RequestInit = {}, ms = 10000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  return dnsFetch(url, { ...opts, signal: controller.signal } as Parameters<typeof dnsFetch>[1]).finally(() =>
    clearTimeout(timeout),
  );
}

export async function getVixSrcSources(params: {
  tmdbId: number;
  mediaType: "movie" | "tv";
  season?: number;
  episode?: number;
}): Promise<VixSrcResult> {
  const { tmdbId, mediaType, season, episode } = params;
  const headers: Record<string, string> = {
    "User-Agent": UA,
    Accept: "application/json, text/javascript, */*; q=0.01",
    "Accept-Language": "en-US,en;q=0.9",
    Referer: BASE_URL,
    Origin: BASE_URL,
  };

  // Step 1: Get embed URL from API
  const apiUrl =
    mediaType === "tv"
      ? `${BASE_URL}/api/tv/${tmdbId}/${season || 1}/${episode || 1}`
      : `${BASE_URL}/api/movie/${tmdbId}`;

  const apiResp = await fetchWithTimeout(apiUrl, { headers });
  if (!apiResp.ok) throw new Error(`VixSrc API returned ${apiResp.status}`);
  const apiData = await apiResp.json();
  if (!apiData.src) throw new Error("VixSrc API returned no src");

  // Step 2: Fetch embed page to extract token/expires/playlist
  const embedUrl = `${BASE_URL}${apiData.src}`;
  const embedResp = await fetchWithTimeout(embedUrl, {
    headers: { ...headers, Accept: "text/html,application/xhtml+xml,*/*" },
  });
  if (!embedResp.ok) throw new Error(`VixSrc embed returned ${embedResp.status}`);
  const embedHtml = await embedResp.text();

  const token = embedHtml.match(/token["']\s*:\s*["']([^"']+)/)?.[1];
  const expires = embedHtml.match(/expires["']\s*:\s*["']([^"']+)/)?.[1];
  const playlist = embedHtml.match(/url\s*:\s*["']([^"']+)/)?.[1];

  if (!token || !expires || !playlist) {
    throw new Error("VixSrc: failed to extract token/expires/playlist from embed page");
  }

  // Check token expiry (with 60s grace)
  if (parseInt(expires, 10) * 1000 - 60_000 < Date.now()) {
    throw new Error("VixSrc: token already expired");
  }

  // Step 3: Build master playlist URL
  const sep = playlist.includes("?") ? "&" : "?";
  const masterUrl = `${playlist}${sep}token=${token}&expires=${expires}&h=1`;

  // Step 4: Fetch master playlist to parse qualities and subtitles
  const masterResp = await fetchWithTimeout(masterUrl, {
    headers: { ...headers, Accept: "application/vnd.apple.mpegurl,*/*", Referer: embedUrl },
  });
  if (!masterResp.ok) throw new Error(`VixSrc playlist returned ${masterResp.status}`);
  const masterText = await masterResp.text();

  // Parse subtitles from master playlist
  const subtitles: VixSrcSubtitle[] = [];
  const subLines = masterText.split("\n");
  for (const line of subLines) {
    if (!line.startsWith("#EXT-X-MEDIA:TYPE=SUBTITLES")) continue;
    const url = line.match(/URI="([^"]+)"/)?.[1];
    const label = line.match(/NAME="([^"]+)"/)?.[1] ?? "unknown";
    const language = line.match(/LANGUAGE="([^"]+)"/)?.[1] ?? "unknown";
    if (url) {
      subtitles.push({ url, label, language });
    }
  }

  // Parse quality variants
  const variants: { resolution: number; url: string }[] = [];
  const variantRegex = /#EXT-X-STREAM-INF:[^\n]*RESOLUTION=\d+x(\d+)[^\n]*\n([^\n]+)/g;
  let match;
  while ((match = variantRegex.exec(masterText)) !== null) {
    const resolution = parseInt(match[1], 10);
    const variantUrl = match[2].trim();
    variants.push({ resolution, url: variantUrl });
  }

  if (variants.length === 0) {
    // Use master URL directly if no variants parsed
    variants.push({ resolution: 1080, url: masterUrl });
  }

  // Sort by quality descending
  variants.sort((a, b) => b.resolution - a.resolution);

  const sources: VixSrcSource[] = [
    {
      url: masterUrl,
      quality: variants[0].resolution >= 2160 ? "4K" : `${variants[0].resolution}p`,
      type: "hls",
      provider: "VixSrc",
      headers: {
        Referer: embedUrl,
        "User-Agent": UA,
      },
    },
  ];

  return { sources, subtitles, provider: "VixSrc" };
}
