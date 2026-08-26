import { dnsFetch } from "@/lib/dns-fix";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

// Path-based proxy for strmd.b-cdn.net specifically. The player bundle it
// serves (bundle-jw.js) resolves its own sub-resources (e.g. wasm/lock.js)
// relative to its own script URL. The query-param proxy (/api/sports/embed)
// collapses that into one query string and loses the directory structure,
// so those relative fetches resolve to the wrong place. Mirroring the path
// here (/api/sports/cdn/js/bundle-jw.js -> https://strmd.b-cdn.net/js/bundle-jw.js)
// keeps relative resolution correct while still routing through our
// (unblocked) server egress instead of the user's own network.

function contentTypeFor(pathname: string): string | undefined {
  if (pathname.endsWith(".js")) return "application/javascript";
  if (pathname.endsWith(".wasm")) return "application/wasm";
  if (pathname.endsWith(".css")) return "text/css";
  if (pathname.endsWith(".json")) return "application/json";
  return undefined;
}

async function proxy(req: NextRequest, path: string[]) {
  const pathStr = path.join("/");
  const targetUrl = `https://strmd.b-cdn.net/${pathStr}${req.nextUrl.search}`;

  try {
    const reqHeaders: Record<string, string> = {
      accept: "*/*",
      "accept-language": "en-US,en;q=0.9",
      referer: "https://streamed.pk/",
    };
    const incomingContentType = req.headers.get("content-type");
    if (incomingContentType) reqHeaders["content-type"] = incomingContentType;

    let reqBody: ArrayBuffer | undefined;
    if (req.method !== "GET" && req.method !== "HEAD") {
      const buf = await req.arrayBuffer();
      if (buf.byteLength > 0) reqBody = buf;
    }

    const res = await dnsFetch(targetUrl, { method: req.method, headers: reqHeaders, body: reqBody });
    const contentType =
      res.headers.get("content-type") || contentTypeFor(new URL(targetUrl).pathname) || "application/octet-stream";
    const resBody = await res.arrayBuffer();

    return new Response(resBody, {
      status: res.status,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (e) {
    return new Response(
      `Failed to proxy CDN asset: ${e instanceof Error ? e.message : "Unknown error"}`,
      { status: 502 },
    );
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxy(req, path);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxy(req, path);
}
