import { NextResponse } from "next/server";
import { getMiruroSources, getMiruroProvider, getMiruroEpisodes } from "@/lib/miruro-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PROVIDER_FALLBACK = ["ally", "kiwi", "bonk", "pewe", "bee", "hop"];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const episodeId = searchParams.get("episodeId");
  const provider = searchParams.get("provider");
  const category = searchParams.get("category");
  const anilistId = searchParams.get("anilistId");
  const episodeNumParam = searchParams.get("episodeNum");

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

  // Try the requested provider first with the given episodeId
  try {
    const miruroSources = await getMiruroSources(episodeId, prov, cat, anilistIdNum);
    if (miruroSources && miruroSources.streams.length > 0) {
      return NextResponse.json(formatSources(miruroSources));
    }
  } catch (e) {
    console.error(`[Miruro] Provider ${prov} failed:`, String(e).substring(0, 100));
  }

  // Fallback: try other providers. Episode IDs are provider-specific,
  // so we need to re-fetch episodes and find the matching episode by number.
  if (anilistIdNum) {
    // Use episodeNum query param if available, otherwise try to extract from episodeId
    let episodeNum = episodeNumParam ? Number(episodeNumParam) : 0;
    if (!episodeNum || episodeNum <= 0) {
      try {
        const decoded = Buffer.from(episodeId, "base64url").toString("utf-8");
        const match = decoded.match(/:(\d+)$/);
        if (match) {
          const extracted = Number(match[1]);
          // Sanity check: episode numbers should be < 10000
          if (extracted > 0 && extracted < 10000) episodeNum = extracted;
        }
      } catch {}
    }

    if (episodeNum > 0) {
      const epData = await getMiruroEpisodes(anilistIdNum);
      if (epData?.providers) {
        for (const tryProv of PROVIDER_FALLBACK) {
          if (tryProv === prov) continue;
          const provData = epData.providers[tryProv];
          if (!provData) continue;
          const eps = cat === "dub" ? provData.episodes?.dub : provData.episodes?.sub;
          if (!eps) continue;
          const ep = eps.find((e: any) => e.number === episodeNum);
          if (!ep) continue;

          try {
            const miruroSources = await getMiruroSources(ep.id, tryProv, cat, anilistIdNum);
            if (miruroSources && miruroSources.streams.length > 0) {
              console.log(`[Miruro] Fallback to provider ${tryProv} succeeded`);
              return NextResponse.json(formatSources(miruroSources));
            }
          } catch (e) {
            console.error(`[Miruro] Fallback provider ${tryProv} failed:`, String(e).substring(0, 100));
          }
        }
      }
    }
  }

  return NextResponse.json({ error: "No sources found from any provider" }, { status: 404 });
}

function formatSources(miruroSources: any) {
  const hlsStreams = miruroSources.streams.filter(
    (s: any) => s.type === "hls" && s.isActive !== false,
  );
  const embedStreams = miruroSources.streams.filter(
    (s: any) => s.type === "embed",
  );
  const allStreams = [...hlsStreams, ...embedStreams];

  return {
    sources: allStreams.map((s: any, i: number) => ({
      url: s.url,
      quality: s.server || `Server ${i + 1}`,
      isM3U8: s.type === "hls",
      referer: s.referer,
      type: s.type,
      default: s.default,
    })),
    subs:
      miruroSources.subtitles?.map((sub: any) => ({
        url: sub.file,
        lang: sub.label || "English",
      })) || [],
    download: Array.isArray(miruroSources.download)
      ? miruroSources.download.map((d: any) => ({
          url: d.url,
          label: d.label || d.quality || "Download",
        }))
      : [],
  };
}
