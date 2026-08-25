// Test IPTV streams: direct fetch vs DNS-over-HTTPS fix
// Verifies ISP blocking and confirms dnsFetch bypass works
import https from "node:https";
import http from "node:http";
import { dnsFetch } from "./lib/dns-fix.ts";

// --- Direct fetch (uses system DNS, subject to ISP blocking) ---
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
  console.log(`\n  Testing: ${label}`);
  console.log(`  URL: ${url.slice(0, 100)}...`);

  // 1. Direct fetch (system DNS - may be ISP blocked)
  let directResult = { ok: false, status: null, error: null, isM3u8: false };
  try {
    const res = await directFetch(url);
    directResult.status = res.status;
    directResult.ok = res.status === 200;
    directResult.isM3u8 = res.body.includes("#EXTM3U");
    console.log(`    Direct:  ${res.status === 200 ? "✅" : "❌"} HTTP ${res.status}${directResult.isM3u8 ? " + M3U8 valid" : ""}`);
  } catch (e) {
    directResult.error = e.message;
    console.log(`    Direct:  ❌ ${e.message}`);
  }

  // 2. DNS fix fetch (DoH via Cloudflare)
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
    console.log(`    DNS Fix: ${res.ok ? "✅" : "❌"} HTTP ${res.status}${dnsResult.isM3u8 ? " + M3U8 valid" : ""}`);
  } catch (e) {
    dnsResult.error = e.message;
    console.log(`    DNS Fix: ❌ ${e.message}`);
  }

  // Summary
  const wasBlocked = !directResult.ok && dnsResult.ok;
  const bothWork = directResult.ok && dnsResult.ok;
  const bothFail = !directResult.ok && !dnsResult.ok;

  if (wasBlocked) {
    console.log(`    → 🟢 DNS FIX WORKED! Stream was ISP-blocked, now accessible via DoH`);
  } else if (bothWork) {
    console.log(`    → ✅ Stream works both ways (not ISP-blocked)`);
  } else if (bothFail) {
    console.log(`    → ⚠️  Stream down/blocked entirely (not just DNS)`);
  } else {
    console.log(`    → ⚠️  Direct works but DNS fix failed (unusual)`);
  }

  return { label, url, directResult, dnsResult, wasBlocked, bothWork, bothFail };
}

async function main() {
  console.log("=== IPTV DNS Fix Test (v2: HTTP support, redirects, IP-literals, relaxed TLS) ===");
  console.log("Comparing direct fetch (system DNS) vs DNS-over-HTTPS (Cloudflare DoH)\n");

  // Test streams from dearbulut/iptv sports category (online ones)
  console.log("1. Fetching online sports channels from dearbulut/iptv...");
  let sportsChannels = [];
  try {
    const res = await directFetch("https://dearbulut.github.io/iptv/api/v1/by-category/sports.json");
    const data = JSON.parse(res.body);
    sportsChannels = data.filter(ch => ch.online && ch.streams?.length > 0);
    console.log(`   Found ${sportsChannels.length} online sports channels with streams`);
  } catch (e) {
    console.log(`   ❌ Failed to fetch sports data: ${e.message}`);
  }

  // Pick 15 diverse streams to test
  const testChannels = sportsChannels.slice(0, 15);
  console.log(`\n2. Testing ${testChannels.length} sample streams (direct vs DNS fix)...`);

  const results = [];
  for (const ch of testChannels) {
    const stream = ch.streams[0]; // best stream
    const result = await testStream(stream.url, `${ch.name} (${ch.country}) [${stream.quality}]`);
    results.push(result);
  }

  // Also test some non-sports channels (news, movies)
  console.log("\n3. Testing news/movie channels...");
  for (const cat of ["news", "movies"]) {
    try {
      const res = await directFetch(`https://dearbulut.github.io/iptv/api/v1/by-category/${cat}.json`);
      const data = JSON.parse(res.body);
      const online = data.filter(ch => ch.online && ch.streams?.length > 0);
      const sample = online.slice(0, 5);
      for (const ch of sample) {
        const result = await testStream(ch.streams[0].url, `${ch.name} (${ch.country}) [${cat}]`);
        results.push(result);
      }
    } catch (e) {
      console.log(`  ❌ Failed to fetch ${cat}: ${e.message}`);
    }
  }

  // Summary
  console.log("\n\n=== SUMMARY ===");
  console.log(`Total streams tested: ${results.length}`);
  console.log(`Works both ways:     ${results.filter(r => r.bothWork).length}`);
  console.log(`DNS fix unblocked:   ${results.filter(r => r.wasBlocked).length}`);
  console.log(`Both fail:           ${results.filter(r => r.bothFail).length}`);
  console.log(`Direct only:         ${results.filter(r => r.directResult.ok && !r.dnsResult.ok).length}`);

  const blockedList = results.filter(r => r.wasBlocked);
  if (blockedList.length > 0) {
    console.log(`\n🟢 Streams UNBLOCKED by DNS fix:`);
    blockedList.forEach(r => console.log(`   - ${r.label}`));
  }

  const bothFailList = results.filter(r => r.bothFail);
  if (bothFailList.length > 0) {
    console.log(`\n⚠️  Streams that fail even with DNS fix:`);
    bothFailList.forEach(r => console.log(`   - ${r.label} (direct: ${r.directResult.error || r.directResult.status}, dns: ${r.dnsResult.error || r.dnsResult.status})`));
  }

  console.log("\n=== Done ===");
}

main().catch(console.error);
