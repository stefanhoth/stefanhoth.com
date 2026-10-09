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
// Pages reference assets in these forms:
// - `[Slides](_public-assets/talk.pdf)` / `![Alt](_public-assets/photo.jpg)` —
//   rewritten to a root-absolute URL by `rehypePublicAssetLinks`, so they also
//   resolve on folder-style pages
// - `[[talk.pdf|Slides]]` — resolved through the wikilink plugin
//   (astro.config.mjs) via `publicAssetHref`, matched by file name only
// - `![[photo.jpg]]`, `![[photo.jpg|Alt text|300]]` — Obsidian embeds, turned
//   into images by `remarkObsidianEmbeds` (a PDF embed becomes a plain link:
//   the site's CSP blocks inline PDFs)
//
// png/jpg/webp are resized and stripped of metadata on the way out (see
// `copyPublicAssets`); the originals in the vault stay untouched.

import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join, posix } from "node:path";

export const PUBLIC_ASSETS_DIR = "_public-assets";

// An allowlist, not "everything in the folder": a stray note or export
// dropped in there must not go public. SVG is deliberately absent — it can
// carry script and would be served from the site's own origin.
const ALLOWED_EXTENSION = /\.(pdf|png|jpe?g|webp|gif|avif)$/i;

// What an `![[…]]` embed renders as an <img>; the other allowed type (pdf)
// becomes a link.
const IMAGE_EXTENSION = /\.(png|jpe?g|webp|gif|avif)$/i;

// Re-encoded by sharp when published. gif/avif are copied as they are
// (animated gifs would otherwise lose their frames).
const OPTIMIZED_EXTENSION = /\.(png|jpe?g|webp)$/i;

// Widest a published image gets; smaller images are never enlarged. Wide
// enough for the 900px content column on a 1.75x display.
export const MAX_IMAGE_WIDTH = 1600;

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

// Re-encodes one image: fits it into MAX_IMAGE_WIDTH, applies the EXIF
// rotation, and drops all metadata — most importantly the GPS location phones
// embed in event photos. sharp strips metadata by default; `.rotate()` has to
// run first because the orientation tag disappears with it.
async function optimizeImage(sharp, source, target) {
  const extension = source.slice(source.lastIndexOf(".") + 1).toLowerCase();
  const image = sharp(source, { animated: extension === "webp" })
    .rotate()
    .resize({ width: MAX_IMAGE_WIDTH, withoutEnlargement: true });

  if (extension === "png") image.png({ compressionLevel: 9 });
  else if (extension === "webp") image.webp({ quality: 82 });
  else image.jpeg({ quality: 82, mozjpeg: true });

  await image.toFile(target);
}

// Publishes the allowed assets into `<outDir>/_public-assets/`, keeping their
// relative paths: pdf/gif/avif are copied byte for byte, png/jpg/webp are
// optimised (see optimizeImage). Returns the published paths.
export async function copyPublicAssets(vaultDir, outDir) {
  const assets = listPublicAssets(vaultDir);
  let sharp;
  for (const relativePath of assets) {
    const parts = relativePath.split("/");
    const source = join(vaultDir, PUBLIC_ASSETS_DIR, ...parts);
    const target = join(outDir, PUBLIC_ASSETS_DIR, ...parts);
    mkdirSync(dirname(target), { recursive: true });

    if (!OPTIMIZED_EXTENSION.test(relativePath)) {
      cpSync(source, target);
      continue;
    }
    sharp ??= (await import("sharp")).default;
    try {
      await optimizeImage(sharp, source, target);
    } catch (error) {
      throw new Error(
        `Could not process ${PUBLIC_ASSETS_DIR}/${relativePath}: ${error.message}`,
      );
    }
  }
  return assets;
}

// Rehype plugin: `[x](_public-assets/y.pdf)` (and `./_public-assets/…`) is
// vault-relative, which only resolves from the site root. Make it
// root-absolute so it works whatever URL the page itself is served under.
// Images from the folder also load lazily, so a page full of event photos
// doesn't fetch them all up front.
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
      if (
        node.tagName === "img" &&
        node.properties?.src?.startsWith(`/${PUBLIC_ASSETS_DIR}/`)
      ) {
        node.properties.loading = "lazy";
        node.properties.decoding = "async";
      }
    }
    for (const child of node.children ?? []) visit(child);
  };

  return (tree) => visit(tree);
}

// Remark plugin for Obsidian embeds. remark-wiki-link only knows `[[…]]`; the
// leading `!` makes markdown read `![[x.png]]` as a broken image, so it
// arrives as plain text. Replaces those text runs with:
// - an image, for png/jpg/webp/gif/avif — `![[photo.jpg|Alt text|300]]`, where
//   a number after `|` is the width in px (`300x200` counts as 300; the
//   height always follows the aspect ratio) and any other part is the alt
//   text, defaulting to the file name
// - a plain link, for a pdf (the CSP blocks inline PDFs)
// An embed that doesn't match a file in `_public-assets/` is left as text, so
// a typo stays visible instead of silently vanishing.
const EMBED = /!\[\[([^\]|]+)((?:\|[^\]|]*)*)\]\]/g;
const SIZE = /^(\d+)(?:x\d+)?$/;

export function remarkObsidianEmbeds({ assets }) {
  const toNode = (target, options) => {
    const name = posix.basename(target.trim());
    const relativePath = assets.get(assetSlug(name));
    if (!relativePath) return null;

    const parts = options
      .split("|")
      .slice(1)
      .map((part) => part.trim())
      .filter(Boolean);
    const width = parts.map((part) => SIZE.exec(part)?.[1]).find(Boolean);
    const label = parts.find((part) => !SIZE.test(part));
    const url = publicAssetHref(relativePath);

    if (!IMAGE_EXTENSION.test(relativePath)) {
      return {
        type: "link",
        url,
        children: [{ type: "text", value: label ?? name }],
      };
    }
    return {
      type: "image",
      url,
      alt: label ?? name.replace(/\.[^.]+$/, ""),
      title: null,
      data: width ? { hProperties: { width } } : undefined,
    };
  };

  const replaceIn = (parent) => {
    parent.children = parent.children.flatMap((child) => {
      if (child.children) replaceIn(child);
      if (child.type !== "text" || !child.value.includes("![[")) return [child];

      const nodes = [];
      let last = 0;
      for (const match of child.value.matchAll(EMBED)) {
        const node = toNode(match[1], match[2]);
        if (!node) continue;
        if (match.index > last) {
          nodes.push({
            type: "text",
            value: child.value.slice(last, match.index),
          });
        }
        nodes.push(node);
        last = match.index + match[0].length;
      }
      if (nodes.length === 0) return [child];
      if (last < child.value.length) {
        nodes.push({ type: "text", value: child.value.slice(last) });
      }
      return nodes;
    });
  };

  return (tree) => replaceIn(tree);
}
