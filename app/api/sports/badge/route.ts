import { NextResponse } from "next/server";
import { dnsFetch } from "@/lib/dns-fix";

export const dynamic = "force-dynamic";
export const revalidate = 86400; // 24 hours

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const badge = searchParams.get("badge");

  if (!badge) {
    return NextResponse.json({ error: "Missing badge param" }, { status: 400 });
  }

  try {
    const url = `https://streamed.pk/api/images/badge/${encodeURIComponent(badge)}.webp`;
    const res = await dnsFetch(url, {
      headers: { Accept: "image/*" },
      cache: "no-store",
    });

    if (!res.ok) {
      return new NextResponse(null, { status: res.status });
    }

    const contentType = res.headers.get("content-type") || "image/webp";
    const buffer = await res.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, immutable",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
