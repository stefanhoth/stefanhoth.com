import { describe, expect, it } from "vitest";
import { toAgentMarkdown } from "../../src/lib/agentMarkdown.js";

const site = "https://stefanhoth.com";
const pages = new Map([
  ["manager-readme", "manager-readme"],
  ["my-talk", "talks"],
]);
const assets = new Map([
  ["slides.pdf", "talks/slides.pdf"],
  ["photo.jpg", "photo.jpg"],
]);

const convert = (body, extra = {}) =>
  toAgentMarkdown({ body, title: "Title", site, pages, assets, ...extra });

describe("toAgentMarkdown", () => {
  it("links wikilinks to the .md twin of the target page", () => {
    expect(convert("# T\n\nSee [[manager-readme|my README]].")).toContain(
      "[my README](https://stefanhoth.com/manager-readme.md)",
    );
    expect(convert("# T\n\n[[My Talk]]")).toContain(
      "[My Talk](https://stefanhoth.com/talks.md)",
    );
  });

  it("drops the link, keeps the text for unknown targets", () => {
    expect(convert("# T\n\n[[secret note|label]] and [[other]]")).toContain(
      "label and other",
    );
  });

  it("links to assets by file name and rewrites vault-relative links", () => {
    const out = convert(
      "# T\n\n[[slides.pdf|Slides]] and [PDF](_public-assets/a.pdf) and [x](./_public-assets/b.pdf)",
    );
    expect(out).toContain(
      "[Slides](https://stefanhoth.com/_public-assets/talks/slides.pdf)",
    );
    expect(out).toContain("[PDF](https://stefanhoth.com/_public-assets/a.pdf)");
    expect(out).toContain("[x](https://stefanhoth.com/_public-assets/b.pdf)");
  });

  it("turns embeds into images and links, leaving unknown ones alone", () => {
    const out = convert(
      "# T\n\n![[photo.jpg|A photo|300]]\n\n![[slides.pdf]]\n\n![[missing.png]]",
    );
    expect(out).toContain(
      "![A photo](https://stefanhoth.com/_public-assets/photo.jpg)",
    );
    expect(out).toContain(
      "[slides.pdf](https://stefanhoth.com/_public-assets/talks/slides.pdf)",
    );
    expect(out).toContain("![[missing.png]]");
  });

  it("leaves fenced code and strips Obsidian comments", () => {
    const out = convert("# T\n\n```\n[[manager-readme]]\n```\n\n%%hidden%%ok");
    expect(out).toContain("```\n[[manager-readme]]\n```");
    expect(out).not.toContain("hidden");
  });

  it("adds a title heading only when the body has none", () => {
    expect(convert("# Own heading\n\ntext")).toMatch(/^# Own heading/);
    const out = convert("text", { description: "About", lead: ["tagline"] });
    expect(out).toBe("# Title\n\n> About\n\ntagline\n\ntext\n");
  });
});
