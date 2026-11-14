import { getCollection, getEntry } from "astro:content";
import { buildLlmsTxt } from "@/lib/llmsTxt.js";

// Generated at build time from the vault (same publish filter as
// [slug].astro and sitemap.xml.js), so it always matches the published pages.
export async function GET({ site }) {
  const home = await getEntry("home", "home");
  const pages = await getCollection("pages", ({ data }) => data.publish);
  return new Response(buildLlmsTxt({ site, home: home.data, pages }), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
