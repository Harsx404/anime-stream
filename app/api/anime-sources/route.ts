import { NextResponse } from "next/server";
import { getProviderSources, ALL_PROVIDERS, type ProviderName } from "@/lib/anime-providers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const provider = url.searchParams.get("provider") as ProviderName | null;
  const anilistId = Number(url.searchParams.get("anilistId"));
  const episodeNum = Number(url.searchParams.get("episode"));
  const category = url.searchParams.get("category") || "sub";

  if (!anilistId || !episodeNum) {
    return NextResponse.json({ error: "Missing anilistId or episode" }, { status: 400 });
  }

  if (!provider || !ALL_PROVIDERS.includes(provider)) {
    return NextResponse.json({ error: "Invalid or missing provider" }, { status: 400 });
  }

  try {
    const result = await getProviderSources(provider, anilistId, episodeNum, category);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to fetch sources" },
      { status: 500 },
    );
  }
}
