import { NextResponse } from "next/server";
import { getAnimeTags } from "@/lib/anilist";

export async function GET() {
  try {
    const tags = await getAnimeTags();
    return NextResponse.json({ tags });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
