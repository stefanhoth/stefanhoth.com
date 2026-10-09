import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  assetSlug,
  copyPublicAssets,
  listPublicAssets,
  MAX_IMAGE_WIDTH,
  publicAssetHref,
  publicAssetsBySlug,
  rehypePublicAssetLinks,
  remarkObsidianEmbeds,
} from "../../src/lib/publicAssets.js";

let vault;
let out;

function touch(relativePath, content = "x") {
  const path = join(vault, "_public-assets", ...relativePath.split("/"));
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, content);
}

beforeEach(() => {
  const base = mkdtempSync(join(tmpdir(), "public-assets-"));
  vault = join(base, "vault");
  out = join(base, "dist");
  mkdirSync(vault);
});

afterEach(() => {
  rmSync(join(vault, ".."), { recursive: true, force: true });
});

describe("listPublicAssets", () => {
  it("returns nothing when the folder doesn't exist", () => {
    expect(listPublicAssets(vault)).toEqual([]);
  });

  it("lists allowed extensions recursively as sorted POSIX paths", () => {
    touch("starlog.pdf");
    touch("talks/Migration.PDF");
    touch("talks/cover.jpeg");
    touch("shot.png");
    touch("shot2.webp");
    touch("anim.gif");
    touch("photo.avif");

    expect(listPublicAssets(vault)).toEqual([
      "anim.gif",
      "photo.avif",
      "shot.png",
      "shot2.webp",
      "starlog.pdf",
      "talks/Migration.PDF",
      "talks/cover.jpeg",
    ]);
  });

  it("skips other file types, dot-files and dot-folders", () => {
    touch("notes.md");
    touch("diagram.svg");
    touch("archive.zip");
    touch(".hidden.pdf");
    touch(".trash/old.pdf");
    touch("ok.pdf");

    expect(listPublicAssets(vault)).toEqual(["ok.pdf"]);
  });
});

describe("publicAssetHref", () => {
  it("encodes each segment but keeps the slashes", () => {
    expect(publicAssetHref("talks/My Talk (v2).pdf")).toBe(
      "/_public-assets/talks/My%20Talk%20(v2).pdf",
    );
  });
});

describe("publicAssetsBySlug", () => {
  it("maps the normalised file name to the vault-relative path", () => {
    touch("talks/My Talk.pdf");

    const bySlug = publicAssetsBySlug(vault);

    expect(assetSlug("My Talk.pdf")).toBe("my-talk.pdf");
    expect(bySlug.get("my-talk.pdf")).toBe("talks/My Talk.pdf");
  });

  it("lets the first path win when two folders share a file name", () => {
    touch("a/talk.pdf");
    touch("b/talk.pdf");

    expect(publicAssetsBySlug(vault).get("talk.pdf")).toBe("a/talk.pdf");
  });
});

async function image(
  relativePath,
  { width, height, format = "jpeg", ...meta },
) {
  const path = join(vault, "_public-assets", ...relativePath.split("/"));
  mkdirSync(join(path, ".."), { recursive: true });
  const pipeline = sharp({
    create: { width, height, channels: 3, background: "#cc3333" },
  });
  if (Object.keys(meta).length > 0) pipeline.withMetadata(meta);
  await pipeline[format]().toFile(path);
  return path;
}

describe("copyPublicAssets", () => {
  it("copies pdf, gif and avif byte for byte, keeping relative paths", async () => {
    touch("starlog.pdf", "%PDF-1.4 starlog");
    touch("talks/migration.pdf", "%PDF-1.4 migration");
    touch("anim.gif", "GIF89a-frames");
    touch("notes.md", "private");

    const copied = await copyPublicAssets(vault, out);

    expect(copied).toEqual(["anim.gif", "starlog.pdf", "talks/migration.pdf"]);
    const published = (...parts) =>
      readFileSync(join(out, "_public-assets", ...parts), "utf8");
    expect(published("starlog.pdf")).toBe("%PDF-1.4 starlog");
    expect(published("talks", "migration.pdf")).toBe("%PDF-1.4 migration");
    expect(published("anim.gif")).toBe("GIF89a-frames");
    expect(existsSync(join(out, "_public-assets", "notes.md"))).toBe(false);
  });

  it("does nothing without a _public-assets folder", async () => {
    expect(await copyPublicAssets(vault, out)).toEqual([]);
    expect(existsSync(join(out, "_public-assets"))).toBe(false);
  });

  it("shrinks wide images to MAX_IMAGE_WIDTH and leaves the original alone", async () => {
    const original = await image("events/big.jpg", {
      width: 3200,
      height: 2000,
    });
    const originalBytes = readFileSync(original);

    await copyPublicAssets(vault, out);

    const meta = await sharp(
      join(out, "_public-assets", "events", "big.jpg"),
    ).metadata();
    expect([meta.width, meta.height]).toEqual([MAX_IMAGE_WIDTH, 1000]);
    expect(readFileSync(original).equals(originalBytes)).toBe(true);
  });

  it("never enlarges a small image, for every optimised format", async () => {
    await image("small.png", { width: 400, height: 300, format: "png" });
    await image("small.webp", { width: 400, height: 300, format: "webp" });
    await image("small.jpeg", { width: 400, height: 300 });

    await copyPublicAssets(vault, out);

    for (const name of ["small.png", "small.webp", "small.jpeg"]) {
      const meta = await sharp(join(out, "_public-assets", name)).metadata();
      expect([name, meta.width, meta.height]).toEqual([name, 400, 300]);
    }
  });

  it("strips EXIF metadata, e.g. the GPS location of a phone photo", async () => {
    await image("geo.jpg", {
      width: 800,
      height: 600,
      exif: { IFD0: { Copyright: "private" } },
    });
    const before = await sharp(
      join(vault, "_public-assets", "geo.jpg"),
    ).metadata();
    expect(before.exif).toBeDefined();

    await copyPublicAssets(vault, out);

    const after = await sharp(
      join(out, "_public-assets", "geo.jpg"),
    ).metadata();
    expect(after.exif).toBeUndefined();
  });

  it("bakes the EXIF rotation into the pixels before dropping the tag", async () => {
    await image("portrait.jpg", { width: 800, height: 400, orientation: 6 });

    await copyPublicAssets(vault, out);

    const meta = await sharp(
      join(out, "_public-assets", "portrait.jpg"),
    ).metadata();
    expect([meta.width, meta.height]).toEqual([400, 800]);
    expect(meta.orientation).toBeUndefined();
  });

  it("names the file when an image can't be processed", async () => {
    touch("broken.png", "not a png");

    await expect(copyPublicAssets(vault, out)).rejects.toThrow(
      /_public-assets\/broken\.png/,
    );
  });
});

describe("remarkObsidianEmbeds", () => {
  const assets = new Map([
    ["event-photo.png", "events/Event Photo.png"],
    ["anim.gif", "anim.gif"],
    ["talk.pdf", "talk.pdf"],
  ]);

  const run = (value) => {
    const tree = {
      type: "root",
      children: [{ type: "paragraph", children: [{ type: "text", value }] }],
    };
    remarkObsidianEmbeds({ assets })(tree);
    return tree.children[0].children;
  };

  it("turns an embed into an image, alt defaulting to the file name", () => {
    expect(run("![[Event Photo.png]]")).toEqual([
      {
        type: "image",
        url: "/_public-assets/events/Event%20Photo.png",
        alt: "Event Photo",
        title: null,
        data: undefined,
      },
    ]);
  });

  it("reads width and alt text from the options, in any order", () => {
    for (const embed of [
      "![[Event Photo.png|Stage|300]]",
      "![[Event Photo.png|300|Stage]]",
      "![[Event Photo.png| Stage | 300 ]]",
    ]) {
      const [node] = run(embed);
      expect(node.alt).toBe("Stage");
      expect(node.data).toEqual({ hProperties: { width: "300" } });
    }
  });

  it("uses only the width of a WxH size", () => {
    expect(run("![[Event Photo.png|300x200]]")[0].data).toEqual({
      hProperties: { width: "300" },
    });
  });

  it("matches by file name, case- and space-insensitively", () => {
    expect(run("![[event photo.PNG]]")[0].type).toBe("image");
    expect(run("![[events/Event Photo.png]]")[0].type).toBe("image");
    expect(run("![[anim.gif]]")[0].type).toBe("image");
  });

  it("turns a pdf embed into a plain link", () => {
    expect(run("![[talk.pdf]]")).toEqual([
      {
        type: "link",
        url: "/_public-assets/talk.pdf",
        children: [{ type: "text", value: "talk.pdf" }],
      },
    ]);
    expect(run("![[talk.pdf|Slides]]")[0].children[0].value).toBe("Slides");
  });

  it("keeps surrounding text and handles several embeds in one run", () => {
    const nodes = run("A ![[anim.gif]] and ![[Event Photo.png]] done");

    expect(nodes.map((node) => node.type)).toEqual([
      "text",
      "image",
      "text",
      "image",
      "text",
    ]);
    expect(nodes[0].value).toBe("A ");
    expect(nodes[2].value).toBe(" and ");
    expect(nodes[4].value).toBe(" done");
  });

  it("leaves an embed without a matching file untouched, text and all", () => {
    expect(run("![[missing.png]]")).toEqual([
      { type: "text", value: "![[missing.png]]" },
    ]);
    expect(
      run("![[heic-photo.heic]] ![[anim.gif]]").map((n) => n.type),
    ).toEqual(["text", "image"]);
  });

  it("ignores plain wikilinks and descends into nested nodes", () => {
    expect(run("[[talk.pdf]]")).toEqual([
      { type: "text", value: "[[talk.pdf]]" },
    ]);

    const tree = {
      type: "root",
      children: [
        {
          type: "list",
          children: [
            {
              type: "listItem",
              children: [
                {
                  type: "paragraph",
                  children: [{ type: "text", value: "![[anim.gif]]" }],
                },
              ],
            },
          ],
        },
      ],
    };
    remarkObsidianEmbeds({ assets })(tree);
    expect(tree.children[0].children[0].children[0].children[0].type).toBe(
      "image",
    );
  });
});

describe("rehypePublicAssetLinks", () => {
  const run = (properties) => {
    const tree = {
      type: "root",
      children: [{ type: "element", tagName: "a", properties, children: [] }],
    };
    rehypePublicAssetLinks()(tree);
    return tree.children[0].properties;
  };

  it("makes vault-relative asset links root-absolute", () => {
    expect(run({ href: "_public-assets/talk.pdf" }).href).toBe(
      "/_public-assets/talk.pdf",
    );
    expect(run({ href: "./_public-assets/talks/a%20b.pdf" }).href).toBe(
      "/_public-assets/talks/a%20b.pdf",
    );
    expect(run({ src: "_public-assets/cover.png" }).src).toBe(
      "/_public-assets/cover.png",
    );
  });

  it("leaves every other link alone", () => {
    for (const href of [
      "/_public-assets/talk.pdf",
      "https://example.com/_public-assets/talk.pdf",
      "docs/_public-assets/talk.pdf",
      "/projects.md",
      "#top",
    ]) {
      expect(run({ href }).href).toBe(href);
    }
  });

  it("lazy-loads images from the folder, and only those", () => {
    const tree = {
      type: "root",
      children: [
        {
          type: "element",
          tagName: "img",
          properties: { src: "_public-assets/a.jpg" },
          children: [],
        },
        {
          type: "element",
          tagName: "img",
          properties: { src: "https://example.com/b.jpg" },
          children: [],
        },
        {
          type: "element",
          tagName: "a",
          properties: { href: "_public-assets/c.pdf" },
          children: [],
        },
      ],
    };
    rehypePublicAssetLinks()(tree);

    const [local, remote, link] = tree.children.map((node) => node.properties);
    expect(local).toEqual({
      src: "/_public-assets/a.jpg",
      loading: "lazy",
      decoding: "async",
    });
    expect(remote).toEqual({ src: "https://example.com/b.jpg" });
    expect(link).toEqual({ href: "/_public-assets/c.pdf" });
  });
});
