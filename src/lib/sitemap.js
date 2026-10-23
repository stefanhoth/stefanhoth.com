import { htmlPath, pageSlug } from "./pagePaths.js";

// Canonical URL path of a published vault page: the HTML representation
// (the Markdown twin at `/<slug>.md` is an alternate, not a sitemap entry).
export function canonicalPathFor(page) {
  return htmlPath(pageSlug(page));
}

function escapeXml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Sitemaps protocol: https://www.sitemaps.org/protocol.html
export function buildSitemap(site, paths) {
  const urls = paths
    .map(
      (path) =>
        `  <url><loc>${escapeXml(new URL(path, site).href)}</loc></url>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}
