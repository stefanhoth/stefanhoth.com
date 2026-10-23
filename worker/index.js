import { onRequestPost } from "../functions/contact.js";
import { preferredFormat } from "./negotiation.js";

// Requests that match a static asset are served by Cloudflare's asset layer
// without invoking this Worker — those get their headers from public/_headers.
// Keep the two header sets in sync. This set covers Worker-handled responses
// (POST /contact) and any request that falls through to the Worker.
const SECURITY_HEADERS = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  // "0" disables the legacy XSS auditor, which is deprecated and can itself
  // be abused for cross-site leaks in older browsers. CSP is the real defense.
  "X-XSS-Protection": "0",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy":
    "geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
  // script-src has no 'unsafe-inline': Astro is configured (assetsInlineLimit: 0)
  // to emit all scripts as external files. style-src keeps 'unsafe-inline' for
  // Astro's inlined stylesheets and the Turnstile widget's style attributes.
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; frame-src https://challenges.cloudflare.com; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'",
};

function withSecurityHeaders(response) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(name, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// Every published page has two representations under two URLs:
//   HTML      /<slug>    (homepage: /)
//   Markdown  /<slug>.md (homepage: /index.md)
// The URL and the delivered content must always agree. When the request's
// Accept header ranks the other representation higher (browsers rank
// text/html, agents rank text/markdown), the client is redirected to that
// representation's URL instead of getting mismatched content under this one.
// Without a preference (`*/*`, no Accept header) the URL decides.
//
// The slug list is generated at build time into /_pages.json (see
// astro.config.mjs) because this Worker is bundled from a plain checkout
// without access to build-generated modules.
const HOME_SLUG = "index";
const MARKDOWN_TYPE = "text/markdown; charset=utf-8";

let pageSlugsPromise;

function loadPageSlugs(url, env) {
  pageSlugsPromise ??= env.ASSETS.fetch(new URL("/_pages.json", url))
    .then((response) => (response.ok ? response.json() : []))
    .then((slugs) => new Set(slugs))
    .catch(() => {
      // Don't cache a transient failure for the isolate's lifetime.
      pageSlugsPromise = undefined;
      return new Set();
    });
  return pageSlugsPromise;
}

function pathFor(slug, format) {
  if (format === "markdown") return `/${slug}.md`;
  return slug === HOME_SLUG ? "/" : `/${slug}`;
}

// Which page and representation a pathname addresses, or null if it is not
// a page URL. `/<slug>/` counts as HTML too (it is redirected to `/<slug>`).
function matchPage(pathname, slugs) {
  if (pathname === "/") return { slug: HOME_SLUG, format: "html" };
  if (pathname.endsWith(".md")) {
    const slug = pathname.slice(1, -3);
    return slugs.has(slug) ? { slug, format: "markdown" } : null;
  }
  const slug = pathname.replace(/^\/|\/$/g, "");
  return slug !== HOME_SLUG && slugs.has(slug)
    ? { slug, format: "html" }
    : null;
}

async function servePage(request, url, env) {
  if (request.method !== "GET" && request.method !== "HEAD") return null;

  const match = matchPage(url.pathname, await loadPageSlugs(url, env));
  if (!match) return null;

  const { slug, format } = match;
  const wanted = preferredFormat(request.headers.get("Accept")) ?? format;
  const destination = pathFor(slug, wanted);
  const vary = { Vary: "Accept" };

  if (url.pathname !== destination) {
    // Switching representation depends on the Accept header, so it must not
    // be cached or remembered as permanent; fixing only the URL's shape
    // (`/projects/` -> `/projects`) is.
    const status = wanted === format ? 301 : 307;
    return new Response(null, {
      status,
      headers: { Location: destination + url.search, ...vary },
    });
  }

  if (format === "html") {
    const response = await env.ASSETS.fetch(request);
    return withHeaders(response, {
      ...vary,
      Link: `<${pathFor(slug, "markdown")}>; rel="alternate"; type="text/markdown"`,
    });
  }

  const response = await env.ASSETS.fetch(request);
  if (!response.ok && response.status !== 304) return response;
  return withHeaders(response, {
    ...vary,
    "Content-Type": MARKDOWN_TYPE,
    Link: `<${pathFor(slug, "html")}>; rel="canonical"; type="text/html"`,
  });
}

function withHeaders(response, extra) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(extra)) headers.set(name, value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// Build internals that must not be reachable as pages of their own.
const INTERNAL_PATHS = new Set(["/_pages.json"]);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/contact") {
      return withSecurityHeaders(await onRequestPost({ request, env }));
    }

    if (INTERNAL_PATHS.has(url.pathname)) {
      return withSecurityHeaders(new Response("Not found", { status: 404 }));
    }

    const pageResponse = await servePage(request, url, env);
    if (pageResponse) {
      return withSecurityHeaders(pageResponse);
    }

    return withSecurityHeaders(await env.ASSETS.fetch(request));
  },
};
