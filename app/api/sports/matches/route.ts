import { NextResponse } from "next/server";
import { getMatchesBySport, getAllMatches, getLiveMatches, groupMatchesByStatus } from "@/lib/sports";

export const dynamic = "force-dynamic";
export const revalidate = 120;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sport = searchParams.get("sport") || "all";

  try {
    const [matches, allLive] = await Promise.all([
      sport === "all" ? getAllMatches() : getMatchesBySport(sport),
      // Use the API's own live/not-live signal instead of guessing from a
      // fixed time window — that heuristic drops long-running matches
      // (cricket routinely runs 3-8h) out of "live" while they're still on.
      getLiveMatches().catch(() => []),
    ]);

    const live = sport === "all" ? allLive : allLive.filter((m) => m.category === sport);
    const liveIds = new Set(live.map((m) => m.id));

    // groupMatchesByStatus's own live-heuristic bucket is discarded here —
    // only its today/upcoming grouping is used — and matches already
    // counted as live above are excluded so they don't also show as today.
    const { today, upcoming } = groupMatchesByStatus(matches.filter((m) => !liveIds.has(m.id)));

    return NextResponse.json({
      live,
      today,
      upcoming,
      total: matches.length,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
