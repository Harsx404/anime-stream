import { NextResponse } from "next/server";
import { getSports } from "@/lib/sports";

export const dynamic = "force-dynamic";
export const revalidate = 600;

export async function GET() {
  try {
    const sports = await getSports();
    return NextResponse.json({ sports });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
