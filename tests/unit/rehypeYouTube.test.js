import { describe, expect, it } from "vitest";
import rehypeProjectCards from "../../src/lib/rehypeProjectCards.js";
import rehypeYouTube from "../../src/lib/rehypeYouTube.js";

const el = (tagName, properties, ...children) => ({
  type: "element",
  tagName,
  properties: properties ?? {},
  children,
});
const text = (value) => ({ type: "text", value });
const img = (src, alt = "") => el("img", { src, alt });

const ID = "dQw4w9WgXcQ";
const URL = `https://youtu.be/${ID}`;

const textOf = (node) =>
  node.type === "text" ? node.value : node.children.map(textOf).join("");

describe("rehypeYouTube", () => {
  it("turns a paragraph holding only a YouTube image into a facade", () => {
    const tree = { type: "root", children: [el("p", {}, img(URL, "My talk"))] };
    rehypeYouTube()(tree);

    const [figure] = tree.children;
    expect(figure.tagName).toBe("figure");
    expect(figure.properties.className).toEqual(["video"]);
    expect(figure.properties.dataVideoId).toBe(ID);

    const [poster] = figure.children;
    expect(poster.tagName).toBe("a");
    expect(poster.properties.className).toEqual(["video-poster"]);
    expect(poster.properties.href).toBe(
      `https://www.youtube.com/watch?v=${ID}`,
    );
    expect(poster.properties.ariaLabel).toBe("Play video: My talk");
    expect(textOf(poster)).toContain("My talk");
  });

  it("falls back to a default title without alt text", () => {
    const tree = { type: "root", children: [el("p", {}, img(URL))] };
    rehypeYouTube()(tree);
    expect(textOf(tree.children[0])).toContain("Watch the recording");
  });

  it("leaves ordinary images and mixed paragraphs alone", () => {
    const photo = el("p", {}, img("/_public-assets/photo.jpg", "Photo"));
    const mixed = el("p", {}, text("See "), img(URL, "x"));
    const tree = { type: "root", children: [photo, mixed] };
    rehypeYouTube()(tree);
    expect(tree.children).toEqual([photo, mixed]);
    expect(tree.children[0].tagName).toBe("p");
    expect(tree.children[1].tagName).toBe("p");
  });

  it("keeps the facade inside a project card, in or out of an h3 section", () => {
    const tree = {
      type: "root",
      children: [
        el("h2", {}, text("Talk with video")),
        el("p", {}, text("Abstract")),
        el("p", {}, img(URL, "Visible")),
        el("h3", {}, text("Recording")),
        el("p", {}, img(URL, "Collapsed")),
        el("h2", {}, text("Talk without video")),
        el("p", {}, text("Abstract")),
      ],
    };
    rehypeYouTube()(tree);
    rehypeProjectCards()(tree, {
      data: { astro: { frontmatter: { template: "projects" } } },
    });

    const [withVideo, withoutVideo] = tree.children;
    expect(withVideo.children.map((c) => c.tagName)).toEqual([
      "div",
      "p",
      "figure",
      "details",
    ]);
    const details = withVideo.children[3];
    expect(details.children.map((c) => c.tagName)).toEqual([
      "summary",
      "figure",
    ]);

    expect(withoutVideo.children.map((c) => c.tagName)).toEqual(["div", "p"]);
  });
});
