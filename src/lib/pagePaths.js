// URL scheme of a published page. Every page has two representations under
// two different URLs, and the Worker (worker/index.js) keeps content and URL
// in line:
// - HTML at `/<slug>` (the homepage at `/`)
// - Markdown at `/<slug>.md` (the homepage at `/index.md`)
//
// A `.md` suffix on the `permalink` frontmatter field is a legacy of the
// time when `.md` URLs served HTML; it is accepted but ignored.

export const HOME_SLUG = "index";

export function pageSlug({ id, data }) {
  return (data.permalink ?? id).replace(/\.md$/, "");
}

export function htmlPath(slug) {
  return slug === HOME_SLUG ? "/" : `/${slug}`;
}

export function markdownPath(slug) {
  return `/${slug}.md`;
}
