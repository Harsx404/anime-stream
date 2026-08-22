import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  try {
    // The CDN blocks requests with a User-Agent header.
    // Only send Range and Accept — no UA, no Referer, no Origin.
    const headers: Record<string, string> = {
      Accept: "*/*",
    };

    const range = req.headers.get("range");
    if (range) headers["Range"] = range;

    const resp = await fetch(url, { headers });

    if (!resp.ok && resp.status !== 206) {
      return NextResponse.json(
        { error: `Upstream returned ${resp.status}` },
        { status: resp.status }
      );
    }

    const responseHeaders = new Headers();
    const passthrough = [
      "content-type",
      "content-length",
      "content-range",
      "accept-ranges",
    ];
    for (const h of passthrough) {
      const v = resp.headers.get(h);
      if (v) responseHeaders.set(h, v);
    }
    responseHeaders.set("Access-Control-Allow-Origin", "*");

    return new NextResponse(resp.body, {
      status: resp.status,
      headers: responseHeaders,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Proxy failed" },
      { status: 500 }
    );
  }
}
