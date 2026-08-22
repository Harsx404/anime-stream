import type { NextConfig } from "next";

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
};

export default nextConfig;
