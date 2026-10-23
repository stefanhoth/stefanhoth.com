import { getCollection } from "astro:content";
import { buildSitemap, canonicalPathFor } from "@/lib/sitemap.js";

// Generated at build time from the same publish filter as [slug].astro, so
// publishing or unpublishing a vault page updates the sitemap automatically.
export async function GET({ site }) {
  const pages = await getCollection("pages", ({ data }) => data.publish);
  const paths = ["/", ...pages.map(canonicalPathFor)];
  return new Response(buildSitemap(site, paths), {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
