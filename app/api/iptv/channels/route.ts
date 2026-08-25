import { NextResponse } from "next/server";
import { filterChannels } from "@/lib/iptv";

export const dynamic = "force-dynamic";
export const revalidate = 300;

const DEFAULT_LIMIT = 48;
const MAX_LIMIT = 96;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category") || "all";
  const country = searchParams.get("country") || "all";
  const search = searchParams.get("search") || undefined;
  const offset = Math.max(0, Number(searchParams.get("offset")) || 0);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(searchParams.get("limit")) || DEFAULT_LIMIT));

  try {
    const all = await filterChannels({ category, country, search });
    const channels = all.slice(offset, offset + limit);
    return NextResponse.json({
      channels,
      total: all.length,
      hasMore: offset + limit < all.length,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
