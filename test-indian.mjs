// Test Indian IPTV channels: direct fetch vs DNS-over-HTTPS fix
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
  console.log(`\n  ${label}`);
  console.log(`  URL: ${url.slice(0, 120)}`);

  let directResult = { ok: false, status: null, error: null, isM3u8: false };
  try {
    const res = await directFetch(url);
    directResult.status = res.status;
    directResult.ok = res.status === 200;
    directResult.isM3u8 = res.body.includes("#EXTM3U");
    console.log(`    Direct:  ${res.status === 200 ? "✅" : "❌"} HTTP ${res.status}${directResult.isM3u8 ? " + M3U8" : ""}`);
  } catch (e) {
    directResult.error = e.message;
    console.log(`    Direct:  ❌ ${e.message}`);
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
    console.log(`    DNS Fix: ${res.ok ? "✅" : "❌"} HTTP ${res.status}${dnsResult.isM3u8 ? " + M3U8" : ""}`);
  } catch (e) {
    dnsResult.error = e.message;
    console.log(`    DNS Fix: ❌ ${e.message}`);
  }

  const wasBlocked = !directResult.ok && dnsResult.ok;
  const bothWork = directResult.ok && dnsResult.ok;
  const bothFail = !directResult.ok && !dnsResult.ok;

  if (wasBlocked) console.log(`    → 🟢 DNS FIX WORKED! Was ISP-blocked`);
  else if (bothWork) console.log(`    → ✅ Works both ways`);
  else if (bothFail) console.log(`    → ⚠️  Fails both ways (server down or geo-blocked)`);
  else console.log(`    → ⚠️  Direct works, DNS fix failed (unusual)`);

  return { label, url, directResult, dnsResult, wasBlocked, bothWork, bothFail };
}

async function main() {
  console.log("=== Indian IPTV Channel Test ===\n");

  // 1. Fetch all channels and filter for India (country=IN)
  console.log("1. Fetching all channels from dearbulut/iptv...");
  let allChannels = [];
  try {
    const res = await directFetch("https://dearbulut.github.io/iptv/api/v1/channels.json");
    allChannels = JSON.parse(res.body);
    console.log(`   Total channels: ${allChannels.length}`);
  } catch (e) {
    console.log(`   ❌ Failed: ${e.message}`);
    return;
  }

  // Filter Indian channels
  const indianChannels = allChannels.filter(ch => ch.country === "IN");
  console.log(`   Indian channels: ${indianChannels.length}`);

  // Get channels with streams
  const withStreams = indianChannels.filter(ch => ch.streams && ch.streams.length > 0);
  const onlineWithStreams = withStreams.filter(ch => ch.online);
  console.log(`   With streams: ${withStreams.length}`);
  console.log(`   Online with streams: ${onlineWithStreams.length}`);

  // Group by category
  const byCategory = {};
  for (const ch of onlineWithStreams) {
    for (const cat of ch.categories || []) {
      byCategory[cat] = (byCategory[cat] || 0) + 1;
    }
  }
  console.log(`   Categories:`, Object.entries(byCategory).sort((a,b) => b[1]-a[1]).map(([c,n]) => `${c}:${n}`).join(", "));

  // Test all online Indian channels (or up to 40)
  const testList = onlineWithStreams.slice(0, 40);
  console.log(`\n2. Testing ${testList.length} online Indian channels...\n`);

  const results = [];
  for (const ch of testList) {
    const stream = ch.streams[0];
    const cats = (ch.categories || []).join(",");
    const result = await testStream(
      stream.url,
      `${ch.name} [${cats}] [${stream.quality || "?"}]`
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
    console.log(`\n✅ Working Indian channels:`);
    working.forEach(r => console.log(`   - ${r.label}`));
  }

  const failed = results.filter(r => r.bothFail);
  if (failed.length > 0) {
    console.log(`\n⚠️  Failed even with DNS fix:`);
    failed.forEach(r => console.log(`   - ${r.label} (direct: ${r.directResult.error || r.directResult.status}, dns: ${r.dnsResult.error || r.dnsResult.status})`));
  }

  console.log("\n=== Done ===");
}

main().catch(console.error);
