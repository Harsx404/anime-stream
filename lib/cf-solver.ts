// Last-resort fallback for when Miruro's Cloudflare protection escalates to a
// JS interstitial challenge ("Just a moment...") that wreq-js's TLS-only
// spoofing cannot pass (it never runs JavaScript). This spins up a real,
// serverless-sized headless Chromium to solve the challenge once, then hands
// the resulting cf_clearance cookie back to wreq-js for the actual API call.
//
// On by default on Vercel — launching a browser is far heavier (memory,
// cold-start time, and on Vercel's usage-based Fluid compute, real cost)
// than a plain fetch, but it only fires after every TLS-spoofed profile has
// already failed with a confirmed Cloudflare challenge, so normal requests
// are unaffected. If usage/cost becomes a problem, set DISABLE_CF_SOLVER=1
// to turn it back off without touching code. Only runs on Vercel
// (process.env.VERCEL === "1") — Render's free tier (512MB RAM) is too
// small to launch Chromium reliably.

export const CF_SOLVER_ENABLED =
  process.env.DISABLE_CF_SOLVER !== "1" && process.env.VERCEL === "1";

interface SolvedChallenge {
  cookie: string;
  userAgent: string;
  expiresAt: number;
}

// cf_clearance is typically valid ~30 min for a given IP + User-Agent pair.
// Refresh a little early to avoid racing the expiry.
const COOKIE_TTL_MS = 25 * 60 * 1000;
const CHALLENGE_URL = "https://www.miruro.ru/";

let cached: SolvedChallenge | null = null;
let inFlight: Promise<SolvedChallenge | null> | null = null;

export async function getCloudflareCookie(): Promise<SolvedChallenge | null> {
  if (!CF_SOLVER_ENABLED) return null;
  if (cached && Date.now() < cached.expiresAt) return cached;
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
    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });

    const page = await browser.newPage();
    const userAgent = await browser.userAgent();
    await page.goto(CHALLENGE_URL, { waitUntil: "domcontentloaded", timeout: 25000 });

    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) {
      const title = await page.title().catch(() => "");
      if (!title.toLowerCase().includes("just a moment")) break;
      await new Promise((r) => setTimeout(r, 1000));
    }

    const cookies = await page.cookies();
    const clearance = cookies.find((c) => c.name === "cf_clearance");
    if (!clearance) {
      console.error("[CF Solver] No cf_clearance cookie after solve attempt");
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
    return null;
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
