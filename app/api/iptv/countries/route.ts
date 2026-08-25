import { NextResponse } from "next/server";
import { getCountries } from "@/lib/iptv";

export const dynamic = "force-dynamic";
export const revalidate = 300;

export async function GET() {
  try {
    const countries = await getCountries();
    return NextResponse.json({ countries });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
