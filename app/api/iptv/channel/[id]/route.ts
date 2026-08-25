import { NextResponse } from "next/server";
import { getChannelById } from "@/lib/iptv";

export const dynamic = "force-dynamic";
export const revalidate = 300;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const channel = await getChannelById(id);
    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }
    return NextResponse.json({ channel });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
