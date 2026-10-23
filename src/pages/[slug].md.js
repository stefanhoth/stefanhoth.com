import { getCollection } from "astro:content";
import { join } from "node:path";
import { toAgentMarkdown } from "@/lib/agentMarkdown.js";
import { markdownResponse } from "@/lib/markdownResponse.js";
import { pageSlug } from "@/lib/pagePaths.js";
import { publicAssetsBySlug } from "@/lib/publicAssets.js";

// Markdown twin of every page [slug].astro renders, same publish filter.
async function publishedPages() {
  return getCollection("pages", ({ data }) => data.publish);
}

export async function getStaticPaths() {
  return (await publishedPages()).map((page) => ({
    params: { slug: pageSlug(page) },
    props: { page },
  }));
}

export async function GET({ props, site }) {
  const { page } = props;
  const pages = new Map(
    (await publishedPages()).map((other) => [other.id, pageSlug(other)]),
  );
  return markdownResponse(
    toAgentMarkdown({
      body: page.body ?? "",
      title: page.data.title,
      description: page.data.description,
      site,
      pages,
      assets: publicAssetsBySlug(join(process.cwd(), "vault")),
    }),
  );
}
