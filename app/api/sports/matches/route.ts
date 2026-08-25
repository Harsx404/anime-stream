import { NextResponse } from "next/server";
import { getMatchesBySport, getAllMatches, groupMatchesByStatus } from "@/lib/sports";

export const dynamic = "force-dynamic";
export const revalidate = 120;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sport = searchParams.get("sport") || "all";

  try {
    const matches = sport === "all"
      ? await getAllMatches()
      : await getMatchesBySport(sport);
    const grouped = groupMatchesByStatus(matches);
    return NextResponse.json({
      ...grouped,
      total: matches.length,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
