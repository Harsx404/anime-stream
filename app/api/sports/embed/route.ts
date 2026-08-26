import { dnsFetch } from "@/lib/dns-fix";

export const dynamic = "force-dynamic";

const PROXY_BASE = "/api/sports/embed?url=";
const CDN_PROXY_BASE = "/api/sports/cdn/";
const ALLOWED_HOSTS = ["embed.st", "streamed.pk", "strmd.b-cdn.net"];

function isAllowedHost(hostname: string): boolean {
  return ALLOWED_HOSTS.some((h) => hostname === h || hostname.endsWith("." + h));
}

function buildInterceptScript(originalUrl: string) {
  return `<script>
(function() {
  var PROXY = "${PROXY_BASE}";
  var CDN_PROXY = "${CDN_PROXY_BASE}";
  var HOSTS = ["embed.st", "streamed.pk", "strmd.b-cdn.net"];
  var ORIG_URL = "${originalUrl}";
  var origParsed = new URL(ORIG_URL);
  var FAKE_ORIGIN = origParsed.origin;
  var FAKE_HREF = ORIG_URL;
  var FAKE_HOST = origParsed.host;
  var FAKE_PATHNAME = origParsed.pathname;
  var FAKE_SEARCH = origParsed.search;

  // Override location properties so the player JS thinks it's on embed.st
  try { Object.defineProperty(window.location, 'origin', { get: function() { return FAKE_ORIGIN; }, configurable: true }); } catch(e) {}
  try { Object.defineProperty(window.location, 'host', { get: function() { return FAKE_HOST; }, configurable: true }); } catch(e) {}
  try { Object.defineProperty(window.location, 'hostname', { get: function() { return origParsed.hostname; }, configurable: true }); } catch(e) {}
  try { Object.defineProperty(window.location, 'href', { get: function() { return FAKE_HREF; }, configurable: true }); } catch(e) {}
  try { Object.defineProperty(window.location, 'pathname', { get: function() { return FAKE_PATHNAME; }, configurable: true }); } catch(e) {}
  try { Object.defineProperty(window.location, 'search', { get: function() { return FAKE_SEARCH; }, configurable: true }); } catch(e) {}
  try { Object.defineProperty(window.location, 'protocol', { get: function() { return origParsed.protocol; }, configurable: true }); } catch(e) {}

  function shouldProxy(url) {
    try {
      var u = new URL(url, FAKE_HREF);
      return HOSTS.some(function(h) { return u.hostname === h || u.hostname.endsWith("." + h); });
    } catch(e) { return false; }
  }

  function proxyUrl(url) {
    if (!url) return url;
    if (url.indexOf(PROXY) === 0) return url;
    if (url.indexOf(CDN_PROXY) === 0) return url;
    // Some player scripts build absolute URLs by combining location.origin
    // (which we spoof to embed.st for anti-embed checks) with a real path
    // computed from their own script's true, already-proxied location. That
    // produces a fake host with a real path pointing at our own proxy routes
    // (e.g. https://embed.st/api/sports/cdn/...). Catch that before treating
    // it as a genuine embed.st/streamed.pk URL: strip the fake origin and
    // let it resolve same-origin, which is what it actually meant.
    try {
      var earlyCheck = new URL(url, FAKE_HREF);
      if (earlyCheck.pathname.indexOf("/api/sports/") === 0) {
        return earlyCheck.pathname + earlyCheck.search;
      }
    } catch(e) {}
    if (!shouldProxy(url)) return url;
    try {
      var abs = new URL(url, FAKE_HREF);
      // strmd.b-cdn.net serves the player bundle, which resolves its own
      // sub-resources relative to its own script URL. Mirror its path
      // structure (instead of collapsing into a query param) so those
      // relative fetches keep resolving correctly.
      if (abs.hostname === "strmd.b-cdn.net" || abs.hostname.endsWith(".strmd.b-cdn.net")) {
        return CDN_PROXY + abs.pathname.replace(/^\\//, "") + abs.search;
      }
      return PROXY + encodeURIComponent(abs.href);
    } catch(e) { return url; }
  }

  var origFetch = window.fetch;
  window.fetch = function(input, init) {
    try {
      var url = typeof input === "string" ? input : (input && input.url) ? input.url : String(input);
      var proxied = proxyUrl(url);
      if (proxied !== url) {
        if (typeof input === "string") input = proxied;
        else if (input && input.url) input = new Request(proxied, input);
        else input = proxied;
      }
    } catch(e) {}
    return origFetch.call(this, input, init);
  };

  var origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url) {
    arguments[1] = proxyUrl(url);
    return origOpen.apply(this, arguments);
  };

  var origCreate = document.createElement;
  document.createElement = function(tag) {
    var el = origCreate.call(document, tag);
    var tl = tag.toLowerCase();
    if (tl === "script" || tl === "img" || tl === "link" || tl === "iframe" || tl === "source") {
      var origSetAttr = el.setAttribute;
      el.setAttribute = function(name, value) {
        if (name === "src" || name === "href") value = proxyUrl(value);
        return origSetAttr.call(this, name, value);
      };
      var origSrcDesc = Object.getOwnPropertyDescriptor(el.__proto__, "src");
      if (origSrcDesc && origSrcDesc.set) {
        Object.defineProperty(el, "src", {
          get: origSrcDesc.get,
          set: function(v) { origSrcDesc.set.call(this, proxyUrl(v)); },
          configurable: true,
        });
      }
    }
    return el;
  };
})();
</script>`;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const embedUrl = searchParams.get("url");

  if (!embedUrl) {
    return new Response("Missing url param", { status: 400 });
  }

  try {
    const parsed = new URL(embedUrl);
    if (!isAllowedHost(parsed.hostname)) {
      return new Response("Host not allowed: " + parsed.hostname, { status: 403 });
    }

    const isHtml = parsed.pathname.endsWith(".html") || !parsed.pathname.includes(".") || parsed.pathname.endsWith("/");
    const isJs = parsed.pathname.endsWith(".js");
    const isCss = parsed.pathname.endsWith(".css");

    const reqHeaders: Record<string, string> = {
      accept: isHtml ? "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" : "*/*",
      "accept-language": "en-US,en;q=0.9",
      referer: "https://streamed.pk/",
    };

    const res = await dnsFetch(embedUrl, { headers: reqHeaders });
    const contentType = res.headers.get("content-type") || (isHtml ? "text/html" : isJs ? "application/javascript" : isCss ? "text/css" : "application/octet-stream");

    if (isHtml && contentType.includes("text/html")) {
      let html = await res.text();

      if (html.includes("<head")) {
        const script = buildInterceptScript(embedUrl);
        html = html.replace(/<head([^>]*)>/i, `<head$1>${script}`);
      } else if (html.includes("<html")) {
        const script2 = buildInterceptScript(embedUrl);
        html = html.replace(/<html([^>]*)>/i, `<html$1><head>${script2}</head>`);
      } else {
        html = buildInterceptScript(embedUrl) + html;
      }

      // strmd.b-cdn.net -> path-based proxy, so relative sub-resource fetches
      // inside the player bundle (e.g. wasm/lock.js) keep resolving correctly.
      html = html.replace(/(src|href)\s*=\s*"https?:\/\/(?:www\.)?strmd\.b-cdn\.net(\/[^"]*)"/gi, (match, attr, path) => {
        return `${attr}="${CDN_PROXY_BASE}${path.replace(/^\//, "")}"`;
      });

      html = html.replace(/(src|href)\s*=\s*"(https?:\/\/(?:www\.)?(?:embed\.st|streamed\.pk)\/[^"]*)"/gi, (match, attr, url) => {
        return `${attr}="${PROXY_BASE}${encodeURIComponent(url)}"`;
      });

      html = html.replace(/(src|href)\s*=\s*"(\/[^"]*)"/gi, (match, attr, path) => {
        // Skip paths the passes above already proxied — otherwise this
        // re-wraps them since a proxied path also starts with "/".
        if (path.startsWith(PROXY_BASE) || path.startsWith(CDN_PROXY_BASE)) return match;
        return `${attr}="${PROXY_BASE}${encodeURIComponent("https://embed.st" + path)}"`;
      });

      return new Response(html, {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
      });
    }

    const body = await res.arrayBuffer();
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (e) {
    return new Response(
      `Failed to load embed: ${e instanceof Error ? e.message : "Unknown error"}`,
      { status: 502 },
    );
  }
}

// The intercept script rewrites same-origin fetch()/XHR calls onto this
// proxy but preserves the original method, so player JS that POSTs (e.g.
// a heartbeat/token endpoint like embed.st/fetch) needs this too — GET-only
// meant every such call 405'd.
export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const embedUrl = searchParams.get("url");

  if (!embedUrl) {
    return new Response("Missing url param", { status: 400 });
  }

  try {
    const parsed = new URL(embedUrl);
    if (!isAllowedHost(parsed.hostname)) {
      return new Response("Host not allowed: " + parsed.hostname, { status: 403 });
    }

    const reqHeaders: Record<string, string> = {
      accept: "*/*",
      "accept-language": "en-US,en;q=0.9",
      referer: "https://streamed.pk/",
    };
    const incomingContentType = req.headers.get("content-type");
    if (incomingContentType) reqHeaders["content-type"] = incomingContentType;

    const body = await req.arrayBuffer();
    const res = await dnsFetch(embedUrl, {
      method: "POST",
      headers: reqHeaders,
      body: body.byteLength > 0 ? body : undefined,
    });

    const contentType = res.headers.get("content-type") || "application/octet-stream";
    const responseBody = await res.arrayBuffer();
    return new Response(responseBody, {
      status: res.status,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (e) {
    return new Response(
      `Failed to proxy embed POST: ${e instanceof Error ? e.message : "Unknown error"}`,
      { status: 502 },
    );
  }
}
