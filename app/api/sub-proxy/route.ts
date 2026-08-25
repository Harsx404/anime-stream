import { NextResponse } from "next/server";
import { dnsFetch } from "@/lib/dns-fix";
import { gunzipSync } from "zlib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36";

function srtToVtt(srt: string): string {
  let vtt = "WEBVTT\n\n";
  const blocks = srt.replace(/\r/g, "").trim().split(/\n\n+/);
  for (const block of blocks) {
    const lines = block.split("\n").filter((l) => l.trim());
    if (lines.length < 2) continue;
    let timeLine = "";
    let textLines: string[] = [];
    if (/^\d+$/.test(lines[0].trim())) {
      timeLine = lines[1] || "";
      textLines = lines.slice(2);
    } else {
      timeLine = lines[0] || "";
      textLines = lines.slice(1);
    }
    const timeMatch = timeLine.match(
      /(\d{2}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]\d{3})/
    );
    if (!timeMatch) continue;
    const start = timeMatch[1].replace(",", ".");
    const end = timeMatch[2].replace(",", ".");
    vtt += `${start} --> ${end}\n`;
    vtt += textLines.join("\n") + "\n\n";
  }
  return vtt;
}

function resolveUrl(base: string, relative: string): string {
  try {
    return new URL(relative, base).href;
  } catch {
    return relative;
  }
}

async function hlsSubPlaylistToVtt(playlistUrl: string, playlistText: string): Promise<string> {
  const lines = playlistText.split("\n");
  const segmentUrls: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    segmentUrls.push(resolveUrl(playlistUrl, trimmed));
  }

  if (segmentUrls.length === 0) return "WEBVTT\n\n";

  // Fetch all VTT segments and concatenate
  let vtt = "WEBVTT\n\n";
  for (const segUrl of segmentUrls) {
    try {
      const segObj = new URL(segUrl);
      const segHeaders: Record<string, string> = { "User-Agent": UA, Accept: "*/*" };
      const segRefererMap: Record<string, string> = {
        "moon.peakstorm.top": "https://www.vidking.net/",
        "keenanchor.top": "https://www.vidking.net/",
        "vidlink.pro": "https://vidlink.pro/",
        "vixsrc.to": "https://vixsrc.to/",
      };
      let segRefSet = false;
      for (const [domain, ref] of Object.entries(segRefererMap)) {
        if (segObj.hostname === domain || segObj.hostname.endsWith("." + domain)) {
          segHeaders["Referer"] = ref;
          segHeaders["Origin"] = new URL(ref).origin;
          segRefSet = true;
          break;
        }
      }
      if (!segRefSet && (segObj.hostname.includes("peakstorm.top") || segObj.hostname.includes("moon."))) {
        segHeaders["Referer"] = `${segObj.protocol}//${segObj.host}/`;
        segHeaders["Origin"] = `${segObj.protocol}//${segObj.host}`;
      }
      const segResp = await dnsFetch(segUrl, {
        headers: segHeaders,
        cache: "no-store",
      });
      if (!segResp.ok) continue;
      const segText = await segResp.text();
      // HLS VTT segments may have X-TIMESTAMP-MAP headers
      // Strip the WEBVTT header from each segment and append cues
      const cues = segText.replace(/^\uFEFF/, "").replace(/^WEBVTT\s*\n/i, "").replace(/^X-TIMESTAMP-MAP[^\n]*\n/gi, "").trim();
      if (cues) vtt += cues + "\n\n";
    } catch {
      // skip failed segment
    }
  }
  return vtt;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const targetUrl = searchParams.get("url");

  if (!targetUrl) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  const decoded = decodeURIComponent(targetUrl);

  try {
    const targetObj = new URL(decoded);
    const headers: Record<string, string> = {
      "User-Agent": UA,
      Accept: "*/*",
      "Accept-Language": "en-US,en;q=0.9",
    };
    // Add Referer for CDN hosts that require it (must match HLS route referer mapping)
    const DOMAIN_REFERER_MAP: Record<string, string> = {
      "moon.peakstorm.top": "https://www.vidking.net/",
      "keenanchor.top": "https://www.vidking.net/",
      "vidlink.pro": "https://vidlink.pro/",
      "vixsrc.to": "https://vixsrc.to/",
      "cdn.watching.onl": "https://megaplay.buzz/",
    };
    let refererSet = false;
    for (const [domain, ref] of Object.entries(DOMAIN_REFERER_MAP)) {
      if (targetObj.hostname === domain || targetObj.hostname.endsWith("." + domain)) {
        headers["Referer"] = ref;
        headers["Origin"] = new URL(ref).origin;
        refererSet = true;
        break;
      }
    }
    if (!refererSet && (targetObj.hostname.includes("peakstorm.top") || targetObj.hostname.includes("moon."))) {
      headers["Referer"] = `${targetObj.protocol}//${targetObj.host}/`;
      headers["Origin"] = `${targetObj.protocol}//${targetObj.host}`;
    }
    // Add Api-Key for OpenSubtitles V3 API download URLs
    if (targetObj.hostname.includes("opensubtitles.com")) {
      const osKey = process.env.OPENSUBTITLES_API_KEY;
      if (osKey) {
        headers["Api-Key"] = osKey;
        headers["Authorization"] = `Bearer ${osKey}`;
      }
    }

    let resp: Response | null = null;
    let lastError: any = null;
    const maxRetries = 2;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        try {
          resp = await dnsFetch(decoded, {
            headers,
            cache: "no-store",
            signal: AbortSignal.timeout(8000),
          });
        } catch {
          // dnsFetch may fail on deployed servers (serverless/edge) — fall back to regular fetch
          resp = await fetch(decoded, {
            headers,
            cache: "no-store",
            signal: AbortSignal.timeout(8000),
          });
        }

        if (resp.ok || resp.status < 500) {
          break; // Success or expected non-retryable error (like 404, 403)
        }
        
        if (attempt < maxRetries - 1) {
          await new Promise(res => setTimeout(res, 500 * Math.pow(2, attempt)));
        }
      } catch (err) {
        lastError = err;
        if (attempt < maxRetries - 1) {
          await new Promise(res => setTimeout(res, 500 * Math.pow(2, attempt)));
        }
      }
    }

    if (!resp) {
      throw lastError || new Error("All retries failed");
    }

    if (!resp.ok) {
      return NextResponse.json(
        { error: `Upstream returned ${resp.status}` },
        { status: resp.status }
      );
    }

    // OpenSubtitles returns gzip-compressed files - check for gzip magic bytes
    const buffer = await resp.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let text: string;
    if (bytes[0] === 31 && bytes[1] === 139) {
      try {
        text = gunzipSync(Buffer.from(buffer)).toString("utf-8");
      } catch {
        return NextResponse.json(
          { error: "Failed to decompress gzip subtitle" },
          { status: 502 }
        );
      }
    } else {
      text = new TextDecoder().decode(buffer);
    }
    const trimmed = text.replace(/^\uFEFF/, "").trim();

    // Direct VTT file
    if (trimmed.startsWith("WEBVTT")) {
      return new NextResponse(text, {
        headers: {
          "Content-Type": "text/vtt",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    // HLS subtitle playlist - fetch VTT segments and concatenate
    if (trimmed.startsWith("#EXTM3U")) {
      const vtt = await hlsSubPlaylistToVtt(decoded, text);
      return new NextResponse(vtt, {
        headers: {
          "Content-Type": "text/vtt",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    // SRT file - convert to VTT
    const vtt = srtToVtt(text);
    return new NextResponse(vtt, {
      headers: {
        "Content-Type": "text/vtt",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to fetch subtitle" },
      { status: 502 }
    );
  }
}
