// Last-resort fallback for when Miruro's Cloudflare protection escalates to a
// JS interstitial challenge ("Just a moment...") that wreq-js's TLS-only
// spoofing cannot pass (it never runs JavaScript). This spins up a real,
// serverless-sized headless Chromium to solve the challenge once, then hands
// the resulting cf_clearance cookie back to wreq-js for the actual API call.
//
// DISABLED as of 2026-08-26. Tested twice against the real Miruro challenge
// in production (with and without --single-process, plus webdriver/plugin
// stealth patches) — both attempts produced the identical failure: the page
// stays stuck showing "Just a moment..." with zero cookies ever set, not
// even Cloudflare's baseline __cf_bm. That means the challenge subresource
// script never runs to completion in this environment, not that it's
// failing the challenge — a config tweak here won't fix that. Since it was
// launching a full Chromium per blocked request for zero benefit, it's off
// until there's an actual new hypothesis worth spending compute to test.
// Re-enable with ENABLE_CF_SOLVER=1 once one exists.

export const CF_SOLVER_ENABLED =
  process.env.ENABLE_CF_SOLVER === "1" && process.env.VERCEL === "1";

interface SolvedChallenge {
  cookie: string;
  userAgent: string;
  expiresAt: number;
}

// cf_clearance is typically valid ~30 min for a given IP + User-Agent pair.
// Refresh a little early to avoid racing the expiry.
const COOKIE_TTL_MS = 25 * 60 * 1000;
const CHALLENGE_URL = "https://www.miruro.ru/";

// If a solve attempt fails, don't retry on every subsequent request — that
// would launch a full Chromium instance per request for a known-bad state.
// Back off for a while first.
const FAILURE_COOLDOWN_MS = 10 * 60 * 1000;

let cached: SolvedChallenge | null = null;
let lastFailureAt = 0;
let inFlight: Promise<SolvedChallenge | null> | null = null;

export async function getCloudflareCookie(): Promise<SolvedChallenge | null> {
  if (!CF_SOLVER_ENABLED) return null;
  if (cached && Date.now() < cached.expiresAt) return cached;
  if (lastFailureAt && Date.now() - lastFailureAt < FAILURE_COOLDOWN_MS) return null;
  if (inFlight) return inFlight;

  inFlight = solve().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function solve(): Promise<SolvedChallenge | null> {
  const [{ default: chromium }, { default: puppeteer }] = await Promise.all([
    import("@sparticuz/chromium"),
    import("puppeteer-core"),
  ]);

  let browser: import("puppeteer-core").Browser | undefined;
  try {
    // @sparticuz/chromium defaults to --single-process (needed to avoid a
    // prctl sandbox crash on classic AWS Lambda). Last attempt hung forever
    // on the challenge page with zero cookies ever set — not even
    // Cloudflare's baseline __cf_bm — which points at the renderer not
    // actually running the challenge script rather than failing it. Vercel's
    // Fluid compute isn't classic Lambda, so try without it.
    const args = chromium.args
      .filter((a: string) => a !== "--single-process")
      .concat("--disable-blink-features=AutomationControlled");

    browser = await puppeteer.launch({
      args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });

    const page = await browser.newPage();
    const userAgent = await browser.userAgent();

    // Puppeteer's default headless Chromium exposes automation fingerprints
    // (navigator.webdriver, missing chrome.runtime, etc.) that Cloudflare's
    // bot-management score checks independently of the JS-timing challenge.
    // Patch the obvious ones before any page script runs.
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
      // @ts-expect-error - injecting a stub for a browser-only global
      window.chrome = { runtime: {} };
      Object.defineProperty(navigator, "languages", { get: () => ["en-US", "en"] });
      Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] });
    });

    await page.goto(CHALLENGE_URL, { waitUntil: "domcontentloaded", timeout: 25000 });

    const deadline = Date.now() + 25000;
    let lastTitle = "";
    while (Date.now() < deadline) {
      lastTitle = await page.title().catch(() => "");
      const hasClearance = (await page.cookies()).some((c) => c.name === "cf_clearance");
      if (hasClearance || !lastTitle.toLowerCase().includes("just a moment")) break;
      await new Promise((r) => setTimeout(r, 1000));
    }

    const cookies = await page.cookies();
    const clearance = cookies.find((c) => c.name === "cf_clearance");
    if (!clearance) {
      console.error(
        `[CF Solver] No cf_clearance after solve attempt. title="${lastTitle}" url="${page.url()}" cookies=[${cookies.map((c) => c.name).join(",")}]`,
      );
      lastFailureAt = Date.now();
      return null;
    }

    const result: SolvedChallenge = {
      cookie: cookies.map((c) => `${c.name}=${c.value}`).join("; "),
      userAgent,
      expiresAt: Date.now() + COOKIE_TTL_MS,
    };
    cached = result;
    console.log("[CF Solver] Solved Cloudflare challenge, cookie cached");
    return result;
  } catch (e) {
    console.error("[CF Solver] Failed:", String(e));
    lastFailureAt = Date.now();
    return null;
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
