// Builds /llms.txt (https://llmstxt.org/) from the same vault frontmatter the
// site itself is built from, so the page list and descriptions can't go stale
// when pages are added, renamed, unpublished or re-described in Obsidian.
// Only the intro wording and the external links below are hand-written.

import { HOME_SLUG, markdownPath } from "./pagePaths.js";

// External profiles, listed under "Optional" (agents may skip these).
export const OPTIONAL_LINKS = [
  {
    title: "LinkedIn",
    url: "https://www.linkedin.com/in/stefanhoth",
    description: "Professional profile and work history.",
  },
  {
    title: "Substack: On Engineering Leadership",
    url: "https://stefanhoth.substack.com",
    description: "Long-form writing on engineering leadership.",
  },
  {
    title: "GitHub",
    url: "https://github.com/stefanhoth",
    description: "Open source projects and code.",
  },
];

const oneLine = (text) => text.replace(/\s+/g, " ").trim();

function entry({ title, slug, description }, site) {
  const link = `[${title}](${new URL(markdownPath(slug), site).href})`;
  return description ? `- ${link}: ${oneLine(description)}` : `- ${link}`;
}

// `home` is the home collection entry's data, `pages` the published pages
// (collection entries with `id` and `data`).
export function buildLlmsTxt({ site, home, pages }) {
  const summary = [home.description, home.jobhunt].filter(Boolean).map(oneLine);

  const homeEntry = entry(
    {
      title: "Home",
      slug: HOME_SLUG,
      description: "Bio, focus areas and current job search status.",
    },
    site,
  );
  const pageEntries = [...pages]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((page) =>
      entry(
        {
          title: page.data.title,
          slug: (page.data.permalink ?? page.id).replace(/\.md$/, ""),
          description: page.data.description,
        },
        site,
      ),
    );

  const optional = OPTIONAL_LINKS.map(
    ({ title, url, description }) => `- [${title}](${url}): ${description}`,
  );

  return `# Stefan Hoth

> ${summary.join(" ")}

Every page is served in two representations: HTML at \`/<page>\` and plain Markdown at \`/<page>.md\` (the homepage at \`/\` and \`/index.md\`). The links below point at the Markdown versions — prefer those over the HTML version. Requesting an HTML URL with \`Accept: text/markdown\` redirects to the Markdown URL, and vice versa.

## Pages

${[homeEntry, ...pageEntries].join("\n")}

## Optional

${optional.join("\n")}
`;
}
