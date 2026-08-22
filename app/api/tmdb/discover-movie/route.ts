import { NextResponse } from "next/server";
import { discoverMovies, type SortKey } from "@/lib/tmdb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const genresParam = searchParams.get("genres");
  const sort = (searchParams.get("sort") as SortKey) || "popularity";
  const year = searchParams.get("year") ? Number(searchParams.get("year")) : undefined;
  const search = searchParams.get("search") || undefined;
  const minDuration = searchParams.get("minDuration") ? Number(searchParams.get("minDuration")) : undefined;
  const maxDuration = searchParams.get("maxDuration") ? Number(searchParams.get("maxDuration")) : undefined;
  const page = Number(searchParams.get("page") || "1");

  try {
    const data = await discoverMovies({
      genres: genresParam ? genresParam.split(",").map(Number).filter(Boolean) : undefined,
      sort,
      year,
      search,
      minDuration,
      maxDuration,
      page,
    });
    return NextResponse.json(data, {
      headers: { "cache-control": "public, max-age=300" },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
