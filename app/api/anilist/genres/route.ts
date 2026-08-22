import { NextResponse } from "next/server";
import { getAnimeGenres } from "@/lib/anilist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const genres = await getAnimeGenres();
    return NextResponse.json({ genres }, {
      headers: { "cache-control": "public, max-age=3600" },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
