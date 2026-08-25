// Cloudflare Worker - Miruro API CORS Proxy
// Deploy to Cloudflare Workers (free tier)
// This proxy adds CORS headers and forwards requests to miruro.ru

const OBF_KEY_HEX = "71951034f8fbcf53d89db52ceb3dc22c";

function hexToBytes(hex) {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < arr.length; i++) {
    arr[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return arr;
}

const OBF_KEY = hexToBytes(OBF_KEY_HEX);

function base64urlEncode(obj) {
  const json = JSON.stringify(obj);
  const encoded = encodeURIComponent(json).replace(
    /%([0-9A-F]{2})/g,
    (_, p1) => String.fromCharCode(parseInt(p1, 16)),
  );
  return btoa(encoded).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    
    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "*",
        },
      });
    }

    // Get path and query from the worker URL
    // Usage: https://your-worker.workers.dev/api/secure/pipe?e=...
    // Or:    https://your-worker.workers.dev/?path=episodes&anilistId=16498
    let miruroUrl;
    
    if (url.pathname.startsWith("/api/")) {
      // Direct proxy mode: forward the path to miruro.ru
      miruroUrl = `https://www.miruro.ru${url.pathname}${url.search}`;
    } else {
      // Convenience mode: construct the pipe URL from query params
      const path = url.searchParams.get("path");
      if (!path) {
        return new Response(JSON.stringify({ error: "Missing path parameter" }), {
          status: 400,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });
      }
      
      // Build query object from remaining search params
      const query = {};
      for (const [key, value] of url.searchParams.entries()) {
        if (key !== "path") {
          // Parse numeric values
          const num = Number(value);
          query[key] = isNaN(num) ? value : num;
        }
      }
      
      const payload = { path, method: "GET", query, body: null, version: "0.1.0" };
      const encoded = base64urlEncode(payload);
      miruroUrl = `https://www.miruro.ru/api/secure/pipe?e=${encoded}`;
    }

    try {
      const resp = await fetch(miruroUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          "Referer": "https://www.miruro.ru/",
          "Origin": "https://www.miruro.ru",
          "Accept": "*/*",
          "Accept-Language": "en-US,en;q=0.9",
          "sec-fetch-site": "same-origin",
          "sec-fetch-mode": "cors",
          "sec-fetch-dest": "empty",
          "sec-ch-ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": '"Windows"',
        },
      });

      // Get response body and headers
      const text = await resp.text();
      const obfuscated = resp.headers.get("x-obfuscated");

      // Return with CORS headers
      const responseHeaders = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
      };
      
      if (obfuscated) {
        responseHeaders["x-obfuscated"] = obfuscated;
      }

      return new Response(text, {
        status: resp.status,
        headers: responseHeaders,
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 502,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }
  },
};
