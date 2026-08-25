import { dnsFetch } from "@/lib/dns-fix";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const ALLOWED_HOSTS = ["embed.st", "streamed.pk", "strmd.b-cdn.net"];

function isAllowedHost(hostname: string): boolean {
  return ALLOWED_HOSTS.some((h) => hostname === h || hostname.endsWith("." + h));
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const pathStr = path.join("/");
  const targetUrl = `https://embed.st/api/${pathStr}${req.nextUrl.search}`;

  try {
    const parsed = new URL(targetUrl);
    if (!isAllowedHost(parsed.hostname)) {
      return new Response("Host not allowed", { status: 403 });
    }

    const reqHeaders: Record<string, string> = {
      accept: "*/*",
      "accept-language": "en-US,en;q=0.9",
      referer: "https://embed.st/",
    };

    const res = await dnsFetch(targetUrl, { headers: reqHeaders });
    const contentType = res.headers.get("content-type") || "application/json";
    const body = await res.arrayBuffer();

    return new Response(body, {
      status: res.status,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (e) {
    return new Response(
      `Proxy error: ${e instanceof Error ? e.message : "Unknown"}`,
      { status: 502 },
    );
  }
}
