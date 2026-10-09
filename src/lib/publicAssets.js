// Publishing for `vault/_public-assets/` — files (talk PDFs, images) that
// live in the Obsidian vault but are meant to be downloadable from the site.
//
// The vault sync mirrors the whole vault into `vault/`, but only root-level
// `*.md` files become pages, so nothing else is published on its own. This
// module is the opt-in: everything in `_public-assets/` with an allowed
// extension is copied to `dist/_public-assets/` at build time and served at
// `/_public-assets/<path>` — the same path it has inside the vault, so a
// vault-relative markdown link works both in Obsidian and on the site.
//
// Pages link to assets in either form:
// - `[Slides](_public-assets/talk.pdf)` — rewritten to a root-absolute URL by
//   `rehypePublicAssetLinks`, so it also resolves on folder-style pages
// - `[[talk.pdf|Slides]]` — resolved through the wikilink plugin
//   (astro.config.mjs) via `publicAssetHref`, matched by file name only

import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join, posix } from "node:path";

export const PUBLIC_ASSETS_DIR = "_public-assets";

// An allowlist, not "everything in the folder": a stray note or export
// dropped in there must not go public. SVG is deliberately absent — it can
// carry script and would be served from the site's own origin.
const ALLOWED_EXTENSION = /\.(pdf|png|jpe?g|webp)$/i;

// Same normalisation the wikilink resolver applies to page names
// (astro.config.mjs), so `[[My Talk.pdf]]` finds `my-talk.pdf` and vice versa.
export function assetSlug(name) {
  return name.trim().toLowerCase().replace(/\s+/g, "-");
}

// Vault-relative POSIX paths of every publishable asset, e.g.
// `["talks/starlog.pdf", "migration.pdf"]`. Dot-files and dot-folders are
// skipped, and a missing folder is simply "no assets".
export function listPublicAssets(vaultDir) {
  const root = join(vaultDir, PUBLIC_ASSETS_DIR);
  if (!existsSync(root)) return [];

  const found = [];
  const walk = (dir, prefix) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const relative = posix.join(prefix, entry.name);
      if (entry.isDirectory()) walk(join(dir, entry.name), relative);
      else if (entry.isFile() && ALLOWED_EXTENSION.test(entry.name)) {
        found.push(relative);
      }
    }
  };
  walk(root, "");
  return found.sort();
}

export function publicAssetHref(relativePath) {
  const encoded = relativePath.split("/").map(encodeURIComponent).join("/");
  return `/${PUBLIC_ASSETS_DIR}/${encoded}`;
}

// File-name slug -> vault-relative path, for wikilink resolution. When two
// files in different sub-folders share a name, the first (alphabetical path)
// wins — keep names unique across the folder.
export function publicAssetsBySlug(vaultDir) {
  const bySlug = new Map();
  for (const relativePath of listPublicAssets(vaultDir)) {
    const slug = assetSlug(posix.basename(relativePath));
    if (!bySlug.has(slug)) bySlug.set(slug, relativePath);
  }
  return bySlug;
}

// Copies the allowed assets into `<outDir>/_public-assets/`, keeping their
// relative paths. Returns the copied paths.
export function copyPublicAssets(vaultDir, outDir) {
  const assets = listPublicAssets(vaultDir);
  for (const relativePath of assets) {
    const parts = relativePath.split("/");
    const target = join(outDir, PUBLIC_ASSETS_DIR, ...parts);
    mkdirSync(join(target, ".."), { recursive: true });
    cpSync(join(vaultDir, PUBLIC_ASSETS_DIR, ...parts), target);
  }
  return assets;
}

// Rehype plugin: `[x](_public-assets/y.pdf)` (and `./_public-assets/…`) is
// vault-relative, which only resolves from the site root. Make it
// root-absolute so it works whatever URL the page itself is served under.
export function rehypePublicAssetLinks() {
  const relative = new RegExp(`^(?:\\./)?${PUBLIC_ASSETS_DIR}/`);

  const visit = (node) => {
    if (node.type === "element") {
      for (const prop of ["href", "src"]) {
        const value = node.properties?.[prop];
        if (typeof value === "string" && relative.test(value)) {
          node.properties[prop] = value.replace(
            relative,
            `/${PUBLIC_ASSETS_DIR}/`,
          );
        }
      }
    }
    for (const child of node.children ?? []) visit(child);
  };

  return (tree) => visit(tree);
}
