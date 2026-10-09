// Rehype plugin for `template: projects` pages: wraps every h2 and the
// content up to the next h2 into <section class="project-card">, so the
// page can style each project as a card. Content before the first h2
// (the intro) is left untouched; pages with any other template pass
// through unchanged.
//
// Inside a card the plugin also builds the presentation structure the
// styles in src/pages/[slug].astro rely on:
// - a header row with an icon tile: the project's leading emoji if the
//   title starts with one (it is moved out of the title), otherwise a
//   monogram of the first letter, tinted with a hue derived from the
//   title so each project gets a stable, distinct color
// - a paragraph holding nothing but an *emphasized* line directly after
//   the title becomes a row of chips, split on "·"
// - a paragraph holding nothing but a **strong** line (first paragraph
//   after the chips) becomes the card's pitch line
// - every h3 opens a collapsible section (<details>): the h3 text is the
//   summary, everything up to the next h3 is the collapsed body — meant
//   for "The story" / "Lessons learned"
// - a trailing bullet list of links becomes the card's action row (e.g.
//   GitHub, write-up, slides): an item may hold several links (each becomes
//   its own button) or be a short "Label: status" note without a link, like
//   "Recording: ⏳ waiting for it" (shown as a muted pill)

const text = (value) => ({ type: "text", value });

const el = (tagName, properties, children) => ({
  type: "element",
  tagName,
  properties,
  children,
});

function textContent(node) {
  if (node.type === "text") return node.value;
  return (node.children ?? []).map(textContent).join("");
}

// Curated set of cheerful oklch hues — a free 0-359 hue produced muddy
// browns/olives for some titles. Order matters: existing projects keep
// their color because the index comes from a stable title hash.
const HUES = [25, 330, 140, 230, 280, 85, 190];

// Stable hue from the project title, so colors survive rebuilds but
// differ between projects.
function hueFor(name) {
  let hash = 0;
  for (const char of name) {
    hash = (hash * 31 + char.codePointAt(0)) >>> 0;
  }
  return HUES[hash % HUES.length];
}

const LEADING_EMOJI = /^(\p{Extended_Pictographic}️?)\s*/u;

// Removes a leading emoji from the first non-empty text node under the
// h2 (typically inside its link) and returns it, or null if none.
function extractLeadingEmoji(h2) {
  const queue = [h2];
  while (queue.length > 0) {
    const node = queue.shift();
    if (node.type === "text" && node.value.trim() !== "") {
      const match = node.value.match(LEADING_EMOJI);
      if (!match) return null;
      node.value = node.value.slice(match[0].length);
      return match[1];
    }
    queue.unshift(...(node.children ?? []));
  }
  return null;
}

function iconTile(h2) {
  const emoji = extractLeadingEmoji(h2);
  const title = textContent(h2).trim();
  return el("span", { className: ["project-icon"], ariaHidden: "true" }, [
    text(emoji ?? (title[0] ?? "?").toUpperCase()),
  ]);
}

function isParagraphWrappingOnly(node, tagName) {
  if (node?.type !== "element" || node.tagName !== "p") return false;
  const children = node.children.filter(
    (child) => child.type !== "text" || child.value.trim() !== "",
  );
  return children.length === 1 && children[0].tagName === tagName;
}

// A paragraph whose only element child is a single <em> right after the
// title is the card's meta line; its "·"-separated parts become chips.
const isMetaParagraph = (node) => isParagraphWrappingOnly(node, "em");

// A paragraph holding nothing but a <strong> line is the pitch.
const isPitchParagraph = (node) => isParagraphWrappingOnly(node, "strong");

// An item made of links and nothing but separators between them, e.g.
// `[Try it](…) · [GitHub](…)`. Returns the links, or null for any other item.
const SEPARATORS = /^[\s·|•,/–—-]*$/;

function linksOnly(li) {
  const content = li.children.filter(
    (child) => child.type !== "text" || child.value.trim() !== "",
  );
  const links = content.filter((child) => child.tagName === "a");
  const rest = li.children.filter((child) => child.tagName !== "a");
  const onlySeparators = rest.every(
    (child) => child.type === "text" && SEPARATORS.test(child.value),
  );
  return links.length > 0 && onlySeparators ? links : null;
}

// A link-free "Label: status" note — short, with a short label before the
// colon — so a placeholder like "Recording: ⏳ waiting for it" can sit in the
// action row. Plain prose bullets don't match (no label, or too long).
function isStatusNote(li) {
  const value = textContent(li).trim();
  const hasLink = (node) =>
    node.tagName === "a" || (node.children ?? []).some(hasLink);
  return !hasLink(li) && value.length <= 48 && /^[^:]{1,24}:\s*\S/.test(value);
}

// A bullet list is the card's action row when every item is links-only or a
// status note, and at least one item holds a link. Returns the normalised
// items (one <li> per link, notes marked `project-note`), or null.
function toActionItems(node) {
  if (node?.type !== "element" || node.tagName !== "ul") return null;
  const items = node.children.filter((child) => child.type === "element");
  if (items.length === 0) return null;

  const actions = [];
  let hasLink = false;
  for (const li of items) {
    if (li.tagName !== "li") return null;
    const links = linksOnly(li);
    if (links) {
      hasLink = true;
      actions.push(...links.map((link) => el("li", {}, [link])));
    } else if (isStatusNote(li)) {
      actions.push(el("li", { className: ["project-note"] }, li.children));
    } else {
      return null;
    }
  }
  return hasLink ? actions : null;
}

function toChips(paragraph) {
  const em = paragraph.children.find((child) => child.tagName === "em");
  paragraph.properties.className = ["project-meta"];
  paragraph.children = textContent(em)
    .split("·")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => el("span", { className: ["chip"] }, [text(part)]));
}

function buildCard(h2) {
  const icon = iconTile(h2);
  const title = textContent(h2).trim();
  const header = el("div", { className: ["project-card-header"] }, [icon, h2]);
  return el(
    "section",
    { className: ["project-card"], style: `--project-hue: ${hueFor(title)}` },
    [header],
  );
}

// Distributes a section's body nodes into the card: tags the meta line
// (first element) and pitch (next element), folds h3 groups into
// <details>, and appends a trailing link list as the action row.
function fillCard(card, nodes) {
  let linkList = null;
  let actions = null;
  for (let i = nodes.length - 1; i >= 0; i--) {
    const node = nodes[i];
    if (node.type === "text" && node.value.trim() === "") continue;
    actions = toActionItems(node);
    if (actions) {
      linkList = node;
      nodes.splice(i, 1);
    }
    break;
  }

  let details = null;
  let bodyElements = 0;

  for (const node of nodes) {
    if (node.type === "element" && node.tagName === "h3") {
      details = el("details", { className: ["project-details"] }, [
        el("summary", {}, node.children),
      ]);
      card.children.push(details);
      continue;
    }
    if (node.type === "element" && details === null) {
      if (bodyElements === 0 && isMetaParagraph(node)) {
        toChips(node);
      } else if (bodyElements <= 1 && isPitchParagraph(node)) {
        node.properties.className = ["project-pitch"];
      }
      bodyElements += 1;
    }
    (details ?? card).children.push(node);
  }

  if (linkList) {
    linkList.properties.className = ["project-links"];
    linkList.children = actions;
    card.children.push(linkList);
  }
}

export default function rehypeProjectCards() {
  return (tree, file) => {
    if (file.data.astro?.frontmatter?.template !== "projects") return;

    const wrapped = [];
    let card = null;
    let body = [];

    const flush = () => {
      if (card) fillCard(card, body);
      body = [];
    };

    for (const node of tree.children) {
      if (node.type === "element" && node.tagName === "h2") {
        flush();
        card = buildCard(node);
        wrapped.push(card);
      } else if (card) {
        body.push(node);
      } else {
        wrapped.push(node);
      }
    }
    flush();

    tree.children = wrapped;
  };
}
