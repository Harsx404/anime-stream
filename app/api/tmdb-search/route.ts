import { NextResponse } from "next/server";
import { searchMovies, searchTV, searchMulti } from "@/lib/tmdb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query") || searchParams.get("q");
  const type = searchParams.get("type") || "multi";
  const page = Number(searchParams.get("page") || "1");

  if (!query) {
    return NextResponse.json({ error: "Missing query parameter" }, { status: 400 });
  }

  try {
    let data;
    if (type === "movie") {
      data = await searchMovies(query, page);
    } else if (type === "tv") {
      data = await searchTV(query, page);
    } else {
      data = await searchMulti(query, page);
    }

    return NextResponse.json(data, {
      headers: { "cache-control": "public, max-age=300" },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
