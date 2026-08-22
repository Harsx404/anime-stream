import { dnsFetch } from "@/lib/dns-fix";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const path = searchParams.get("path");
  if (!path) {
    return new Response("Missing path", { status: 400 });
  }

  const tmdbUrl = `https://image.tmdb.org/t/p${path}`;

  try {
    const resp = await dnsFetch(tmdbUrl, {
      headers: { Accept: "image/*" },
    });
    if (!resp.ok) {
      return new Response("Image fetch failed", { status: resp.status });
    }

    const buffer = await resp.arrayBuffer();
    const contentType = resp.headers.get("content-type") || "image/jpeg";

    return new Response(buffer, {
      headers: {
        "content-type": contentType,
        "cache-control": "public, max-age=86400, immutable",
      },
    });
  } catch (e) {
    return new Response(`Error: ${String(e)}`, { status: 502 });
  }
}
