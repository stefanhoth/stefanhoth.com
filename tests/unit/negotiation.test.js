import { describe, expect, it } from "vitest";
import { preferredFormat } from "../../worker/negotiation.js";

describe("preferredFormat", () => {
  it("has no opinion without an Accept header or on wildcards", () => {
    expect(preferredFormat(null)).toBeNull();
    expect(preferredFormat("")).toBeNull();
    expect(preferredFormat("*/*")).toBeNull();
    expect(preferredFormat("text/plain")).toBeNull();
    expect(preferredFormat("text/*")).toBeNull();
  });

  it("prefers markdown when it ranks above html", () => {
    expect(preferredFormat("text/markdown")).toBe("markdown");
    expect(preferredFormat("text/markdown, text/html;q=0.9")).toBe("markdown");
    expect(preferredFormat("text/html;q=0.5, text/markdown")).toBe("markdown");
    expect(preferredFormat("text/markdown, */*;q=0.1")).toBe("markdown");
  });

  it("prefers html for browsers", () => {
    expect(
      preferredFormat(
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      ),
    ).toBe("html");
    expect(preferredFormat("text/html")).toBe("html");
    expect(preferredFormat("text/markdown;q=0.5, text/html")).toBe("html");
  });

  it("has no opinion when both rank equally", () => {
    expect(preferredFormat("text/markdown, text/html")).toBeNull();
  });

  it("lets the most specific range win over wildcards", () => {
    expect(preferredFormat("text/*;q=0.2, text/markdown;q=0.8")).toBe(
      "markdown",
    );
    expect(preferredFormat("*/*, text/markdown;q=0")).toBe("html");
  });

  it("treats q=0 as not acceptable and ignores case", () => {
    expect(preferredFormat("text/html;q=0, text/markdown;q=0.1")).toBe(
      "markdown",
    );
    expect(preferredFormat("TEXT/Markdown")).toBe("markdown");
  });
});
