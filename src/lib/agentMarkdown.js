// Markdown twin of a published page, served at `/<slug>.md` for agents and
// anyone else who asks for `text/markdown` (see worker/index.js).
//
// The vault body is already Markdown, but it is Obsidian flavoured: wikilinks
// (`[[page|label]]`), embeds (`![[photo.jpg|alt|300]]`) and vault-relative
// asset links only make sense inside the vault. This turns them into plain
// Markdown with absolute URLs, so the document stands on its own.

import { posix } from "node:path";
import { HOME_SLUG, markdownPath } from "./pagePaths.js";
import {
  assetSlug,
  EMBED,
  IMAGE_EXTENSION,
  publicAssetHref,
  SIZE,
} from "./publicAssets.js";

const WIKILINK = /(?<!!)\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]*))?\]\]/g;
const RELATIVE_ASSET = /\]\((?:\.\/)?(_public-assets\/)/g;
const OBSIDIAN_COMMENT = /%%[\s\S]*?%%/g;
const FENCE = /^\s*(```|~~~)/;
const H1 = /^# /m;

function pageKey(name) {
  return name.trim().toLowerCase().replace(/\s+/g, "-");
}

// `pages` maps a filename slug (the key wikilinks resolve by) to the slug the
// page is published under. `assets` is publicAssetsBySlug().
function makeTransform({ site, pages, assets }) {
  const absolute = (path) => new URL(path, site).href;

  const embed = (match, target, options) => {
    const name = posix.basename(target.trim());
    const relativePath = assets.get(assetSlug(name));
    if (!relativePath) return match;

    const parts = options
      .split("|")
      .slice(1)
      .map((part) => part.trim())
      .filter(Boolean);
    const label = parts.find((part) => !SIZE.test(part));
    const url = absolute(publicAssetHref(relativePath));

    if (!IMAGE_EXTENSION.test(relativePath)) {
      return `[${label ?? name}](${url})`;
    }
    return `![${label ?? name.replace(/\.[^.]+$/, "")}](${url})`;
  };

  const wikilink = (_match, target, alias) => {
    const label = (alias ?? target).trim();
    const name = target.trim();

    const assetPath = assets.get(assetSlug(posix.basename(name)));
    if (assetPath) return `[${label}](${absolute(publicAssetHref(assetPath))})`;

    const key = pageKey(name);
    if (key === "home")
      return `[${label}](${absolute(markdownPath(HOME_SLUG))})`;
    const slug = pages.get(key);
    // Unpublished or unknown target: keep the text, drop the dead link.
    return slug ? `[${label}](${absolute(markdownPath(slug))})` : label;
  };

  return (text) =>
    text
      .replace(OBSIDIAN_COMMENT, "")
      .replace(EMBED, embed)
      .replace(WIKILINK, wikilink)
      .replace(
        RELATIVE_ASSET,
        (_match, folder) => `](${absolute(`/${folder}`)}`,
      );
}

// Applies `transform` to everything outside fenced code blocks.
function outsideFences(body, transform) {
  const out = [];
  let chunk = [];
  let inFence = false;
  const flush = () => {
    if (chunk.length > 0) {
      out.push(inFence ? chunk.join("\n") : transform(chunk.join("\n")));
    }
    chunk = [];
  };
  for (const line of body.split("\n")) {
    if (FENCE.test(line)) {
      if (!inFence) flush();
      chunk.push(line);
      if (inFence) flush();
      inFence = !inFence;
      continue;
    }
    chunk.push(line);
  }
  flush();
  return out.join("\n");
}

// `lead` is optional extra text (a tagline, say) for pages whose body has no
// heading of its own: it follows the generated `# title`.
export function toAgentMarkdown({
  body,
  title,
  description,
  lead = [],
  site,
  pages,
  assets,
}) {
  const content = outsideFences(
    body.replace(/\r\n/g, "\n"),
    makeTransform({ site, pages, assets }),
  ).trim();

  const parts = [];
  if (!H1.test(content)) {
    parts.push(`# ${title}`);
    if (description) parts.push(`> ${description}`);
    parts.push(...lead);
  }
  parts.push(content);
  return `${parts.join("\n\n")}\n`;
}
