// Test sports IPTV channels across countries: direct vs DNS fix
import https from "node:https";
import http from "node:http";
import { dnsFetch } from "./lib/dns-fix.ts";

function directFetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const isHttps = parsed.protocol === "https:";
    const port = parsed.port ? Number(parsed.port) : isHttps ? 443 : 80;
    const engine = isHttps ? https : http;
    const req = engine.request(
      {
        hostname: parsed.hostname,
        port,
        path: parsed.pathname + parsed.search,
        method: options.method || "GET",
        headers: {
          "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          accept: "*/*",
          "accept-encoding": "identity",
          ...(options.headers || {}),
        },
        servername: parsed.hostname,
        timeout: 15000,
        rejectUnauthorized: false,
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks).toString("utf-8"),
          });
        });
      }
    );
    req.on("timeout", () => { req.destroy(new Error("timeout")); });
    req.on("error", reject);
    req.end();
  });
}

async function testStream(url, label) {
  let directResult = { ok: false, status: null, error: null, isM3u8: false };
  try {
    const res = await directFetch(url);
    directResult.status = res.status;
    directResult.ok = res.status === 200;
    directResult.isM3u8 = res.body.includes("#EXTM3U");
  } catch (e) {
    directResult.error = e.message;
  }

  let dnsResult = { ok: false, status: null, error: null, isM3u8: false };
  try {
    const res = await dnsFetch(url, {
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        accept: "*/*",
      },
    });
    dnsResult.status = res.status;
    dnsResult.ok = res.ok;
    const body = await res.text();
    dnsResult.isM3u8 = body.includes("#EXTM3U");
  } catch (e) {
    dnsResult.error = e.message;
  }

  const wasBlocked = !directResult.ok && dnsResult.ok;
  const bothWork = directResult.ok && dnsResult.ok;
  const bothFail = !directResult.ok && !dnsResult.ok;

  const icon = bothWork ? "✅" : wasBlocked ? "🟢" : bothFail ? "❌" : "⚠️";
  const detail = wasBlocked ? "DNS FIX UNBLOCKED"
    : bothWork ? "works"
    : bothFail ? `fail (direct: ${directResult.error || directResult.status}, dns: ${dnsResult.error || dnsResult.status})`
    : "direct only";
  console.log(`  ${icon} ${label} → ${detail}`);

  return { label, url, directResult, dnsResult, wasBlocked, bothWork, bothFail };
}

async function main() {
  console.log("=== Sports IPTV Channel Test ===\n");

  // Fetch sports channels
  console.log("Fetching online sports channels from dearbulut/iptv...");
  let sportsChannels = [];
  try {
    const res = await directFetch("https://dearbulut.github.io/iptv/api/v1/by-category/sports.json");
    const data = JSON.parse(res.body);
    sportsChannels = data.filter(ch => ch.online && ch.streams?.length > 0);
    console.log(`Found ${sportsChannels.length} online sports channels with streams\n`);
  } catch (e) {
    console.log(`❌ Failed: ${e.message}`);
    return;
  }

  // Group by country
  const byCountry = {};
  for (const ch of sportsChannels) {
    const c = ch.country || "??";
    byCountry[c] = (byCountry[c] || 0) + 1;
  }
  const topCountries = Object.entries(byCountry).sort((a,b) => b[1]-a[1]).slice(0, 15);
  console.log("Top countries:", topCountries.map(([c,n]) => `${c}:${n}`).join(", "));
  console.log();

  // Test ALL online sports channels (up to 80)
  const testList = sportsChannels.slice(0, 80);
  console.log(`Testing ${testList.length} sports channels...\n`);

  const results = [];
  for (const ch of testList) {
    const stream = ch.streams[0];
    const result = await testStream(
      stream.url,
      `${ch.name} (${ch.country}) [${stream.quality || "?"}]`
    );
    results.push(result);
  }

  // Summary
  console.log("\n\n=== SUMMARY ===");
  console.log(`Total tested:        ${results.length}`);
  console.log(`Works both ways:     ${results.filter(r => r.bothWork).length}`);
  console.log(`DNS fix unblocked:   ${results.filter(r => r.wasBlocked).length}`);
  console.log(`Both fail:           ${results.filter(r => r.bothFail).length}`);

  const blocked = results.filter(r => r.wasBlocked);
  if (blocked.length > 0) {
    console.log(`\n🟢 UNBLOCKED by DNS fix:`);
    blocked.forEach(r => console.log(`   - ${r.label}`));
  }

  const working = results.filter(r => r.bothWork);
  if (working.length > 0) {
    console.log(`\n✅ Working sports channels (${working.length}):`);
    working.forEach(r => console.log(`   - ${r.label}`));
  }

  const failed = results.filter(r => r.bothFail);
  if (failed.length > 0) {
    console.log(`\n❌ Failed even with DNS fix (${failed.length}):`);
    failed.forEach(r => console.log(`   - ${r.label} (${r.dnsResult.error || r.dnsResult.status})`));
  }

  console.log("\n=== Done ===");
}

main().catch(console.error);
