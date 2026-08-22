// 4KHDHub stream resolver
// Scrapes 4khdhub.one for movie/TV download links
// Resolves HubCloud links to direct Cloudflare R2 URLs for streaming

const BASE = "https://4khdhub.one";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36";

export interface Hd4khubSource {
  quality: string;
  url: string;
  type: string;
  label: string;
  size: string;
  languages: string;
}

export interface Hd4khubResult {
  sources: Hd4khubSource[];
  subtitles: { url: string; language: string; label?: string }[];
  provider: string;
  debug?: any;
}

const QUALITY_RANK: Record<string, number> = {
  "4K": 0, "2160p": 0,
  "1080p": 1,
  "720p": 2,
  "480p": 3,
  "360p": 4,
};

async function fetchHtml(url: string, timeoutMs = 8000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,*/*",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: BASE,
      },
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

// --- Search 4khdhub.one ---

interface SearchResult {
  url: string;
  title: string;
  year: string;
  isSeries: boolean;
}

async function search4khdhub(title: string): Promise<SearchResult[]> {
  const html = await fetchHtml(`${BASE}/?s=${encodeURIComponent(title)}`);
  if (!html) return [];

  const results: SearchResult[] = [];
  // Match links like /rush-movie-7803/ or /outer-banks-series-2214/
  // Match both absolute and relative URLs
  const linkRegex = /href="(?:https?:\/\/4khdhub\.one)?(\/[^"]*-(?:movie|series)-\d+\/?)"/g;
  const seen = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(html)) !== null) {
    const path = match[1];
    const url = `${BASE}${path.endsWith("/") ? path : path + "/"}`;
    if (seen.has(url)) continue;
    seen.add(url);

    // Extract title from URL slug: /rush-movie-7803/ -> "Rush"
    const slugMatch = url.match(/\/([^/]+)-(movie|series)-\d+/);
    if (!slugMatch) continue;

    const slug = slugMatch[1];
    const isSeries = slugMatch[2] === "series";
    const titleFromSlug = slug
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim();

    // Try to find year from the card (e.g., "2013" or "2020 • S01-S05")
    // Look for nearby year text after this link in the HTML
    const afterIndex = match.index + match[0].length;
    const snippet = html.slice(afterIndex, afterIndex + 500);
    const yearMatch = snippet.match(/(\d{4})/);

    results.push({
      url,
      title: titleFromSlug,
      year: yearMatch ? yearMatch[1] : "",
      isSeries,
    });
  }

  return results;
}

// --- Parse detail page ---

interface DownloadOption {
  title: string;
  quality: string;
  source: string;
  size: string;
  languages: string;
  hubcloudUrl: string;
  episodeLabel?: string;
}

function parseDetailPage(html: string, isSeries: boolean, season?: number, episode?: number): DownloadOption[] {
  const options: DownloadOption[] = [];

  if (isSeries && season != null) {
    // Parse individual episodes section
    options.push(...parseSeriesEpisodes(html, season, episode));
  }

  // Also parse complete season / movie download groups
  options.push(...parseDownloadGroups(html));

  return options;
}

function parseDownloadGroups(html: string): DownloadOption[] {
  const options: DownloadOption[] = [];
  // Match download-item divs (actual HTML structure from 4khdhub.one)
  // Each download-item contains a download-header with title/badges and a content div with links
  const itemRegex = /<div class="download-item[^"]*">([\s\S]*?)(?=<div class="download-item[\s"]|<\/div>\s*<\/div>\s*<\/div>|$)/g;
  let itemMatch: RegExpExecArray | null;

  while ((itemMatch = itemRegex.exec(html)) !== null) {
    const itemHtml = itemMatch[1];

    // Extract title from the header text (e.g., "Rush (2160p BluRay HDR DV HEVC)")
    // It's in a div with class "flex-1 text-left font-semibold"
    const titleMatch = itemHtml.match(/<div class="flex-1 text-left font-semibold">\s*\n?\s*([^<\n]+)/);
    const title = titleMatch?.[1]?.trim() || "";

    // Extract size from badge with #ea580c color
    const sizeMatch = itemHtml.match(/<span class="badge"[^>]*#ea580c[^>]*>\s*([\d.]+\s*(?:GB|MB|TB))\s*<\/span>/i);
    const size = sizeMatch?.[1]?.trim() || "";

    // Extract languages from badge with #0d9488 color
    const langMatch = itemHtml.match(/<span class="badge"[^>]*#0d9488[^>]*>\s*([^<]+)\s*<\/span>/i);
    const languages = langMatch?.[1]?.trim() || "";

    // Extract quality from title text
    const qualityMatch = title.match(/(2160p|1080p|720p|480p|4K)/i);
    const quality = qualityMatch?.[1] || "";

    // Extract source (BluRay, WEB-DL, etc.) from badge with #15803d color
    const sourceMatch = itemHtml.match(/<span class="badge"[^>]*#15803d[^>]*>\s*([^<]+)\s*<\/span>/i);
    const source = sourceMatch?.[1]?.trim() || "";

    // Extract hubcloud/hubdrive link from the content div
    // Links are in <a target="_blank" href="https://hubcloud.cx/drive/..." class="btn ...">
    const hubcloudMatch = itemHtml.match(/href="(https:\/\/hubcloud\.[a-z]+\/drive\/[^"]+)"/);
    const hubdriveMatch = itemHtml.match(/href="(https:\/\/hubdrive\.[a-z]+\/drive\/[^"]+)"/);
    const hubcloudUrl = hubcloudMatch?.[1] || hubdriveMatch?.[1] || "";

    if (hubcloudUrl && title) {
      options.push({
        title,
        quality,
        source,
        size,
        languages,
        hubcloudUrl,
      });
    }
  }

  return options;
}

function parseSeriesEpisodes(html: string, season: number, episode?: number): DownloadOption[] {
  const options: DownloadOption[] = [];

  // Find the "Individual Episodes" section
  const epSectionMatch = html.match(/Individual Episodes<\/h2>([\s\S]*?)(?:<h2|<footer|$)/i);
  if (!epSectionMatch) return [];

  const sectionHtml = epSectionMatch[1];

  // Find season items: <div class="season-item episode-item">
  // Each has an episode-header with data-episode-id and episode-number (e.g., "S05")
  // and an episode-content div with download links
  const seasonItemRegex = /<div class="season-item episode-item[^"]*">([\s\S]*?)(?=<div class="season-item episode-item|<\/div>\s*<\/div>\s*<\/div>|$)/g;
  let seasonItemMatch: RegExpExecArray | null;

  while ((seasonItemMatch = seasonItemRegex.exec(sectionHtml)) !== null) {
    const itemHtml = seasonItemMatch[1];

    // Extract season number from episode-number div (e.g., "S05" -> 5)
    const seasonNumMatch = itemHtml.match(/<div class="episode-number">\s*S?(\d+)\s*<\/div>/i);
    if (!seasonNumMatch) continue;
    const seasonNum = parseInt(seasonNumMatch[1], 10);
    if (seasonNum !== season) continue;

    // Extract episode title/meta for quality info
    const epTitleMatch = itemHtml.match(/<h3 class="episode-title">([^<]+)<\/h3>/);
    const epTitle = epTitleMatch?.[1]?.trim() || "";

    // Extract quality from episode title
    const qualityMatch = epTitle.match(/(2160p|1080p|720p|480p)/i);
    const quality = qualityMatch?.[1] || "";

    // Extract languages from badge with #0d9488
    const langMatch = itemHtml.match(/<span class="badge"[^>]*#0d9488[^>]*>\s*([^<]+)\s*<\/span>/i);
    const languages = langMatch?.[1]?.trim() || "";

    // Extract all hubcloud/hubdrive links in this season item
    const linkRegex = /href="(https:\/\/hubcloud\.[a-z]+\/drive\/[^"]+)"/g;
    const driveRegex = /href="(https:\/\/hubdrive\.[a-z]+\/drive\/[^"]+)"/g;
    const allLinks: string[] = [];
    let linkMatch: RegExpExecArray | null;
    while ((linkMatch = linkRegex.exec(itemHtml)) !== null) allLinks.push(linkMatch[1]);
    while ((linkMatch = driveRegex.exec(itemHtml)) !== null) allLinks.push(linkMatch[1]);

    // If episode filter is specified, look for episode-specific links
    // The episode content may have multiple download items for different episodes
    if (episode != null) {
      // Try to find episode-specific download items within the content
      const epDownloadRegex = /<div class="episode-download-item">([\s\S]*?)(?=<div class="episode-download-item"|<\/div>\s*<\/div>|$)/g;
      let epDownloadMatch: RegExpExecArray | null;
      let foundEpisode = false;

      while ((epDownloadMatch = epDownloadRegex.exec(itemHtml)) !== null) {
        const epItemHtml = epDownloadMatch[1];

        // Check episode number from badge-psa or episode label
        const epLabelMatch = epItemHtml.match(/<span class="badge-psa">([^<]+)<\/span>/);
        const epLabel = epLabelMatch?.[1]?.trim() || "";
        const epNumMatch = epLabel.match(/Episode-?(\d+)/i);
        const epNum = epNumMatch ? parseInt(epNumMatch[1], 10) : -1;

        if (epNum !== episode) continue;
        foundEpisode = true;

        // Extract file title
        const fileTitleMatch = epItemHtml.match(/<div class="episode-file-title">\s*([^<]+)\s*<\/div>/);
        const fileTitle = fileTitleMatch?.[1]?.trim() || epTitle;

        // Extract size
        const sizeMatch = epItemHtml.match(/<span class="badge"[^>]*>\s*([\d.]+\s*(?:GB|MB|TB))\s*<\/span>/i);
        const size = sizeMatch?.[1]?.trim() || "";

        // Extract links from this episode item
        const epLinks: string[] = [];
        let lm: RegExpExecArray | null;
        const elr = /href="(https:\/\/hubcloud\.[a-z]+\/drive\/[^"]+)"/g;
        while ((lm = elr.exec(epItemHtml)) !== null) epLinks.push(lm[1]);
        const edr = /href="(https:\/\/hubdrive\.[a-z]+\/drive\/[^"]+)"/g;
        while ((lm = edr.exec(epItemHtml)) !== null) epLinks.push(lm[1]);

        for (const url of epLinks) {
          options.push({
            title: fileTitle,
            quality,
            source: "",
            size,
            languages,
            hubcloudUrl: url,
            episodeLabel: epLabel,
          });
        }
      }

      // If no episode-specific items found, use all links from the season item
      if (!foundEpisode && allLinks.length > 0) {
        for (const url of allLinks) {
          options.push({
            title: epTitle,
            quality,
            source: "",
            size: "",
            languages,
            hubcloudUrl: url,
            episodeLabel: `S${season}E${episode}`,
          });
        }
      }
    } else {
      // No episode filter, return all links
      for (const url of allLinks) {
        options.push({
          title: epTitle,
          quality,
          source: "",
          size: "",
          languages,
          hubcloudUrl: url,
          episodeLabel: `S${season}`,
        });
      }
    }
  }

  return options;
}

// --- Resolve HubCloud/HubDrive to direct URL ---

// JS redirect extraction strategies (adapted from WebStreamrMBG HubCloud.ts)
const REDIRECT_STRATEGIES: ((html: string) => string | null)[] = [
  (html) => html.match(/var\s+url\s*=\s*['"](.*?)['"]/)?.[1] ?? null,
  (html) => html.match(/window\.location(?:\.href)?\s*=\s*['"](.*?)['"]/)?.[1] ?? null,
  (html) => html.match(/location\.replace\(['"](.*?)['"]\)/)?.[1] ?? null,
  (html) => html.match(/<meta[^>]*http-equiv=["']?refresh["']?[^>]*content=["']?\d+;\s*url=(.*?)["']/i)?.[1] ?? null,
  (html) => html.match(/document\.location(?:\.href)?\s*=\s*['"](.*?)['"]/)?.[1] ?? null,
  (html) => html.match(/location\.href\s*=\s*['"](.*?)['"]/)?.[1] ?? null,
  (html) => html.match(/location\.assign\(['"](.*?)['"]\)/)?.[1] ?? null,
  (html) => html.match(/window\.open\(['"](.*?)['"]/)?.[1] ?? null,
  (html) => html.match(/data-(?:url|href|link)\s*=\s*['"](.*?)['"]/)?.[1] ?? null,
  (html) => {
    const m = html.match(/<iframe[^>]+src\s*=\s*['"](.*?)['"]/);
    if (m?.[1] && (m[1].includes("hubcloud") || m[1].includes("gamerxyt"))) return m[1];
    return null;
  },
  (html) => {
    const m = html.match(/var\s+\w+\s*=\s*['"]([^'"]*(?:hubcloud|gamerxyt|hubdrive|hubcdn)[^'"]*)['"]/);
    return m?.[1] ?? null;
  },
  (html) => {
    const m = html.match(/https?:\/\/(?:hubcloud\.[a-z.]+|hubdrive\.[a-z.]+|gamerxyt\.com|hubcdn)[^\s'"<>)]+/);
    return m?.[0] ?? null;
  },
];

function extractRedirectUrl(html: string): string | null {
  for (const strategy of REDIRECT_STRATEGIES) {
    const result = strategy(html);
    if (result) return result;
  }
  return null;
}

function extractCookieName(html: string): string | null {
  const m = html.match(/stck\(\s*['"](\w+)['"]\s*,/);
  return m?.[1] ?? null;
}

// Server type classification with priority (adapted from sooti extraction.js)
interface ButtonCandidate {
  url: string;
  text: string;
  serverType: string;
  priority: number;
  seekable: boolean;
}

function classifyButton(url: string, text: string, buttonId = "", buttonStyle = ""): ButtonCandidate {
  const u = url.toLowerCase();
  const t = text.toLowerCase();

  if (text.includes("FSLv2") || buttonId === "s3" || buttonStyle.includes("#2d50e2") || t.includes("fsl v2"))
    return { url, text, serverType: "FSL V2", priority: 100, seekable: true };
  if (text.includes("FSL Server") || buttonId === "fsl" || t.includes("fsl") || u.includes("fsl.") || u.includes("fastdl"))
    return { url, text, serverType: "FSL", priority: 90, seekable: true };
  if (u.includes("pixeld") || text.includes("PixelServer") || text.includes("PixelDrain"))
    return { url, text, serverType: "Pixeldrain", priority: 95, seekable: true };
  if (u.includes("r2.dev"))
    return { url, text, serverType: "R2", priority: 88, seekable: true };
  if (u.includes("cloudflarestorage"))
    return { url, text, serverType: "CfStorage", priority: 85, seekable: true };
  if (u.includes("hubcdn") && !u.includes("/?id="))
    return { url, text, serverType: "HubCdn", priority: 85, seekable: true };
  if (u.includes("hubcloud") || u.includes("/?id="))
    return { url, text, serverType: "HubCloud", priority: 80, seekable: true };
  if (u.includes(".dev") && !u.includes("/?id="))
    return { url, text, serverType: "Cf Worker", priority: 75, seekable: true };
  if (text.includes("S3 Server") || u.includes("s3"))
    return { url, text, serverType: "S3", priority: 90, seekable: true };
  if (text.includes("10Gbps"))
    return { url, text, serverType: "10Gbps", priority: 60, seekable: false };
  if (text.includes("BuzzServer"))
    return { url, text, serverType: "BuzzServer", priority: 70, seekable: true };
  if (text.includes("Download File"))
    return { url, text, serverType: "Download File", priority: 50, seekable: false };
  if (t.includes("mega") || u.includes("mega."))
    return { url, text, serverType: "Mega", priority: 65, seekable: true };
  if (u.includes(".mp4") || u.includes(".mkv") || u.includes(".avi"))
    return { url, text, serverType: "Direct", priority: 70, seekable: true };
  return { url, text, serverType: "Other", priority: 0, seekable: false };
}

// Extract R2 cloudflarestorage URLs from gamerxyt.com JS patterns
function extractR2FromJs(html: string): string | null {
  // Pattern: createIntentURL({host: 'https://...r2.cloudflarestorage.com/...'})
  const createIntentMatch = html.match(/createIntentURL\(\s*\{[^}]*host:\s*['"]([^'"]+)['"]/);
  if (createIntentMatch) return createIntentMatch[1];

  // Pattern: host: "https://...r2.cloudflarestorage.com/..."
  const hostMatch = html.match(/host:\s*["'](https:\/\/[^"'']+cloudflarestorage[^"'']+)["']/);
  if (hostMatch) return hostMatch[1];

  // Raw R2 URL in JS
  const r2Match = html.match(/https:\/\/[a-f0-9]+\.r2\.cloudflarestorage\.com\/[^"'\s<>)]+/);
  if (r2Match) return r2Match[0];

  return null;
}

// Check if page has valid download content
function hasValidDownloadContent(html: string): boolean {
  if (html.includes('id="size"') || html.includes("id='size'")) return true;
  if (html.includes("FSL") || html.includes("PixelServer") || html.includes("Download File")) return true;
  if (html.includes("hubcloud.php") || html.includes("gamerxyt.com")) return true;
  if (html.includes("workers.dev") || html.includes("hubcdn")) return true;
  if (html.includes('class="btn') && html.includes("href=")) return true;
  return false;
}

// Filter out unwanted URLs
function isUnwantedUrl(url: string): boolean {
  const u = url.toLowerCase();
  if (u.endsWith(".zip")) return true;
  if (u.includes("googleusercontent.com")) return true;
  if (u.includes("ampproject.org")) return true;
  if (u.includes("bloggingvector.shop")) return true;
  if (u.includes("hubcloud.cx/tg") || u.includes("/tg/go")) return true;
  if (u.includes("pixel.hubcdn.fans") || u.includes("pixel.rohitkiskk.workers.dev")) return true;
  // Skip excessive base64 for non-trusted hosts
  const isTrusted = u.includes("workers.dev") || u.includes("hubcdn.fans") || u.includes("pixeldrain");
  if (!isTrusted && u.match(/[a-z0-9+/=]{100,}/i)) return true;
  return false;
}

// HEAD validation for 206/seekable support
async function validateUrl(url: string, timeoutMs = 5000): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      method: "HEAD",
      headers: { "User-Agent": UA, Referer: BASE },
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timer);
    if (!res.ok) return false;
    const acceptRanges = res.headers.get("accept-ranges");
    const contentLength = res.headers.get("content-length");
    if (acceptRanges === "bytes") return true;
    if (contentLength && parseInt(contentLength, 10) > 0) return true;
    return false;
  } catch {
    return false;
  }
}

async function resolveHubcloud(hubcloudUrl: string): Promise<string | null> {
  // Step 1: Fetch hubcloud/drive page — may contain JS redirect or direct download link
  const html = await fetchHtml(hubcloudUrl);
  if (!html) {
    console.log(`[4KHDHub] resolveHubcloud: fetchHtml returned null for ${hubcloudUrl}`);
    return null;
  }
  console.log(`[4KHDHub] resolveHubcloud: got ${html.length} chars from ${hubcloudUrl}`);

  // Step 2: Check for JS redirect (hubcloud.cx pages often use JS redirects)
  const redirectUrl = extractRedirectUrl(html);
  let downloadHref: string | null = null;

  if (redirectUrl) {
    downloadHref = redirectUrl.startsWith("http")
      ? redirectUrl
      : `${new URL(hubcloudUrl).origin}${redirectUrl}`;
    console.log(`[4KHDHub] resolveHubcloud: JS redirect found → ${downloadHref.slice(0, 80)}`);
  }

  // Step 2b: If no JS redirect, try #download href
  if (!downloadHref) {
    const downloadMatch = html.match(/id="download"[^>]*href="([^"]+)"/);
    if (downloadMatch) downloadHref = downloadMatch[1].replace(/&amp;/g, "&");
  }

  if (!downloadHref) {
    const phpMatch = html.match(/href="(https?:\/\/[^"']*hubcloud\.php[^"]*)"/);
    if (phpMatch) downloadHref = phpMatch[1].replace(/&amp;/g, "&");
  }

  if (!downloadHref) {
    const btnMatch = html.match(/<a[^>]*class="[^"]*btn[^"]*"[^>]*href="(https?:\/\/[^"']+)"/);
    if (btnMatch) downloadHref = btnMatch[1].replace(/&amp;/g, "&");
  }

  // If no download href found, try direct links in the page
  if (!downloadHref) {
    const r2 = extractR2FromJs(html);
    if (r2) return r2;

    const workersMatch = html.match(/https:\/\/[a-z0-9-]+\.workers\.dev\/[^"'\s<]+/i);
    if (workersMatch) return workersMatch[0].replace(/&amp;/g, "&");

    const redirectMatch = html.match(/href="(https?:\/\/[^"']*\?id=[^"]+)"/);
    if (redirectMatch) {
      const resolved = await resolveRedirect(redirectMatch[1].replace(/&amp;/g, "&"));
      if (resolved) return resolved;
    }

    console.log(`[4KHDHub] resolveHubcloud: no downloadHref or direct link found`);
    return null;
  }

  // Make absolute if relative
  if (downloadHref.startsWith("/")) {
    const baseUrl = new URL(hubcloudUrl);
    downloadHref = `${baseUrl.protocol}//${baseUrl.host}${downloadHref}`;
  }

  // Step 3: Fetch the download page (gamerxyt.com/hubcloud.php or similar)
  let dlHtml = await fetchHtml(downloadHref);
  if (!dlHtml) {
    console.log(`[4KHDHub] resolveHubcloud: fetchHtml returned null for download page ${downloadHref}`);
    return null;
  }
  console.log(`[4KHDHub] resolveHubcloud: got ${dlHtml.length} chars from download page`);

  // Step 3b: Token retry — if page doesn't have valid content, wait and retry once
  if (!hasValidDownloadContent(dlHtml)) {
    console.log(`[4KHDHub] resolveHubcloud: invalid content, retrying in 2.5s...`);
    await new Promise((r) => setTimeout(r, 2500));
    const retryHtml = await fetchHtml(hubcloudUrl);
    if (retryHtml) {
      const retryRedirect = extractRedirectUrl(retryHtml);
      if (retryRedirect) {
        const retryUrl = retryRedirect.startsWith("http")
          ? retryRedirect
          : `${new URL(hubcloudUrl).origin}${retryRedirect}`;
        dlHtml = await fetchHtml(retryUrl);
      }
    }
    if (!dlHtml || !hasValidDownloadContent(dlHtml)) {
      console.log(`[4KHDHub] resolveHubcloud: still no valid content after retry`);
      return null;
    }
  }

  // Step 4: Extract R2 URL from JS patterns (gamerxyt.com embeds R2 URLs in JS)
  const r2Url = extractR2FromJs(dlHtml);
  if (r2Url) {
    console.log(`[4KHDHub] resolveHubcloud: extracted R2 URL from JS: ${r2Url.slice(0, 80)}`);
    return r2Url;
  }

  // Step 5: Parse download buttons and classify by server type
  const candidates: ButtonCandidate[] = [];
  const btnRegex = /<a[^>]*class="[^"]*btn[^"]*"[^>]*href="([^"]+)"[^>]*id="([^"]*)"[^>]*style="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g;
  let btnMatch: RegExpExecArray | null;

  while ((btnMatch = btnRegex.exec(dlHtml)) !== null) {
    const url = btnMatch[1].replace(/&amp;/g, "&");
    const btnId = btnMatch[2] || "";
    const btnStyle = btnMatch[3] || "";
    const text = btnMatch[4].replace(/<[^>]+>/g, "").trim();
    if (url && url.startsWith("http") && !isUnwantedUrl(url)) {
      candidates.push(classifyButton(url, text, btnId, btnStyle));
    }
  }

  // Fallback: simpler regex without id/style attributes
  if (candidates.length === 0) {
    const simpleBtnRegex = /<a[^>]*class="[^"]*btn[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    while ((btnMatch = simpleBtnRegex.exec(dlHtml)) !== null) {
      const url = btnMatch[1].replace(/&amp;/g, "&");
      const text = btnMatch[2].replace(/<[^>]+>/g, "").trim();
      if (url && url.startsWith("http") && !isUnwantedUrl(url)) {
        candidates.push(classifyButton(url, text));
      }
    }
  }

  // Check for var pxl = "https://..." (JS-assigned pixel server URL)
  const pxlMatch = dlHtml.match(/var\s+pxl\s*=\s*["']([^"']+)["']/);
  if (pxlMatch && !isUnwantedUrl(pxlMatch[1])) {
    candidates.unshift(classifyButton(pxlMatch[1], "PixelServer"));
  }

  // Also scan for raw workers.dev URLs
  const workersRegex = /https:\/\/[a-z0-9-]+\.workers\.dev\/[^"'\s<]+/gi;
  let wm: RegExpExecArray | null;
  while ((wm = workersRegex.exec(dlHtml)) !== null) {
    const wUrl = wm[0].replace(/&amp;/g, "&");
    if (!isUnwantedUrl(wUrl)) {
      candidates.push(classifyButton(wUrl, "Workers"));
    }
  }

  // Sort by priority (highest first)
  candidates.sort((a, b) => b.priority - a.priority);
  console.log(
    `[4KHDHub] resolveHubcloud: ${candidates.length} candidates:`,
    candidates.map((c) => `${c.serverType}(${c.priority}):${c.url.slice(0, 50)}`)
  );

  // Step 6: Process candidates in priority order
  const TRUSTED_SERVERS = ["FSL V2", "FSL", "Pixeldrain", "R2", "Cf Worker", "CfStorage", "S3", "HubCdn"];

  for (const c of candidates) {
    // Direct seekable URLs — return immediately for trusted servers
    if (TRUSTED_SERVERS.includes(c.serverType)) {
      // For Pixeldrain, convert /u/ID to /api/file/ID?download
      if (c.serverType === "Pixeldrain") {
        const pxMatch = c.url.match(/pixeldrain\.[^/]+\/u\/([a-zA-Z0-9]+)/);
        if (pxMatch) {
          return `https://pixeldrain.dev/api/file/${pxMatch[1]}?download`;
        }
      }
      return c.url;
    }

    // BuzzServer: follow /download redirect, read hx-redirect header
    if (c.serverType === "BuzzServer") {
      const resolved = await resolveBuzzServer(c.url);
      if (resolved) return resolved;
    }

    // 10Gbps / pixel.hubcloud: follow redirect chain, extract link= param
    if (c.serverType === "10Gbps" || c.url.includes("pixel.hubcloud") || c.url.includes("dl.php")) {
      const resolved = await resolvePixelServer(c.url);
      if (resolved) return resolved;
    }

    // Redirect URL with id= → resolve via token decryption
    if (c.url.toLowerCase().includes("id=")) {
      const resolved = await resolveRedirect(c.url);
      if (resolved) return resolved;
    }

    // Direct media URL
    if (c.url.includes(".mp4") || c.url.includes(".mkv") || c.url.includes(".avi")) {
      return c.url;
    }
  }

  // Fallback: first non-redirect, non-unwanted candidate
  for (const c of candidates) {
    if (!c.url.toLowerCase().includes("id=") && !isUnwantedUrl(c.url)) return c.url;
  }

  return null;
}

// Resolve BuzzServer: GET {link}/download with no redirect, read hx-redirect header
async function resolveBuzzServer(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${url}/download`, {
      headers: { "User-Agent": UA, Referer: url },
      signal: controller.signal,
      redirect: "manual",
    });
    clearTimeout(timer);
    const redirectUrl = res.headers.get("hx-redirect") || res.headers.get("location");
    if (redirectUrl) {
      const finalUrl = new URL(redirectUrl, url).href;
      console.log(`[4KHDHub] BuzzServer redirect: ${finalUrl.slice(0, 80)}`);
      return finalUrl;
    }
  } catch {
    // ignore
  }
  return null;
}

// Resolve redirect URLs (gadgetsweb.xyz/?id=...) using token decryption
// The site uses: base64Decode(rot13(base64Decode(base64Decode(combinedString))))
async function resolveRedirect(redirectUrl: string): Promise<string | null> {
  const html = await fetchHtml(redirectUrl);
  if (!html) return null;

  // Extract s('o','...') and ck('_wp_http_...','...') values
  const regex = /s\('o','([A-Za-z0-9+/=]+)'|ck\('_wp_http_\d+','([^']+)'\)/g;
  let combinedString = "";
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    const val = match[1] || match[2];
    if (val) combinedString += val;
  }

  if (!combinedString) return null;

  try {
    // Decode: base64 -> base64 -> rot13 -> base64 -> JSON
    const step1 = Buffer.from(combinedString, "base64").toString("utf-8");
    const step2 = Buffer.from(step1, "base64").toString("utf-8");
    const step3 = step2.replace(/[A-Za-z]/g, (char) => {
      const start = char <= "Z" ? 65 : 97;
      return String.fromCharCode(((char.charCodeAt(0) - start + 13) % 26) + start);
    });
    const step4 = Buffer.from(step3, "base64").toString("utf-8");
    const json = JSON.parse(step4);

    const encodedUrl = Buffer.from(json.o || "", "base64").toString("utf-8").trim();
    if (encodedUrl) return encodedUrl;

    // Fallback: use blog_url + data
    if (json.blog_url && json.data) {
      const resp = await fetchHtml(`${json.blog_url}?re=${json.data}`);
      if (resp) return resp.trim();
    }
  } catch {
    // ignore decode errors
  }

  return null;
}

// Resolve pixel server / 10Gbps links by following redirect and extracting link param
async function resolvePixelServer(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Referer: BASE },
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timer);
    const finalUrl = res.url || url;

    // Extract link= query parameter
    const urlObj = new URL(finalUrl);
    const linkParam = urlObj.searchParams.get("link");
    if (linkParam) {
      try {
        return decodeURIComponent(linkParam);
      } catch {
        return linkParam;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

// --- Main export ---

export async function get4khdhubStreams(params: {
  tmdbId: number;
  mediaType?: "movie" | "tv";
  title?: string;
  year?: number;
  season?: number;
  episode?: number;
}): Promise<Hd4khubResult> {
  const { tmdbId, mediaType = "movie", season, episode } = params;
  let { title, year } = params;

  // Fetch TMDB metadata if missing
  if (!title) {
    try {
      const metaResp = await fetch(
        `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${process.env.TMDB_API_KEY || ""}`
      );
      if (metaResp.ok) {
        const meta = await metaResp.json();
        title = meta.title || meta.name || "";
        if (!year) {
          const dateStr = meta.release_date || meta.first_air_date || "";
          year = dateStr ? new Date(dateStr).getFullYear() : undefined;
        }
      }
    } catch {
      // continue
    }
  }

  if (!title) return { sources: [], subtitles: [], provider: "4KHDHub", debug: { error: "no title" } };
  const debug: any = { title, year, steps: [] };

  // Search for the title
  const searchResults = await search4khdhub(title);
  debug.steps.push({ step: "search", count: searchResults.length, results: searchResults.slice(0, 5) });
  if (searchResults.length === 0) return { sources: [], subtitles: [], provider: "4KHDHub", debug };

  // Find best match by title (case-insensitive)
  const lowerTitle = title.toLowerCase();
  let bestMatch = searchResults.find(
    (r) => r.title.toLowerCase() === lowerTitle
  );

  if (!bestMatch) {
    bestMatch = searchResults.find(
      (r) => r.title.toLowerCase().includes(lowerTitle) || lowerTitle.includes(r.title.toLowerCase())
    );
  }

  // If year is available, prefer matches with the same year
  if (!bestMatch && year) {
    bestMatch = searchResults.find(
      (r) => r.year === String(year)
    );
  }

  if (!bestMatch) return { sources: [], subtitles: [], provider: "4KHDHub", debug: { ...debug, error: "no best match", searchResults } };
  debug.bestMatch = bestMatch;

  // Fetch the detail page
  const detailHtml = await fetchHtml(bestMatch.url);
  debug.steps.push({ step: "detailPage", length: detailHtml?.length || 0 });
  if (!detailHtml) return { sources: [], subtitles: [], provider: "4KHDHub", debug };

  const isSeries = bestMatch.isSeries || mediaType === "tv";

  // Parse download options
  const downloadOptions = parseDetailPage(detailHtml, isSeries, season, episode);
  debug.steps.push({ step: "parse", count: downloadOptions.length, options: downloadOptions.slice(0, 3).map(o => ({ title: o.title, quality: o.quality, hubcloud: o.hubcloudUrl.slice(0, 60), episodeLabel: o.episodeLabel })) });
  if (downloadOptions.length === 0) return { sources: [], subtitles: [], provider: "4KHDHub", debug };

  // Resolve hubcloud URLs to direct URLs — sequential to avoid rate limiting
  // Limit to 3 best quality options for performance
  const toResolve = downloadOptions.slice(0, 3);
  const sources: Hd4khubSource[] = [];
  const resolveDebug: any[] = [];

  for (let i = 0; i < toResolve.length; i++) {
    const opt = toResolve[i];
    try {
      const directUrl = await resolveHubcloud(opt.hubcloudUrl);
      if (!directUrl) {
        resolveDebug.push({ index: i, error: "null result" });
        continue;
      }

      // Filter unwanted URLs
      if (isUnwantedUrl(directUrl)) {
        resolveDebug.push({ index: i, error: "filtered", url: directUrl.slice(0, 80) });
        continue;
      }

      resolveDebug.push({ index: i, url: directUrl.slice(0, 80) });

      const qualityLabel = opt.quality || (opt.title.match(/(2160p|1080p|720p|480p)/i)?.[1] || "Unknown");
      sources.push({
        quality: qualityLabel,
        url: directUrl,
        type: "mkv",
        label: opt.title.slice(0, 80),
        size: opt.size,
        languages: opt.languages,
      });
    } catch (err: any) {
      resolveDebug.push({ index: i, error: err.message });
    }
  }

  // Sort by quality (4K first)
  sources.sort((a, b) => {
    const aRank = QUALITY_RANK[a.quality] ?? 99;
    const bRank = QUALITY_RANK[b.quality] ?? 99;
    return aRank - bRank;
  });

  debug.steps.push({ step: "resolve", results: resolveDebug });
  return {
    sources,
    subtitles: [],
    provider: "4KHDHub",
    debug,
  };
}
