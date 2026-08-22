import { NextResponse } from "next/server";
import { searchAnime } from "@/lib/anilist";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q");
  const page = Number(searchParams.get("page") || "1");
  const perPage = Number(searchParams.get("perPage") || "20");

  if (!query)
    return NextResponse.json({ error: "Missing query param 'q'" }, { status: 400 });

  try {
    const result = await searchAnime(query, page, perPage);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
