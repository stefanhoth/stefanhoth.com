import { describe, expect, it } from "vitest";
import { buildLlmsTxt } from "../../src/lib/llmsTxt.js";

const home = {
  description: "Leader.",
  tagline: "Engineering Leader · Building teams",
  jobhunt: "Open to roles.",
};
const page = (id, data) => ({ id, data: { publish: true, ...data } });

describe("buildLlmsTxt", () => {
  const txt = buildLlmsTxt({
    site: "https://stefanhoth.com",
    home,
    pages: [
      page("talks", {
        title: "Talks",
        description: "Talks\nI gave.",
        permalink: "talks.md",
      }),
      page("employee-readme", {
        title: "Employee README",
        description: "Colleague.",
      }),
    ],
  });

  it("follows the llms.txt structure", () => {
    expect(txt).toMatch(/^# Stefan Hoth\n\n> Leader\. Open to roles\.\n/);
    expect(txt).toContain("## Pages");
    expect(txt).toContain("## Optional");
  });

  it("lists home plus every page as an absolute Markdown link, sorted", () => {
    expect(txt).toContain("(https://stefanhoth.com/index.md)");
    expect(txt.indexOf("employee-readme.md")).toBeLessThan(
      txt.indexOf("talks.md"),
    );
    expect(txt).toContain(
      "- [Talks](https://stefanhoth.com/talks.md): Talks I gave.",
    );
  });
});
