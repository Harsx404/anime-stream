// DNS fix for ISP-level blocking of themoviedb.org and IPTV streams.
// Uses DNS over HTTPS (DoH) via Cloudflare to resolve hostnames,
// bypassing ISP DNS blocking on port 53.
// Then connects to the IP directly with proper Host/SNI headers.
// Supports HTTP, HTTPS, custom ports, IP-literal hostnames, redirect following,
// and relaxed TLS for IPTV streams with mismatched certificates.
import https from "node:https";
import http from "node:http";
import net from "node:net";

const DOH_URL = "https://cloudflare-dns.com/dns-query";
const dnsCache = new Map<string, { ips: string[]; expiresAt: number }>();
const CACHE_TTL = 300_000; // 5 minutes
const MAX_REDIRECTS = 5;

const IP_REGEX = /^(\d{1,3}\.){3}\d{1,3}$/;

function isIPLiteral(hostname: string): boolean {
  return IP_REGEX.test(hostname) || hostname.startsWith("[");
}

async function resolveHost(hostname: string, forceRefresh = false): Promise<string[]> {
  // If it's already an IP literal, skip DoH entirely
  if (isIPLiteral(hostname)) {
    const ip = hostname.replace(/^\[|\]$/g, "");
    return [ip];
  }

  const now = Date.now();
  const cached = dnsCache.get(hostname);
  if (!forceRefresh && cached && cached.expiresAt > now) {
    return cached.ips;
  }

  // DNS over HTTPS (JSON API)
  const resp = await fetch(
    `${DOH_URL}?name=${encodeURIComponent(hostname)}&type=A`,
    { headers: { Accept: "application/dns-json" } }
  );
  if (!resp.ok) throw new Error(`DoH lookup failed: ${resp.status}`);
  const data = await resp.json();
  const ips = (data.Answer || [])
    .filter((a: { type: number }) => a.type === 1)
    .map((a: { data: string }) => a.data);

  if (ips.length === 0) throw new Error(`DoH: no A records for ${hostname}`);
  dnsCache.set(hostname, { ips, expiresAt: now + CACHE_TTL });
  return ips;
}

function doRequest(parsed: URL, ip: string, init?: RequestInit & { next?: { revalidate?: number } }): Promise<Response> {
  return new Promise((resolve, reject) => {
    // Normalize caller headers to lowercase keys to avoid duplicates with defaults
    const callerHeaders: Record<string, string> = {};
    if (init?.headers) {
      for (const [key, value] of Object.entries(init.headers as Record<string, string>)) {
        callerHeaders[key.toLowerCase()] = value;
      }
    }

    const isHttps = parsed.protocol === "https:";
    const port = parsed.port ? Number(parsed.port) : isHttps ? 443 : 80;

    const baseHeaders: Record<string, string> = {
      host: parsed.hostname,
      accept: "*/*",
      "accept-encoding": "identity",
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      ...callerHeaders,
    };

    const handleResponse = (res: http.IncomingMessage) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => {
        const body = Buffer.concat(chunks);
        const cleanHeaders: Record<string, string> = {};
        for (const [key, value] of Object.entries(res.headers)) {
          if (key === "content-encoding" || key === "content-length" || key === "transfer-encoding") continue;
          if (typeof value === "string") cleanHeaders[key] = value;
        }
        resolve(
          new Response(body, {
            status: res.statusCode,
            headers: cleanHeaders,
          }),
        );
      });
    };

    if (isHttps) {
      const options: https.RequestOptions = {
        hostname: ip,
        port,
        path: parsed.pathname + parsed.search,
        method: init?.method || "GET",
        headers: baseHeaders,
        servername: isIPLiteral(ip) ? undefined : parsed.hostname,
        timeout: 10000,
        // Relax TLS for IPTV streams with mismatched/expired certificates
        rejectUnauthorized: false,
      };
      const req = https.request(options, handleResponse);
      req.on("timeout", () => { req.destroy(new Error("Request timeout")); });
      req.on("error", reject);
      req.end();
    } else {
      const options: http.RequestOptions = {
        hostname: ip,
        port,
        path: parsed.pathname + parsed.search,
        method: init?.method || "GET",
        headers: baseHeaders,
        timeout: 10000,
      };
      const req = http.request(options, handleResponse);
      req.on("timeout", () => { req.destroy(new Error("Request timeout")); });
      req.on("error", reject);
      req.end();
    }
  });
}

/**
 * Custom fetch that resolves DNS via DNS over HTTPS (Cloudflare DoH),
 * bypassing ISP DNS blocking on port 53.
 * Connects to the IP directly while setting Host/SNI headers for virtual hosting.
 * Supports HTTP and HTTPS, custom ports, IP-literal hostnames, and redirect following.
 * Tries multiple IPs on connection errors.
 */
export async function dnsFetch(
  url: string | URL,
  init?: RequestInit & { next?: { revalidate?: number } },
): Promise<Response> {
  let currentUrl = typeof url === "string" ? url : url.toString();

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
    const parsed = new URL(currentUrl);
    const ips = await resolveHost(parsed.hostname);

    let response: Response | null = null;
    let lastError: Error | null = null;

    // Try each IP, with a fresh DNS lookup as fallback
    for (let i = 0; i < ips.length; i++) {
      try {
        response = await doRequest(parsed, ips[i], init);
        break;
      } catch (err) {
        lastError = err as Error;
        // Last IP failed — try fresh DNS resolution
        if (i === ips.length - 1) {
          const freshIps = await resolveHost(parsed.hostname, true);
          for (const freshIp of freshIps) {
            try {
              response = await doRequest(parsed, freshIp, init);
              break;
            } catch {
              // continue to next IP
            }
          }
        }
      }
    }

    if (!response) {
      throw lastError || new Error(`dnsFetch: all IPs failed for ${parsed.hostname}`);
    }

    // Follow redirects (301, 302, 307, 308)
    if ([301, 302, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (location && redirectCount < MAX_REDIRECTS) {
        const nextUrl = new URL(location, currentUrl).toString();
        currentUrl = nextUrl;
        continue;
      }
    }

    // Expose the final URL (after redirects) via a custom header so callers
    // can resolve relative URLs correctly (e.g. HLS playlist sub-resources)
    const finalHeaders = new Headers(response.headers);
    finalHeaders.set("x-final-url", currentUrl);
    return new Response(response.body, {
      status: response.status,
      headers: finalHeaders,
    });
  }

  throw new Error(`dnsFetch: too many redirects for ${url}`);
}
