import { NextResponse } from "next/server";
import { dnsFetch } from "@/lib/dns-fix";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const anilistId = searchParams.get("anilistId");
  const episode = searchParams.get("episode");
  const tmdbId = searchParams.get("tmdbId");
  const season = searchParams.get("season");
  const mediaType = searchParams.get("mediaType"); // "tv" or "anime"

  try {
    // Anime path: use AniSkip API
    if (anilistId && episode) {
      // Step 1: Get MAL ID from AniList
      const gqlRes = await dnsFetch("https://graphql.anilist.co", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          query: `query ($id: Int) { Media(id: $id, type: ANIME) { idMal } }`,
          variables: { id: Number(anilistId) },
        }),
      });

      if (gqlRes.ok) {
        const gqlData = await gqlRes.json();
        const malId = gqlData?.data?.Media?.idMal;

        if (malId) {
          // Step 2: Fetch skip times from AniSkip
          const skipRes = await dnsFetch(
            `https://api.aniskip.com/v2/skip-times/${malId}/${episode}?types[]=outro&types[]=ed`,
            { headers: { Accept: "application/json" } }
          );

          if (skipRes.ok) {
            const skipData = await skipRes.json();
            const skipTimes = skipData?.data || [];
            const outro = skipTimes.find(
              (s: any) => s.skipType === "outro" || s.skipType === "ed"
            );

            if (outro?.skip?.start) {
              return NextResponse.json({
                outroStart: outro.skip.start,
                outroEnd: outro.skip.end,
              });
            }
          }
        }
      }
    }

    // TV show path: estimate outro at 95% of episode runtime via TMDB
    if (tmdbId && season && episode && mediaType === "tv") {
      const tmdbKey = process.env.TMDB_API_KEY;
      if (tmdbKey) {
        const epRes = await dnsFetch(
          `https://api.themoviedb.org/3/tv/${tmdbId}/season/${season}/episode/${episode}?api_key=${tmdbKey}`,
          { headers: { Accept: "application/json" } }
        );

        if (epRes.ok) {
          const epData = await epRes.json();
          const runtime = epData?.runtime; // in minutes
          if (runtime && runtime > 0) {
            const totalSeconds = runtime * 60;
            const outroStart = Math.floor(totalSeconds * 0.95);
            return NextResponse.json({
              outroStart,
              outroEnd: totalSeconds,
            });
          }
        }
      }
    }

    return NextResponse.json({ outroStart: null });
  } catch {
    return NextResponse.json({ outroStart: null });
  }
}
