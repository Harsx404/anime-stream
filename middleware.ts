import { NextRequest, NextResponse } from "next/server";

const RENDER_URL = "https://anime-stream-kcbs.onrender.com";
const VERCEL_URL = "https://anime-stream-harsx404s-projects.vercel.app";

export function middleware(req: NextRequest) {
  const host = req.headers.get("host") || "";
  const isRender = host.includes("onrender.com");

  if (isRender && !req.nextUrl.pathname.startsWith("/api/")) {
    const url = new URL(req.nextUrl.pathname + req.nextUrl.search, VERCEL_URL);
    return NextResponse.redirect(url, 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
