import { describe, expect, it } from "vitest";
import rehypeProjectCards from "../../src/lib/rehypeProjectCards.js";

// Minimal hast helpers matching what the markdown pipeline produces.
const el = (tagName, ...children) => ({
  type: "element",
  tagName,
  properties: {},
  children,
});
const text = (value) => ({ type: "text", value });

const file = (template) => ({ data: { astro: { frontmatter: { template } } } });

const run = (tree, template) => {
  rehypeProjectCards()(tree, file(template));
  return tree;
};

const projectTree = () => ({
  type: "root",
  children: [
    el("h1", text("Projects")),
    el("p", text("Intro paragraph")),
    el("h2", el("a", text("First project"))),
    el("p", text("First description")),
    el("h2", text("Second project")),
    el("p", text("Second description")),
  ],
});

describe("rehypeProjectCards", () => {
  it("wraps each h2 and its following content into a project-card section", () => {
    const tree = run(projectTree(), "projects");

    const [h1, intro, cardA, cardB] = tree.children;
    expect(h1.tagName).toBe("h1");
    expect(intro.tagName).toBe("p");

    expect(cardA.tagName).toBe("section");
    expect(cardA.properties.className).toEqual(["project-card"]);
    expect(cardA.children.map((c) => c.tagName)).toEqual(["div", "p"]);

    expect(cardB.tagName).toBe("section");
  });

  it("builds a header row with the h2 and a monogram icon tile", () => {
    const tree = run(projectTree(), "projects");
    const header = tree.children[2].children[0];

    expect(header.properties.className).toEqual(["project-card-header"]);
    const [icon, h2] = header.children;
    expect(icon.properties.className).toEqual(["project-icon"]);
    expect(icon.properties.ariaHidden).toBe("true");
    expect(icon.children[0].value).toBe("F");
    expect(h2.tagName).toBe("h2");
  });

  it("assigns each card a stable hue derived from its title", () => {
    const treeA = run(projectTree(), "projects");
    const treeB = run(projectTree(), "projects");

    const styleOf = (tree, i) => tree.children[i].properties.style;
    expect(styleOf(treeA, 2)).toMatch(/^--project-hue: \d+$/);
    expect(styleOf(treeA, 2)).toBe(styleOf(treeB, 2));
    expect(styleOf(treeA, 2)).not.toBe(styleOf(treeA, 3));
  });

  it("moves a leading emoji from the title into the icon tile", () => {
    const tree = {
      type: "root",
      children: [
        el("h2", el("a", text("🔦 STARlog"))),
        el("p", text("Description")),
      ],
    };

    run(tree, "projects");

    const [icon, h2] = tree.children[0].children[0].children;
    expect(icon.children[0].value).toBe("🔦");
    expect(h2.children[0].children[0].value).toBe("STARlog");
  });

  it("turns an em-only paragraph after the title into meta chips", () => {
    // Includes the newline text nodes the real pipeline emits between blocks.
    const tree = {
      type: "root",
      children: [
        el("h2", text("Project")),
        text("\n"),
        el("p", el("em", text("TypeScript · Gemini · browser-only"))),
        text("\n"),
        el("p", text("Description")),
      ],
    };

    run(tree, "projects");

    const [, , meta, , description] = tree.children[0].children;
    expect(meta.properties.className).toEqual(["project-meta"]);
    expect(meta.children.map((chip) => chip.children[0].value)).toEqual([
      "TypeScript",
      "Gemini",
      "browser-only",
    ]);
    expect(meta.children[0].properties.className).toEqual(["chip"]);
    expect(description.properties.className).toBeUndefined();
  });

  it("does not treat a later em-only paragraph as the meta line", () => {
    const tree = {
      type: "root",
      children: [
        el("h2", text("Project")),
        el("p", text("Description")),
        el("p", el("em", text("just an emphasized sentence"))),
      ],
    };

    run(tree, "projects");

    const [, , later] = tree.children[0].children;
    expect(later.properties.className).toBeUndefined();
  });

  it("marks a strong-only paragraph after the chips as the pitch", () => {
    const tree = {
      type: "root",
      children: [
        el("h2", text("Project")),
        el("p", el("em", text("Rust · CLI"))),
        el("p", el("strong", text("One-line pitch."))),
        el("p", text("Description")),
      ],
    };

    run(tree, "projects");

    const [, meta, pitch, description] = tree.children[0].children;
    expect(meta.properties.className).toEqual(["project-meta"]);
    expect(pitch.properties.className).toEqual(["project-pitch"]);
    expect(description.properties.className).toBeUndefined();
  });

  it("folds each h3 group into a collapsible details section", () => {
    const tree = {
      type: "root",
      children: [
        el("h2", text("Project")),
        el("p", text("Description")),
        el("h3", text("The story")),
        el("p", text("Story body")),
        el("h3", text("Lessons learned")),
        el("p", text("Lesson body")),
      ],
    };

    run(tree, "projects");

    const [, description, story, lessons] = tree.children[0].children;
    expect(description.tagName).toBe("p");

    expect(story.tagName).toBe("details");
    expect(story.properties.className).toEqual(["project-details"]);
    expect(story.children[0].tagName).toBe("summary");
    expect(story.children[0].children[0].value).toBe("The story");
    expect(story.children[1].children[0].value).toBe("Story body");

    expect(lessons.children[0].children[0].value).toBe("Lessons learned");
    expect(lessons.children[1].children[0].value).toBe("Lesson body");
  });

  it("turns a trailing all-links list into the action row, even after an h3 section", () => {
    const tree = {
      type: "root",
      children: [
        el("h2", text("Project")),
        el("p", text("Description")),
        el("h3", text("Lessons learned")),
        el("p", text("Lesson body")),
        el("ul", el("li", el("a", text("GitHub"))), el("li", el("a", text("Slides")))),
      ],
    };

    run(tree, "projects");

    const card = tree.children[0];
    const links = card.children.at(-1);
    expect(links.tagName).toBe("ul");
    expect(links.properties.className).toEqual(["project-links"]);
    // The details section keeps only its own body.
    const details = card.children.at(-2);
    expect(details.tagName).toBe("details");
    expect(details.children.map((c) => c.tagName)).toEqual(["summary", "p"]);
  });

  it("keeps a list with non-link content out of the action row", () => {
    const tree = {
      type: "root",
      children: [
        el("h2", text("Project")),
        el("ul", el("li", text("plain bullet")), el("li", el("a", text("GitHub")))),
      ],
    };

    run(tree, "projects");

    const list = tree.children[0].children.at(-1);
    expect(list.properties.className).toBeUndefined();
  });

  describe("action row variants", () => {
    // A card shaped like a talk entry: pitch, an h3 section with an ordered
    // list, then the trailing list under test.
    const cardWith = (list) => {
      const tree = {
        type: "root",
        children: [
          el("h2", text("Talk")),
          el("p", text("Abstract")),
          el("h3", text("Key takeaways")),
          el("ol", el("li", text("One")), el("li", text("Two"))),
          list,
        ],
      };
      run(tree, "projects");
      return tree.children[0];
    };

    const labels = (ul) =>
      ul.children.map((li) =>
        li.children
          .map((child) => child.children?.[0]?.value ?? child.value)
          .join(""),
      );

    it("splits an item holding several links into one button per link", () => {
      const card = cardWith(
        el(
          "ul",
          el("li", el("a", text("Event"))),
          el(
            "li",
            el("a", text("Try it")),
            text(" · "),
            el("a", text("GitHub")),
          ),
        ),
      );

      const links = card.children.at(-1);
      expect(links.properties.className).toEqual(["project-links"]);
      expect(labels(links)).toEqual(["Event", "Try it", "GitHub"]);
      expect(links.children.every((li) => li.children.length === 1)).toBe(true);
    });

    it("keeps a short 'Label: status' note in the row as a muted pill", () => {
      const card = cardWith(
        el(
          "ul",
          el("li", el("a", text("Slides"))),
          el("li", text("Recording: ⏳"), el("em", text("waiting for it"))),
          el("li", el("a", text("Event"))),
        ),
      );

      const links = card.children.at(-1);
      expect(links.properties.className).toEqual(["project-links"]);
      expect(links.children.map((li) => li.properties.className)).toEqual([
        undefined,
        ["project-note"],
        undefined,
      ]);
      // The talk's own details section no longer swallows the list.
      const details = card.children.at(-2);
      expect(details.tagName).toBe("details");
      expect(details.children.map((c) => c.tagName)).toEqual(["summary", "ol"]);
    });

    it("needs at least one link: a list of notes alone stays in the section", () => {
      const list = el(
        "ul",
        el("li", text("Recording: soon")),
        el("li", text("Slides: soon")),
      );

      const card = cardWith(list);

      expect(card.children.at(-1).tagName).toBe("details");
      expect(list.properties.className).toBeUndefined();
    });

    it("keeps lists with prose bullets inside the section", () => {
      for (const prose of [
        // no "Label:" prefix
        el("li", text("Ship small")),
        // has a colon, but far too long for a status note
        el(
          "li",
          text("Cloud vs. local AI is a trade-off: Gemini adds a free tier"),
        ),
        // text mixed with a link is neither links-only nor a note
        el(
          "li",
          text("See the "),
          el("a", text("write-up")),
          text(" for details"),
        ),
      ]) {
        const list = el("ul", prose, el("li", el("a", text("GitHub"))));

        const card = cardWith(list);

        expect(card.children.at(-1).tagName).toBe("details");
        expect(list.properties.className).toBeUndefined();
      }
    });
  });

  it("leaves pages with other templates untouched", () => {
    const children = [el("h2", text("Heading")), el("p", text("Body"))];
    const tree = { type: "root", children: [...children] };

    run(tree, "sidebar");

    expect(tree.children).toEqual(children);
  });
});
