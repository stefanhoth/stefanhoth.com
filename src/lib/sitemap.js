// Canonical URL path of a published vault page — mirrors the canonicalPath
// logic in src/pages/[slug].astro: file-style permalinks (`.md` suffix) keep
// the suffix, everything else gets the folder-style trailing-slash URL.
export function canonicalPathFor(page) {
  const { permalink } = page.data;
  if (permalink?.endsWith(".md")) return `/${permalink}`;
  return `/${permalink ?? page.id}/`;
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
