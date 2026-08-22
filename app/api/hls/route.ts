import { NextResponse } from "next/server";
import { dnsFetch } from "@/lib/dns-fix";

function resolveUrl(base: string, relative: string): string {
  if (relative.startsWith("http")) return relative;
  try {
    return new URL(relative, base).href;
  } catch {
    return relative;
  }
}

function upstreamHeaders(
  targetUrl: string,
  refererOverride: string | null,
): Record<string, string> {
  const base: Record<string, string> = {
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
    accept: "*/*",
    "accept-language": "en-US,en;q=0.9",
    "accept-encoding": "identity",
    "sec-fetch-site": "cross-site",
    "sec-fetch-mode": "cors",
    "sec-fetch-dest": "empty",
    "sec-ch-ua": '"Chromium";v="138", "Google Chrome";v="138", "Not?A_Brand";v="99"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
  };

  if (refererOverride) {
    base.referer = refererOverride;
    try {
      base.origin = new URL(refererOverride).origin;
    } catch {}
  }

  return base;
}

function responseContentType(targetUrl: string, upstreamContentType: string): string {
  const path = (() => {
    try {
      return new URL(targetUrl).pathname;
    } catch {
      return targetUrl;
    }
  })();

  if (/\/segment-\d+-.+\.jpg$/i.test(path) || upstreamContentType.startsWith("image/")) {
    return "video/mp2t";
  }

  return upstreamContentType || "application/octet-stream";
}

export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const targetUrl = searchParams.get("url");
  const referer = searchParams.get("referer");

  if (!targetUrl)
    return NextResponse.json({ error: "Missing url" }, { status: 400 });

  const decoded = decodeURIComponent(targetUrl);

  const maxRetries = 3;
  let upstream: Response | null = null;
  let lastError: any = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      upstream = await dnsFetch(decoded, {
        headers: upstreamHeaders(decoded, referer),
        cache: "no-store",
      });

      // On 403, try fallback referers
      if (upstream.status === 403) {
        if (referer) {
          try {
            const streamOrigin = new URL(decoded).origin;
            upstream = await dnsFetch(decoded, {
              headers: upstreamHeaders(decoded, streamOrigin + "/"),
              cache: "no-store",
            });
          } catch {}
        }
        if (upstream.status === 403) {
          try {
            upstream = await dnsFetch(decoded, {
              headers: upstreamHeaders(decoded, null),
              cache: "no-store",
            });
          } catch {}
        }
      }

      if (upstream.ok || (upstream.status !== 403 && upstream.status < 500)) {
        break; // Success or expected non-retryable error (like 404)
      }
      
      // If we are here, it means we got a 403 (even after referer fallbacks) or a 5xx error.
      // Wait before retrying (exponential backoff: 500ms, 1000ms)
      if (attempt < maxRetries - 1) {
        await new Promise(res => setTimeout(res, 500 * Math.pow(2, attempt)));
      }
    } catch (e) {
      lastError = e;
      if (attempt < maxRetries - 1) {
        await new Promise(res => setTimeout(res, 500 * Math.pow(2, attempt)));
      }
    }
  }

  if (!upstream) {
    return NextResponse.json({ error: String(lastError) }, { status: 502 });
  }

  if (!upstream.ok) return new NextResponse(null, { status: upstream.status });

  const contentType = upstream.headers.get("content-type") ?? "";
  const contentTypeLower = contentType.toLowerCase();
  const isM3u8ByHeader =
    contentTypeLower.includes("mpegurl") ||
    contentTypeLower.includes("x-mpegurl") ||
    decoded.includes(".m3u8");

  const proxiedUrl = (url: string) => {
    const params = new URLSearchParams({ url });
    if (referer) params.set("referer", referer);
    return `${origin}/api/hls?${params.toString()}`;
  };

  if (isM3u8ByHeader) {
    const text = await upstream.text();

    const rewritten = text
      .split("\n")
      .map((line) => {
        const trimmed = line.trim();
        if (trimmed.startsWith("#")) {
          return line.replace(/URI="([^"]+)"/g, (_, uri) => {
            const abs = resolveUrl(decoded, uri);
            return `URI="${proxiedUrl(abs)}"`;
          });
        }
        if (trimmed && !trimmed.startsWith("#")) {
          const abs = resolveUrl(decoded, trimmed);
          return proxiedUrl(abs);
        }
        return line;
      })
      .join("\n");

    return new NextResponse(rewritten, {
      headers: {
        "content-type": "application/vnd.apple.mpegurl",
        "access-control-allow-origin": "*",
        "cache-control": text.includes("#EXT-X-ENDLIST")
          ? "public, max-age=300"
          : "no-store",
      },
    });
  }

  const bytes = await upstream.arrayBuffer();
  const peek = new TextDecoder().decode(bytes.slice(0, 9));
  
  // Body-sniff: if response starts with #EXTM3U, treat as m3u8 playlist
  if (peek.replace(/^\uFEFF/, "").startsWith("#EXTM3U")) {
    const text = new TextDecoder().decode(bytes);
    const rewritten = text
      .split("\n")
      .map((line) => {
        const trimmed = line.trim();
        if (trimmed.startsWith("#")) {
          return line.replace(/URI="([^"]+)"/g, (_, uri) => {
            const abs = resolveUrl(decoded, uri);
            return `URI="${proxiedUrl(abs)}"`;
          });
        }
        if (trimmed && !trimmed.startsWith("#")) {
          const abs = resolveUrl(decoded, trimmed);
          return proxiedUrl(abs);
        }
        return line;
      })
      .join("\n");

    return new NextResponse(rewritten, {
      headers: {
        "content-type": "application/vnd.apple.mpegurl",
        "access-control-allow-origin": "*",
        "cache-control": text.includes("#EXT-X-ENDLIST")
          ? "public, max-age=300"
          : "no-store",
      },
    });
  }
  
  const isVtt = peek.replace(/^\uFEFF/, "").startsWith("WEBVTT");
  const finalType = isVtt ? "text/vtt" : responseContentType(decoded, contentType);

  return new NextResponse(bytes, {
    headers: {
      "content-type": finalType,
      "access-control-allow-origin": "*",
      "cache-control": isVtt ? "public, max-age=3600" : "public, max-age=31536000, immutable",
    },
  });
}
