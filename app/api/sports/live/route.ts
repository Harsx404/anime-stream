import { NextResponse } from "next/server";
import { getLiveMatches } from "@/lib/sports";

export const dynamic = "force-dynamic";
export const revalidate = 60;

export async function GET() {
  try {
    const matches = await getLiveMatches();
    return NextResponse.json({ matches, count: matches.length });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
