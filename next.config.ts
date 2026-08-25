import type { NextConfig } from "next";

const isVercel = process.env.VERCEL === "1";
const RENDER_API_BASE = "https://anime-stream-kcbs.onrender.com";

const streamingRewrites = isVercel
  ? [
      { source: "/api/bingebox/:path*", destination: `${RENDER_API_BASE}/api/bingebox/:path*` },
      { source: "/api/hls/:path*", destination: `${RENDER_API_BASE}/api/hls/:path*` },
      { source: "/api/skip-times", destination: `${RENDER_API_BASE}/api/skip-times` },
      { source: "/api/opensubtitles", destination: `${RENDER_API_BASE}/api/opensubtitles` },
      { source: "/api/subtitles/:path*", destination: `${RENDER_API_BASE}/api/subtitles/:path*` },
      { source: "/api/sub-proxy", destination: `${RENDER_API_BASE}/api/sub-proxy` },
    ]
  : [];

const nextConfig: NextConfig = {
  serverExternalPackages: ["wreq-js"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "s4.anilist.co" },
      { protocol: "https", hostname: "img.anili.st" },
      { protocol: "https", hostname: "image.tmdb.org" },
      { protocol: "https", hostname: "cdn.anizara.store" },
    ],
    localPatterns: [
      { pathname: "/api/tmdb-image" },
    ],
  },
  async rewrites() {
    return {
      beforeFiles: streamingRewrites,
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
