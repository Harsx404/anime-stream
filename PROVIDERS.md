# Removed Movie/Show Streaming Providers

These providers were removed from the codebase. Documented here for reference when building the new movie streaming API.

## 1. Videasy / VidKing.net

- **File**: `lib/videasy-server.ts`
- **API Route**: `app/api/videasy/route.ts`
- **API Base**: `https://api.speedracelight.com`
- **TMDB Base**: `https://db.speedracelight.com/3`
- **Subtitles**: `https://subs.videasy.to`
- **Frontend**: `https://www.vidking.net/`
- **Encryption**: Custom PRNG-based XOR cipher with seed-based decryption
- **Flow**: Fetch seed → Fetch encrypted sources → Decrypt with seed
- **Sub-providers**:
  - Yoru (`cdn/sources-with-title`)
  - Cypher (`downloader2/sources-with-title`)
  - Breach (`m4uhd/sources-with-title`)
  - Neon (`vsrc/sources-with-title`)
  - Vyse (`hdmovie/sources-with-title`)
  - Killjoy (`meine/sources-with-title`)
  - Fade (`hdmovie/sources-with-title`)
  - Omen (`lamovie/sources-with-title`)
  - Raze (`superflix/sources-with-title`)
- **Quality**: Up to 4K (2160p)
- **Stream Types**: HLS (`.m3u8`), DASH (`.mpd`)

## 2. Cineplay

- **File**: `lib/cineplay-server.ts`
- **API Route**: `app/api/cineplay/route.ts`
- **API Base**: `https://api.speedracelight.com` (same as Videasy)
- **Encryption**: Same custom stream cipher as Videasy (RC4 KSA + hash accumulator)
- **Note**: Same backend API as Videasy, different client implementation

## 3. Movienight / BingeBox

- **File**: `lib/movienight-server.ts`, `lib/bingebox-server.ts`
- **API Route**: `app/api/bingebox/route.ts`, `app/api/bingebox/servers/route.ts`
- **API Base**: `https://movienight.ht`
- **Auth**: `POST /api/auth/create` → session cookie (24h TTL)
- **Streaming**: Server-Sent Events (SSE) via `GET /api/stream/v1/movie/{tmdbId}` and `GET /api/stream/v1/tv/{tmdbId}/{season}/{episode}`
- **Stream Proxy**: `https://proxy.scrapeequalsgayporn.st/api/stream/proxy?u={base64url}`
- **Servers**:
  - 4K: `dallas`, `seattle`
  - Non-4K: `austin`, `boston`, `tucson`, `salem`, `vixsrc-1`, `orlando`, `atlanta`, `phoenix`, `nashville`, `california`, `helena`
- **Quality**: 2160p, 1080p, 720p, 480p (4K servers); auto only (non-4K)
- **Note**: BingeBox used Puppeteer; Movienight used direct HTTP with session cookie

## 4. 4KHDHub

- **File**: `lib/4khdhub-server.ts`
- **API Route**: `app/api/4khdhub/route.ts`
- **Website**: `https://4khdhub.site`
- **Flow**: Scrape 4KHDHub download items → Resolve HubCloud links → Fetch gamerxyt.com intermediate page → Extract direct download URL (Cloudflare Workers)
- **Download hosts**: `*.workers.dev` (e.g., `download.amazonfilexcdn.workers.dev`), `pixel.hubcloud.cx`
- **Format**: MKV files (BluRay REMUX, HEVC, HDR)
- **Quality**: Up to 2160p UHD
- **Sizes**: 1GB–70GB+
- **Note**: Direct file download, not streaming. Required HLS proxy with Range header handling and rate-limit retry logic for `workers.dev` domains.

## 5. VidLink (tested, not fully integrated)

- **API**: `https://vidlink.pro/api/b/movie/{encId}` and `https://vidlink.pro/api/b/tv/{encId}/{season}/{episode}`
- **Encryption**: TMDB ID encoded via `https://enc-dec.app/api/enc-vidlink`
- **Quality**: Up to 2160p
- **Subtitles**: Included in response (`stream.captions`)

## 6. VixSrc (tested, not fully integrated)

- **API**: `https://vixsrc.to/movie/{tmdbId}` and `https://vixsrc.to/tv/{tmdbId}/{season}/{episode}`
- **Subtitles**: Fetched from `https://sub.wyzie.ru/search?id={tmdbId}`
- **Quality**: Up to 2160p

## Infrastructure Removed

- **HLS Proxy** (`app/api/hls-proxy/route.ts`): General-purpose proxy for movie providers. Handled CORS, Range headers, Referer/Origin injection, and rate-limit retries for `workers.dev` domains.
- **CineplayWatchClient** (`components/CineplayWatchClient.tsx`): Movie/TV watch client with server selection, quality picker, HLS.js + dashjs + playsvideo (MKV remuxing).
- **use-cineplay** (`lib/use-cineplay.ts`): Client hook for Cineplay sources.

## Anime Providers (KEPT)

- **Miruro** (`lib/miruro-server.ts`): `https://www.miruro.ru/api/secure/pipe` — anime stream resolver with XOR+gzip obfuscation, using wreq-js for TLS fingerprint bypass.
- **AniList** (`lib/anilist.ts`): `https://graphql.anilist.co` — anime metadata, trending, seasonal, genres, tags.
