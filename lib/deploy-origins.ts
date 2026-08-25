// This app is deployed twice (Vercel + Render) with different egress IPs.
// Miruro sits behind Cloudflare, which sometimes blocks/challenges one host's
// IP range while the other still gets through. Miruro-dependent routes use
// this to fail over to the sibling deployment instead of erroring outright.

export const RENDER_ORIGIN = "https://anime-stream-kcbs.onrender.com";
export const VERCEL_ORIGIN = "https://anime-stream-harsx404s-projects.vercel.app";

export const INTERNAL_FALLBACK_HEADER = "x-internal-fallback";

export function siblingOrigin(): string | null {
  if (process.env.VERCEL === "1") return RENDER_ORIGIN;
  if (process.env.RENDER === "true") return VERCEL_ORIGIN;
  return null;
}
