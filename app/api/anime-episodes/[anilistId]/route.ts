import { NextResponse } from "next/server";
import { getProviderEpisodes, getBestEpisodes, ALL_PROVIDERS, type ProviderName } from "@/lib/anime-providers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ anilistId: string }> },
) {
  const { anilistId: idStr } = await params;
  const anilistId = Number(idStr);
  if (!anilistId) return NextResponse.json({ error: "Invalid anilistId" }, { status: 400 });

  const url = new URL(request.url);
  const provider = url.searchParams.get("provider") as ProviderName | null;

  try {
    if (provider && ALL_PROVIDERS.includes(provider)) {
      const result = await getProviderEpisodes(provider, anilistId);
      return NextResponse.json({ provider, ...result });
    }

    // Try all providers, return first success
    const { provider: usedProvider, result } = await getBestEpisodes(anilistId);
    return NextResponse.json({ provider: usedProvider, ...result });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to fetch episodes" },
      { status: 500 },
    );
  }
}
