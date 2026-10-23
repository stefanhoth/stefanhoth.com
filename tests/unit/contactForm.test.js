import { describe, expect, it } from "vitest";
import {
  buildUrlWithoutStatusParams,
  getStatusKeyFromSearch,
} from "../../src/lib/contactForm.js";

describe("getStatusKeyFromSearch", () => {
  it("returns null when there is no status param", () => {
    expect(getStatusKeyFromSearch("")).toBeNull();
    expect(getStatusKeyFromSearch("?foo=bar")).toBeNull();
  });

  it("detects sent", () => {
    expect(getStatusKeyFromSearch("?sent=true")).toBe("sent");
  });

  it("detects error", () => {
    expect(getStatusKeyFromSearch("?error=true")).toBe("error");
  });

  it("prefers sent when both are somehow present", () => {
    expect(getStatusKeyFromSearch("?sent=true&error=true")).toBe("sent");
  });
});

describe("buildUrlWithoutStatusParams", () => {
  it("strips sent/error but keeps other params, path and hash", () => {
    const url = buildUrlWithoutStatusParams(
      "/",
      "?sent=true&ref=newsletter",
      "#contact",
    );
    expect(url).toBe("/?ref=newsletter#contact");
  });

  it("returns a clean path when no other params remain", () => {
    const url = buildUrlWithoutStatusParams("/", "?error=true", "");
    expect(url).toBe("/");
  });

  it("is a no-op when there is nothing to strip", () => {
    const url = buildUrlWithoutStatusParams("/", "", "");
    expect(url).toBe("/");
  });
});
