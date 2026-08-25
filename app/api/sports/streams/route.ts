import { NextResponse } from "next/server";
import { getMatchStreams } from "@/lib/sports";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const source = searchParams.get("source");
  const id = searchParams.get("id");

  if (!source || !id) {
    return NextResponse.json({ error: "Missing source or id" }, { status: 400 });
  }

  try {
    const streams = await getMatchStreams(source, id);
    return NextResponse.json({ streams });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to fetch streams" },
      { status: 502 },
    );
  }
}
