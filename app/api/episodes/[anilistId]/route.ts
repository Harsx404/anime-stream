import { NextResponse } from "next/server";
import { getMiruroEpisodeList, getMiruroProviderList } from "@/lib/miruro-server";
import { INTERNAL_FALLBACK_HEADER, siblingOrigin } from "@/lib/deploy-origins";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Miruro's Cloudflare protection sometimes blocks/challenges this deployment's
// IP range while the sibling deployment (Vercel <-> Render) still gets through.
// Try the sibling once before giving up. Guarded by a header so a fallback
// request never chains into a second fallback (no ping-pong between hosts).
async function fetchFromSibling(req: Request, anilistId: string) {
  if (req.headers.get(INTERNAL_FALLBACK_HEADER)) return null;
  const origin = siblingOrigin();
  if (!origin) return null;

  try {
    const { search } = new URL(req.url);
    const res = await fetch(`${origin}/api/episodes/${anilistId}${search}`, {
      headers: { [INTERNAL_FALLBACK_HEADER]: "1" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.episodes?.length) return null;
    return data;
  } catch {
    return null;
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ anilistId: string }> },
) {
  const { anilistId } = await params;
  const id = Number(anilistId);
  if (!id) return NextResponse.json({ error: "Invalid anilistId" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const provider = searchParams.get("provider") || undefined;
  const category = searchParams.get("category") as "sub" | "dub" | null;

  try {
    const [episodes, providers] = await Promise.all([
      getMiruroEpisodeList(id, provider, category || undefined),
      getMiruroProviderList(id),
    ]);

    if (!episodes || episodes.length === 0) {
      const fallback = await fetchFromSibling(req, anilistId);
      if (fallback) return NextResponse.json(fallback);
      return NextResponse.json({ error: "Episodes not found" }, { status: 404 });
    }

    return NextResponse.json({
      episodes: episodes.map((ep) => ({
        id: ep.id,
        number: ep.number,
        title: ep.title,
        image: ep.image,
        description: ep.description,
        filler: ep.filler,
        hasDub: ep.hasDub,
        duration: ep.duration,
        airDate: ep.airDate,
      })),
      providers,
    });
  } catch (e) {
    const fallback = await fetchFromSibling(req, anilistId);
    if (fallback) return NextResponse.json(fallback);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
