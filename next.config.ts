import type { NextConfig } from "next";

const isVercel = process.env.VERCEL === "1";
const RENDER_API_BASE = "https://anime-stream-kcbs.onrender.com";

const streamingRewrites = isVercel
  ? [
      { source: "/api/bingebox/:path*", destination: `${RENDER_API_BASE}/api/bingebox/:path*` },
      { source: "/api/hls/:path*", destination: `${RENDER_API_BASE}/api/hls/:path*` },
      { source: "/api/mp4", destination: `${RENDER_API_BASE}/api/mp4` },
      { source: "/api/skip-times", destination: `${RENDER_API_BASE}/api/skip-times` },
      { source: "/api/opensubtitles", destination: `${RENDER_API_BASE}/api/opensubtitles` },
      { source: "/api/subtitles", destination: `${RENDER_API_BASE}/api/subtitles` },
      { source: "/api/sub-proxy", destination: `${RENDER_API_BASE}/api/sub-proxy` },
      { source: "/api/videasy", destination: `${RENDER_API_BASE}/api/videasy` },
      { source: "/api/vidlink", destination: `${RENDER_API_BASE}/api/vidlink` },
      { source: "/api/vixsrc", destination: `${RENDER_API_BASE}/api/vixsrc` },
      { source: "/api/zxcstreams", destination: `${RENDER_API_BASE}/api/zxcstreams` },
      { source: "/api/hdghartv", destination: `${RENDER_API_BASE}/api/hdghartv` },
      { source: "/api/4khdhub", destination: `${RENDER_API_BASE}/api/4khdhub` },
      { source: "/api/sources", destination: `${RENDER_API_BASE}/api/sources` },
      { source: "/api/episodes", destination: `${RENDER_API_BASE}/api/episodes` },
      { source: "/api/iptv/:path*", destination: `${RENDER_API_BASE}/api/iptv/:path*` },
      { source: "/api/sports/:path*", destination: `${RENDER_API_BASE}/api/sports/:path*` },
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
