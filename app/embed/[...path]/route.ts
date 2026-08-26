import { dnsFetch } from "@/lib/dns-fix";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const ALLOWED_HOSTS = ["embed.st", "streamed.pk", "strmd.b-cdn.net"];
const PROXY_BASE = "/api/sports/embed?url=";

function isAllowedHost(hostname: string): boolean {
  return ALLOWED_HOSTS.some((h) => hostname === h || hostname.endsWith("." + h));
}

// embed.st's own session/anti-bot cookie (set on this initial page load,
// checked later e.g. on the /fetch endpoint) has to round-trip through us:
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
  var FAKE_HREF = "${originalUrl}";
  var origParsed = new URL(FAKE_HREF);

  function shouldProxy(url) {
    try {
      var u = new URL(url, FAKE_HREF);
      // Proxy requests to embed.st or streamed.pk
      if (HOSTS.some(function(h) { return u.hostname === h || u.hostname.endsWith("." + h); })) return true;
      // Also proxy same-origin API calls (location.origin resolves to localhost:3000)
      // The player builds URLs like location.origin + "/api/..." which go to localhost
      if (u.origin === location.origin && u.pathname.indexOf("/api/") === 0) return true;
      return false;
    } catch(e) { return false; }
  }

  function proxyUrl(url) {
    if (!url) return url;
    if (url.indexOf(PROXY) === 0) return url;
    if (!shouldProxy(url)) return url;
    try {
      var u = new URL(url, FAKE_HREF);
      // If it's a same-origin API call, rewrite to embed.st
      if (u.origin === location.origin && u.pathname.indexOf("/api/") === 0) {
        var target = origParsed.origin + u.pathname + u.search;
        return PROXY + encodeURIComponent(target);
      }
      return PROXY + encodeURIComponent(u.href);
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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const pathStr = path.join("/");
  const targetUrl = `https://embed.st/embed/${pathStr}${req.nextUrl.search}`;

  try {
    const parsed = new URL(targetUrl);
    if (!isAllowedHost(parsed.hostname)) {
      return new Response("Host not allowed: " + parsed.hostname, { status: 403 });
    }

    const isHtml =
      parsed.pathname.endsWith(".html") ||
      !parsed.pathname.includes(".") ||
      parsed.pathname.endsWith("/");
    const isJs = parsed.pathname.endsWith(".js");
    const isCss = parsed.pathname.endsWith(".css");

    const reqHeaders: Record<string, string> = {
      accept: isHtml
        ? "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        : "*/*",
      "accept-language": "en-US,en;q=0.9",
      referer: "https://streamed.pk/",
    };
    const forwardedCookie = forwardedCookieHeader(req);
    if (forwardedCookie) reqHeaders.cookie = forwardedCookie;

    const res = await dnsFetch(targetUrl, { headers: reqHeaders });
    const contentType =
      res.headers.get("content-type") ||
      (isHtml
        ? "text/html"
        : isJs
          ? "application/javascript"
          : isCss
            ? "text/css"
            : "application/octet-stream");

    if (isHtml && contentType.includes("text/html")) {
      let html = await res.text();

      // Rewrite absolute URLs to embed.st/streamed.pk through the query-param proxy
      html = html.replace(
        /(src|href)\s*=\s*"(https?:\/\/(?:www\.)?(?:embed\.st|streamed\.pk)\/[^"]*)"/gi,
        (match, attr, url) => `${attr}="${PROXY_BASE}${encodeURIComponent(url)}"`,
      );

      // Rewrite relative paths through the query-param proxy. Skip paths the
      // pass above already proxied — otherwise this re-wraps them since a
      // proxied path also starts with "/".
      html = html.replace(
        /(src|href)\s*=\s*"(\/[^"]*)"/gi,
        (match, attr, p) => {
          if (p.startsWith(PROXY_BASE)) return match;
          return `${attr}="${PROXY_BASE}${encodeURIComponent("https://embed.st" + p)}"`;
        },
      );

      // Inject intercept script AFTER URL rewriting so it doesn't get corrupted
      const script = buildInterceptScript(targetUrl);
      if (html.includes("<head")) {
        html = html.replace(/<head([^>]*)>/i, `<head$1>${script}`);
      } else if (html.includes("<html")) {
        html = html.replace(/<html([^>]*)>/i, `<html$1><head>${script}</head>`);
      } else {
        html = script + html;
      }

      const htmlHeaders = new Headers({
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      });
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
