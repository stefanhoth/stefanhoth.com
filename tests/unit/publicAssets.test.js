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
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  assetSlug,
  copyPublicAssets,
  listPublicAssets,
  publicAssetHref,
  publicAssetsBySlug,
  rehypePublicAssetLinks,
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

    expect(listPublicAssets(vault)).toEqual([
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

describe("copyPublicAssets", () => {
  it("copies allowed files into dist/_public-assets, keeping paths and bytes", () => {
    touch("starlog.pdf", "%PDF-1.4 starlog");
    touch("talks/migration.pdf", "%PDF-1.4 migration");
    touch("notes.md", "private");

    const copied = copyPublicAssets(vault, out);

    expect(copied).toEqual(["starlog.pdf", "talks/migration.pdf"]);
    expect(
      readFileSync(join(out, "_public-assets", "starlog.pdf"), "utf8"),
    ).toBe("%PDF-1.4 starlog");
    expect(
      readFileSync(
        join(out, "_public-assets", "talks", "migration.pdf"),
        "utf8",
      ),
    ).toBe("%PDF-1.4 migration");
    expect(existsSync(join(out, "_public-assets", "notes.md"))).toBe(false);
  });

  it("does nothing without a _public-assets folder", () => {
    expect(copyPublicAssets(vault, out)).toEqual([]);
    expect(existsSync(join(out, "_public-assets"))).toBe(false);
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
});
