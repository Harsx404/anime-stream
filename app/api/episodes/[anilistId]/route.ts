import { NextResponse } from "next/server";
import { getMiruroEpisodeList, getMiruroProviderList } from "@/lib/miruro-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
