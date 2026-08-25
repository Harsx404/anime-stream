// Test FAST/IPTV providers for live TV
import https from "node:https";

function fetchWithDns(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = https.request(
      {
        hostname: parsed.hostname,
        port: 443,
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

async function testM3u8(url, referer) {
  try {
    const res = await fetchWithDns(url, {
      headers: referer ? { referer } : {},
    });
    if (res.status !== 200) return { ok: false, status: res.status, url };
    const isM3u8 = res.body.includes("#EXTM3U");
    return { ok: isM3u8, status: res.status, isM3u8, url, sample: res.body.slice(0, 200) };
  } catch (e) {
    return { ok: false, error: e.message, url };
  }
}

async function main() {
  console.log("=== Testing FAST/IPTV Providers ===\n");

  // 1. Test i.mjh.nz/all/tv.json
  console.log("1. Fetching i.mjh.nz/all/tv.json...");
  try {
    const tvRes = await fetchWithDns("https://i.mjh.nz/all/tv.json");
    console.log(`   Status: ${tvRes.status}, Size: ${tvRes.body.length} chars`);
    const tvData = JSON.parse(tvRes.body);
    const channelIds = Object.keys(tvData);
    console.log(`   Channels: ${channelIds.length}`);
    
    // Sample first 5 channels
    const sample = channelIds.slice(0, 5);
    for (const id of sample) {
      const ch = tvData[id];
      console.log(`   - ${ch.name} (${id}) | network: ${ch.network} | url: ${ch.mjh_master?.slice(0, 80)}...`);
    }

    // Test 10 random M3U8 URLs
    console.log("\n   Testing 10 sample M3U8 streams from tv.json...");
    const testIds = channelIds.slice(0, 10);
    let working = 0;
    for (const id of testIds) {
      const ch = tvData[id];
      if (!ch.mjh_master) continue;
      const result = await testM3u8(ch.mjh_master, ch.headers?.referer);
      console.log(`   ${result.ok ? "✅" : "❌"} ${ch.name}: ${result.status || result.error}`);
      if (result.ok) working++;
    }
    console.log(`   Working: ${working}/${testIds.length}`);
  } catch (e) {
    console.log(`   ❌ Failed: ${e.message}`);
  }

  // 2. Test iptv-org streams.json
  console.log("\n2. Fetching iptv-org.github.io/api/streams.json...");
  try {
    const streamsRes = await fetchWithDns("https://iptv-org.github.io/api/streams.json");
    console.log(`   Status: ${streamsRes.status}, Size: ${streamsRes.body.length} chars`);
    const streams = JSON.parse(streamsRes.body);
    console.log(`   Total streams: ${streams.length}`);
    
    // Filter for US/English channels with non-null URLs
    const usStreams = streams.filter(s => s.url && s.url.includes(".m3u8"));
    console.log(`   M3U8 streams: ${usStreams.length}`);

    // Test 10 random M3U8 URLs
    console.log("\n   Testing 10 sample M3U8 streams from iptv-org...");
    const testStreams = usStreams.slice(0, 10);
    let working = 0;
    for (const s of testStreams) {
      const result = await testM3u8(s.url, s.referrer);
      console.log(`   ${result.ok ? "✅" : "❌"} ${s.title}: ${result.status || result.error}`);
      if (result.ok) working++;
    }
    console.log(`   Working: ${working}/${testStreams.length}`);
  } catch (e) {
    console.log(`   ❌ Failed: ${e.message}`);
  }

  // 3. Test iptv-org channels.json
  console.log("\n3. Fetching iptv-org.github.io/api/channels.json...");
  try {
    const chRes = await fetchWithDns("https://iptv-org.github.io/api/channels.json");
    console.log(`   Status: ${chRes.status}, Size: ${chRes.body.length} chars`);
    const channels = JSON.parse(chRes.body);
    console.log(`   Total channels: ${channels.length}`);
    
    // Count by country
    const byCountry = {};
    for (const ch of channels) {
      const c = ch.country || "Unknown";
      byCountry[c] = (byCountry[c] || 0) + 1;
    }
    const topCountries = Object.entries(byCountry).sort((a,b) => b[1]-a[1]).slice(0, 10);
    console.log("   Top countries:", topCountries.map(([c,n]) => `${c}:${n}`).join(", "));
  } catch (e) {
    console.log(`   ❌ Failed: ${e.message}`);
  }

  // 4. Test iptv-org countries.json
  console.log("\n4. Fetching iptv-org.github.io/api/countries.json...");
  try {
    const cRes = await fetchWithDns("https://iptv-org.github.io/api/countries.json");
    console.log(`   Status: ${cRes.status}, Countries: ${JSON.parse(cRes.body).length}`);
  } catch (e) {
    console.log(`   ❌ Failed: ${e.message}`);
  }

  // 5. Test categories.json
  console.log("\n5. Fetching iptv-org.github.io/api/categories.json...");
  try {
    const catRes = await fetchWithDns("https://iptv-org.github.io/api/categories.json");
    console.log(`   Status: ${catRes.status}, Categories: ${JSON.parse(catRes.body).length}`);
    const cats = JSON.parse(catRes.body);
    console.log("   Categories:", cats.map(c => c.name).join(", "));
  } catch (e) {
    console.log(`   ❌ Failed: ${e.message}`);
  }

  console.log("\n=== Done ===");
}

main().catch(console.error);
