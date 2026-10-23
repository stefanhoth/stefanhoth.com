import { describe, expect, it } from "vitest";
import { buildSitemap, canonicalPathFor } from "../../src/lib/sitemap.js";

describe("canonicalPathFor", () => {
  it("keeps the .md suffix for file-style permalinks", () => {
    expect(
      canonicalPathFor({ id: "projects", data: { permalink: "projects.md" } }),
    ).toBe("/projects.md");
  });

  it("uses a trailing-slash URL for folder-style pages", () => {
    expect(canonicalPathFor({ id: "about", data: {} })).toBe("/about/");
    expect(canonicalPathFor({ id: "x", data: { permalink: "about" } })).toBe(
      "/about/",
    );
  });
});

describe("buildSitemap", () => {
  it("emits absolute, escaped <loc> entries", () => {
    const xml = buildSitemap("https://stefanhoth.com", ["/", "/a&b/"]);
    expect(xml).toContain(
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    );
    expect(xml).toContain("<loc>https://stefanhoth.com/</loc>");
    expect(xml).toContain("<loc>https://stefanhoth.com/a&amp;b/</loc>");
  });
});
