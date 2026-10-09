import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { unified } from "@astrojs/markdown-remark";
import mdx from "@astrojs/mdx";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import wikiLink from "remark-wiki-link";
import {
  copyPublicAssets,
  publicAssetHref,
  publicAssetsBySlug,
  rehypePublicAssetLinks,
  remarkObsidianEmbeds,
} from "./src/lib/publicAssets.js";
import rehypeProjectCards from "./src/lib/rehypeProjectCards.js";

// Vault files are the source of truth for what gets published and under
// which URL. The filename provides the default slug; an optional
// `permalink` frontmatter field overrides it. A permalink ending in `.md`
// makes the page a "file-style" URL: the Worker serves it at /<slug>.md
// and redirects the bare/trailing-slash forms there (see worker/index.js).
//
// Frontmatter is read with a small regex parser instead of a YAML library
// because only two scalar fields are needed and the vault is synced from
// Obsidian, which writes plain `key: value` lines.
function parseVaultPage(filename) {
  const raw = readFileSync(
    new URL(`./vault/${filename}`, import.meta.url),
    "utf8",
  );
  const frontmatter = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? "";
  return {
    slug: filename
      .replace(/\.md$/, "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-"),
    permalink: frontmatter.match(
      /^permalink:\s*["']?([^\s"']+)["']?\s*$/m,
    )?.[1],
    publish: /^publish:\s*true\s*$/m.test(frontmatter),
  };
}

const vaultPages = readdirSync(new URL("./vault", import.meta.url))
  .filter((name) => name.endsWith(".md"))
  .map(parseVaultPage);

const vaultPagesBySlug = new Map(vaultPages.map((page) => [page.slug, page]));

// Files in vault/_public-assets/ (talk PDFs, images) are published as
// downloads — see src/lib/publicAssets.js. Wikilinks to them (`[[talk.pdf]]`)
// resolve by file name.
const vaultDir = fileURLToPath(new URL("./vault", import.meta.url));
const publicAssets = publicAssetsBySlug(vaultDir);

// Copies the public assets into the build output so the Worker's ASSETS
// binding serves them at /_public-assets/<path>.
function publicAssetsCopy() {
  return {
    name: "public-assets-copy",
    hooks: {
      "astro:build:done": async ({ dir, logger }) => {
        const copied = await copyPublicAssets(vaultDir, fileURLToPath(dir));
        if (copied.length > 0) {
          logger.info(`Published ${copied.length} public asset(s)`);
        }
      },
    },
  };
}

// Emits the list of file-style page slugs into the build output so the
// Worker can read it at runtime via the ASSETS binding — the Worker bundle
// itself is built from a plain checkout (see preview-deploy.yml), so it
// can't import build-generated modules.
function fileStyleManifest() {
  return {
    name: "file-style-manifest",
    hooks: {
      "astro:build:done": ({ dir }) => {
        const slugs = vaultPages
          .filter((page) => page.publish && page.permalink?.endsWith(".md"))
          .map((page) => page.permalink.replace(/\.md$/, ""));
        writeFileSync(
          new URL("_file-style-pages.json", dir),
          JSON.stringify(slugs),
        );
      },
    },
  };
}

// https://astro.build/config
export default defineConfig({
  integrations: [mdx(), fileStyleManifest(), publicAssetsCopy()],
  output: "static",
  site: "https://stefanhoth.com",
  base: "/",

  markdown: {
    processor: unified({
      remarkPlugins: [
        [
          wikiLink,
          {
            aliasDivider: "|",
            pathFormat: "obsidian-short",
            // Resolved wikilinks point at the page's publish URL (its
            // permalink if set, else the filename slug); unresolved ones
            // keep the slugified name and get marked "new".
            hrefTemplate: (slug) =>
              publicAssets.has(slug)
                ? publicAssetHref(publicAssets.get(slug))
                : `/${vaultPagesBySlug.get(slug)?.permalink ?? slug}`,
            permalinks: [
              ...vaultPages.map((page) => page.slug),
              ...publicAssets.keys(),
            ],
            pageResolver: (name) => [
              name.trim().toLowerCase().replace(/\s+/g, "-"),
            ],
          },
        ],
        [remarkObsidianEmbeds, { assets: publicAssets }],
      ],
      rehypePlugins: [rehypeProjectCards, rehypePublicAssetLinks],
    }),
  },

  vite: {
    plugins: [tailwindcss()],
    build: {
      // Never inline scripts into the HTML — the Worker's CSP has no
      // 'unsafe-inline' in script-src, so all scripts must be external files.
      assetsInlineLimit: 0,
    },
  },
});
