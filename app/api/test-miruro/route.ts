import { NextResponse } from "next/server";

// Test route to check if plain fetch works on Vercel
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const miruroUrl =
    "https://www.miruro.ru/api/secure/pipe?e=eyJwYXRoIjoiZXBpc29kZXMiLCJtZXRob2QiOiJHRVQiLCJxdWVyeSI6eyJhbmlsaXN0SWQiOjE2NDk4fSwiYm9keSI6bnVsbCwidmVyc2lvbiI6IjAuMS4wIn0";

  try {
    const r = await fetch(miruroUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Referer: "https://www.miruro.ru/",
        Origin: "https://www.miruro.ru",
        Accept: "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "sec-fetch-site": "same-origin",
        "sec-fetch-mode": "cors",
        "sec-fetch-dest": "empty",
        "sec-ch-ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
      },
    });

    const text = await r.text();
    return NextResponse.json({
      status: r.status,
      obfuscated: r.headers.get("x-obfuscated"),
      bodyPreview: text.substring(0, 300),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
