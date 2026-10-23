// Generates the 1200×630 Open Graph preview images in public/img/og/
// (one per published vault page, plus home.png for the front page and
// default.png as the fallback Layout.astro uses for pages without one).
//
// The cards are rendered from vault frontmatter (title/description), and
// the vault sync workflow (.github/workflows/sync-vault.yml) is the only
// thing that changes that frontmatter — it regenerates the cards and
// commits them alongside the synced content. Output is deterministic, so
// an unchanged vault produces byte-identical files and no commit churn.
// Cards of pages that are no longer published are removed.
// Run manually after changing the card design or profile photo:
//
//   npm run og:images
//
// Rendering: sharp composites an SVG (background wash + text, mirroring
// the site's palette in src/layouts/Layout.astro) with the brush-stroke
// profile cutout from src/assets/profile.png.
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import sharp from "sharp";

const WIDTH = 1200;
const HEIGHT = 630;
const OUT_DIR = new URL("../public/img/og/", import.meta.url);
const VAULT_DIR = new URL("../vault/", import.meta.url);
const PROFILE = new URL("../src/assets/profile.png", import.meta.url);

// Same minimal frontmatter parsing approach as astro.config.mjs — the
// vault is synced from Obsidian, which writes plain `key: value` lines.
function parseVaultPage(filename) {
  const raw = readFileSync(new URL(filename, VAULT_DIR), "utf8");
  const frontmatter = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? "";
  const field = (name) =>
    frontmatter
      .match(new RegExp(`^${name}:\\s*(.+?)\\s*$`, "m"))?.[1]
      ?.replace(/^["']|["']$/g, "");
  return {
    slug: (field("permalink") ?? filename)
      .replace(/\.md$/, "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-"),
    title: field("title"),
    description: field("description"),
    publish: /^publish:\s*true\s*$/m.test(frontmatter),
    isHome: filename === "home.md",
  };
}

function escapeXml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// Estimated pixel width of a string in DejaVu Sans (the font librsvg
// resolves `sans-serif` to). Per-character classes instead of one average,
// deliberately erring wide, so all-caps words like "README" don't overflow.
function estimateWidth(text, fontSize) {
  let em = 0;
  for (const char of text) {
    if (/[mwMW]/.test(char)) em += 1.0;
    else if (/[A-Z0-9]/.test(char)) em += 0.85;
    else if (/[ijltf.,;:!'|]/.test(char)) em += 0.35;
    else em += 0.65;
  }
  return em * fontSize;
}

// Greedy word-wrap against the estimated width.
function wrapText(text, fontSize, maxWidth, maxLines) {
  const lines = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (estimateWidth(candidate, fontSize) <= maxWidth || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = `${lines[maxLines - 1].replace(/[,.;:]?$/, "")}…`;
  }
  return lines;
}

function tspans(lines, x, startY, lineHeight) {
  return lines
    .map(
      (line, i) =>
        `<tspan x="${x}" y="${startY + i * lineHeight}">${escapeXml(line)}</tspan>`,
    )
    .join("");
}

function svgCard({ title, description }) {
  const textX = 80;
  // The photo sits at x=710 (WIDTH − 420 − 70); keep a gutter before it.
  const textWidth = 600;

  // "A | B" titles (the home page's "Stefan Hoth | Engineering Leader")
  // break at the pipe instead of wrapping mid-phrase. Step the font size
  // down until the title fits the column in at most two lines.
  const titleParts = title.split(/\s*\|\s*/);
  let titleSize;
  let titleLines;
  for (titleSize of [68, 58, 50, 42]) {
    titleLines = titleParts.flatMap((part) =>
      wrapText(part, titleSize, textWidth, 3),
    );
    if (
      titleLines.length <= 2 &&
      titleLines.every((line) => estimateWidth(line, titleSize) <= textWidth)
    ) {
      break;
    }
  }
  const titleLineHeight = Math.round(titleSize * 1.18);
  const titleY = 248;

  const descSize = 30;
  const descLines = description
    ? wrapText(description, descSize, textWidth, 3)
    : [];
  const descY = titleY + titleLines.length * titleLineHeight - titleSize + 62;

  // Palette from Layout.astro (light theme): bg #fafafa, text #111,
  // muted #5f6672, accent #0d6efd, with the same soft three-color
  // ambient wash the site paints on <body>.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
  <defs>
    <radialGradient id="wash-blue" cx="0.82" cy="-0.08" r="0.9">
      <stop offset="0" stop-color="#b7cdf1" stop-opacity="0.55"/>
      <stop offset="0.7" stop-color="#b7cdf1" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="wash-green" cx="0.08" cy="0.55" r="0.75">
      <stop offset="0" stop-color="#bfe3cf" stop-opacity="0.5"/>
      <stop offset="0.7" stop-color="#bfe3cf" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="wash-orange" cx="0.95" cy="0.9" r="0.7">
      <stop offset="0" stop-color="#f0d3bd" stop-opacity="0.45"/>
      <stop offset="0.7" stop-color="#f0d3bd" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="#fafafa"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#wash-blue)"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#wash-green)"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#wash-orange)"/>
  <text x="${textX}" y="128" font-family="sans-serif" font-size="26" font-weight="600" letter-spacing="3" fill="#0d6efd">STEFANHOTH.COM</text>
  <text font-family="sans-serif" font-size="${titleSize}" font-weight="700" fill="#111111">${tspans(titleLines, textX, titleY, titleLineHeight)}</text>
  <text font-family="sans-serif" font-size="${descSize}" fill="#5f6672">${tspans(descLines, textX, descY, 44)}</text>
</svg>`;
}

async function renderCard(page) {
  const photoSize = 420;
  const photo = await sharp(readFileSync(PROFILE))
    .resize(photoSize, photoSize)
    .png()
    .toBuffer();
  return sharp(Buffer.from(svgCard(page)))
    .composite([
      {
        input: photo,
        left: WIDTH - photoSize - 70,
        top: Math.round((HEIGHT - photoSize) / 2),
      },
    ])
    // Palette quantization keeps each card well under 300 KB — WhatsApp
    // (and some other messengers) won't show a preview image above that.
    .png({ palette: true, quality: 90, compressionLevel: 9 })
    .toBuffer();
}

mkdirSync(OUT_DIR, { recursive: true });

const pages = readdirSync(VAULT_DIR)
  .filter((name) => name.endsWith(".md"))
  .map(parseVaultPage)
  .filter((page) => page.isHome || page.publish);

const generated = new Set(["default.png"]);

for (const page of pages) {
  const card = await renderCard(page);
  const filename = page.isHome ? "home.png" : `${page.slug}.png`;
  generated.add(filename);
  writeFileSync(new URL(filename, OUT_DIR), card);
  console.log(`generated ${filename} (${page.title})`);
  if (page.isHome) {
    // Fallback image for any published page without a generated card.
    writeFileSync(new URL("default.png", OUT_DIR), card);
    console.log("generated default.png (fallback)");
  }
}

// The vault is an exact mirror of Obsidian, so a page that was deleted or
// unpublished there must lose its card here too — otherwise the sync PR
// would keep serving a stale preview image under /img/og/.
for (const name of readdirSync(OUT_DIR)) {
  if (name.endsWith(".png") && !generated.has(name)) {
    rmSync(new URL(name, OUT_DIR));
    console.log(`removed ${name} (page no longer published)`);
  }
}
