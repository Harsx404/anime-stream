import { NextResponse } from "next/server";
import { getMiruroSources, getMiruroProvider } from "@/lib/miruro-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const episodeId = searchParams.get("episodeId");
  const provider = searchParams.get("provider");
  const category = searchParams.get("category");
  const anilistId = searchParams.get("anilistId");

  if (!episodeId)
    return NextResponse.json({ error: "Missing episodeId" }, { status: 400 });

  const anilistIdNum = anilistId ? Number(anilistId) : 0;
  let prov = provider || "";
  let cat = category || "sub";

  if (!prov && anilistIdNum) {
    const detected = await getMiruroProvider(anilistIdNum);
    if (detected) {
      prov = detected.name;
      if (!category) cat = detected.category;
    }
  }

  if (!prov)
    return NextResponse.json({ error: "No provider available" }, { status: 404 });

  try {
    const miruroSources = await getMiruroSources(episodeId, prov, cat, anilistIdNum);
    if (!miruroSources || miruroSources.streams.length === 0) {
      return NextResponse.json({ error: "No sources found" }, { status: 404 });
    }

    const hlsStreams = miruroSources.streams.filter(
      (s) => s.type === "hls" && s.isActive !== false,
    );
    const embedStreams = miruroSources.streams.filter(
      (s) => s.type === "embed",
    );
    const allStreams = [...hlsStreams, ...embedStreams];

    return NextResponse.json({
      sources: allStreams.map((s, i) => ({
        url: s.url,
        quality: s.server || `Server ${i + 1}`,
        isM3U8: s.type === "hls",
        referer: s.referer,
        type: s.type,
        default: s.default,
      })),
      subs:
        miruroSources.subtitles?.map((sub) => ({
          url: sub.file,
          lang: sub.label || "English",
        })) || [],
      download: Array.isArray(miruroSources.download)
        ? miruroSources.download.map((d: any) => ({
            url: d.url,
            label: d.label || d.quality || "Download",
          }))
        : [],
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
