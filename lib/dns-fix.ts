// DNS fix for ISP-level blocking of themoviedb.org
// Uses DNS over HTTPS (DoH) via Cloudflare to resolve hostnames,
// bypassing ISP DNS blocking on port 53.
// Then connects to the IP directly with proper Host/SNI headers.
import https from "node:https";

const DOH_URL = "https://cloudflare-dns.com/dns-query";
const dnsCache = new Map<string, { ips: string[]; expiresAt: number }>();
const CACHE_TTL = 300_000; // 5 minutes

async function resolveHost(hostname: string, forceRefresh = false): Promise<string[]> {
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
    const options: https.RequestOptions = {
      hostname: ip,
      port: 443,
      path: parsed.pathname + parsed.search,
      method: init?.method || "GET",
      headers: {
        Host: parsed.hostname,
        Accept: "*/*",
        "Accept-Encoding": "identity",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        ...(init?.headers as Record<string, string>),
      },
      servername: parsed.hostname,
      timeout: 10000,
    };

    const req = https.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk) => chunks.push(chunk));
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
    });

    req.on("timeout", () => { req.destroy(new Error("Request timeout")); });
    req.on("error", reject);
    req.end();
  });
}

/**
 * Custom fetch that resolves DNS via DNS over HTTPS (Cloudflare DoH),
 * bypassing ISP DNS blocking on port 53.
 * Connects to the IP directly while setting Host/SNI headers for virtual hosting.
 * Tries multiple IPs on connection errors.
 */
export async function dnsFetch(
  url: string | URL,
  init?: RequestInit & { next?: { revalidate?: number } },
): Promise<Response> {
  const parsed = new URL(url);

  const ips = await resolveHost(parsed.hostname);

  // Try each IP, with a fresh DNS lookup as fallback
  for (let i = 0; i < ips.length; i++) {
    try {
      return await doRequest(parsed, ips[i], init);
    } catch (err) {
      // Last IP failed — try fresh DNS resolution
      if (i === ips.length - 1) {
        const freshIps = await resolveHost(parsed.hostname, true);
        for (const freshIp of freshIps) {
          try {
            return await doRequest(parsed, freshIp, init);
          } catch {
            // continue to next IP
          }
        }
        throw err;
      }
    }
  }

  throw new Error(`dnsFetch: all IPs failed for ${parsed.hostname}`);
}
