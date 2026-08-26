import { dnsFetch } from "@/lib/dns-fix";

export const dynamic = "force-dynamic";

const PROXY_BASE = "/api/sports/embed?url=";
const ALLOWED_HOSTS = ["embed.st", "streamed.pk", "strmd.b-cdn.net"];

function isAllowedHost(hostname: string): boolean {
  return ALLOWED_HOSTS.some((h) => hostname === h || hostname.endsWith("." + h));
}

// embed.st's own session/anti-bot cookie (set on initial page load, checked
// on later calls like the /fetch endpoint) has to round-trip through us:
// the browser only ever talks to our origin, never embed.st's real one.
// Strip Domain so the cookie is stored against our proxy's host instead of
// a host the browser never actually connects to (it'd otherwise be silently
// dropped), and relay whatever the browser sends back to us on to embed.st.
function relayCookiesToClient(upstream: Response, client: Headers) {
  const setCookies = upstream.headers.getSetCookie?.() ?? [];
  for (const cookie of setCookies) {
    client.append("set-cookie", cookie.replace(/;\s*domain=[^;]*/i, ""));
  }
}

function forwardedCookieHeader(req: Request): string | undefined {
  return req.headers.get("cookie") ?? undefined;
}

function buildInterceptScript(originalUrl: string) {
  return `<script>
(function() {
  var PROXY = "${PROXY_BASE}";
  // Deliberately NOT proxying strmd.b-cdn.net (the player CDN): its player
  // bundle depends on relative-URL and dynamic import() resolution that
  // proxying breaks in ways plain fetch/XHR interception can't fix (dynamic
  // import() isn't interceptable this way at all). Loading it direct from
  // the browser worked cleanly in testing; only the top-level embed.st
  // document goes through this proxy, which is enough to route around an
  // ISP block on the primary domain.
  var HOSTS = ["embed.st", "streamed.pk"];
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
    if (!shouldProxy(url)) return url;
    try {
      var abs = new URL(url, FAKE_HREF);
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
      // Same-origin referer, not a hardcoded cross-site one — a request to
      // embed.st claiming to be referred by streamed.pk (or vice versa)
      // looks exactly like the kind of mismatch a same-origin check flags.
      referer: `${parsed.protocol}//${parsed.hostname}/`,
    };
    const forwardedCookie = forwardedCookieHeader(req);
    if (forwardedCookie) reqHeaders.cookie = forwardedCookie;

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

      html = html.replace(/(src|href)\s*=\s*"(https?:\/\/(?:www\.)?(?:embed\.st|streamed\.pk)\/[^"]*)"/gi, (match, attr, url) => {
        return `${attr}="${PROXY_BASE}${encodeURIComponent(url)}"`;
      });

      html = html.replace(/(src|href)\s*=\s*"(\/[^"]*)"/gi, (match, attr, path) => {
        // Skip paths the pass above already proxied — otherwise this
        // re-wraps them since a proxied path also starts with "/".
        if (path.startsWith(PROXY_BASE)) return match;
        return `${attr}="${PROXY_BASE}${encodeURIComponent("https://embed.st" + path)}"`;
      });

      const htmlHeaders = new Headers({ "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      relayCookiesToClient(res, htmlHeaders);
      return new Response(html, { status: 200, headers: htmlHeaders });
    }

    const body = await res.arrayBuffer();
    const binHeaders = new Headers({
      "Content-Type": contentType,
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    });
    relayCookiesToClient(res, binHeaders);
    return new Response(body, { status: 200, headers: binHeaders });
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
      referer: `${parsed.protocol}//${parsed.hostname}/`,
      origin: `${parsed.protocol}//${parsed.hostname}`,
    };
    const incomingContentType = req.headers.get("content-type");
    if (incomingContentType) reqHeaders["content-type"] = incomingContentType;
    const forwardedCookie = forwardedCookieHeader(req);
    if (forwardedCookie) reqHeaders.cookie = forwardedCookie;

    const body = await req.arrayBuffer();
    const res = await dnsFetch(embedUrl, {
      method: "POST",
      headers: reqHeaders,
      body: body.byteLength > 0 ? body : undefined,
    });

    const contentType = res.headers.get("content-type") || "application/octet-stream";
    const responseBody = await res.arrayBuffer();
    const outHeaders = new Headers({
      "Content-Type": contentType,
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    });
    relayCookiesToClient(res, outHeaders);
    return new Response(responseBody, { status: res.status, headers: outHeaders });
  } catch (e) {
    return new Response(
      `Failed to proxy embed POST: ${e instanceof Error ? e.message : "Unknown error"}`,
      { status: 502 },
    );
  }
}
