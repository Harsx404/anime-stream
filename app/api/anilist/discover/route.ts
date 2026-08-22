import { NextResponse } from "next/server";
import { discoverAnime, type AnimeSortKey } from "@/lib/anilist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const genresParam = searchParams.get("genres");
  const tagsParam = searchParams.get("tags");
  const sort = (searchParams.get("sort") as AnimeSortKey) || "popularity";
  const year = searchParams.get("year") ? Number(searchParams.get("year")) : undefined;
  const format = searchParams.get("format") || undefined;
  const season = searchParams.get("season") || undefined;
  const status = searchParams.get("status") || undefined;
  const search = searchParams.get("search") || undefined;
  const minDuration = searchParams.get("minDuration") ? Number(searchParams.get("minDuration")) : undefined;
  const maxDuration = searchParams.get("maxDuration") ? Number(searchParams.get("maxDuration")) : undefined;
  const minEpisodes = searchParams.get("minEpisodes") ? Number(searchParams.get("minEpisodes")) : undefined;
  const maxEpisodes = searchParams.get("maxEpisodes") ? Number(searchParams.get("maxEpisodes")) : undefined;
  
  const page = Number(searchParams.get("page") || "1");
  const perPage = Number(searchParams.get("perPage") || "20");

  try {
    const data = await discoverAnime({
      genres: genresParam ? genresParam.split(",").filter(Boolean) : undefined,
      tags: tagsParam ? tagsParam.split(",").filter(Boolean) : undefined,
      sort,
      year,
      format,
      season,
      status,
      search,
      minDuration,
      maxDuration,
      minEpisodes,
      maxEpisodes,
      page,
      perPage,
    });

    return NextResponse.json(data, {
      headers: { "cache-control": "public, max-age=300" },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
