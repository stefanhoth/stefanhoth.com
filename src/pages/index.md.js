import { getCollection, getEntry } from "astro:content";
import { join } from "node:path";
import { toAgentMarkdown } from "@/lib/agentMarkdown.js";
import { markdownResponse } from "@/lib/markdownResponse.js";
import { pageSlug } from "@/lib/pagePaths.js";
import { publicAssetsBySlug } from "@/lib/publicAssets.js";

// Markdown twin of the homepage (index.astro), served at /index.md.
export async function GET({ site }) {
  const home = await getEntry("home", "home");
  const published = await getCollection("pages", ({ data }) => data.publish);
  const { title, description, tagline, jobhunt } = home.data;
  return markdownResponse(
    toAgentMarkdown({
      body: home.body ?? "",
      title,
      description,
      lead: [tagline, jobhunt].filter(Boolean),
      site,
      pages: new Map(published.map((page) => [page.id, pageSlug(page)])),
      assets: publicAssetsBySlug(join(process.cwd(), "vault")),
    }),
  );
}
