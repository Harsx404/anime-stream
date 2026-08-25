import { NextResponse } from "next/server";
import { getCategories } from "@/lib/iptv";

export const dynamic = "force-dynamic";
export const revalidate = 300;

export async function GET() {
  try {
    const categories = await getCategories();
    return NextResponse.json({ categories });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
