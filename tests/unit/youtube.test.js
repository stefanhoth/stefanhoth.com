import { describe, expect, it } from "vitest";
import {
  parseYouTubeId,
  youtubeEmbedUrl,
  youtubeWatchUrl,
} from "../../src/lib/youtube.js";

const ID = "dQw4w9WgXcQ";

describe("parseYouTubeId", () => {
  it.each([
    `https://www.youtube.com/watch?v=${ID}`,
    `https://youtube.com/watch?v=${ID}&t=42s`,
    `https://m.youtube.com/watch?v=${ID}`,
    `https://youtu.be/${ID}`,
    `https://youtu.be/${ID}?si=abc`,
    `https://www.youtube.com/live/${ID}?feature=share`,
    `https://www.youtube.com/embed/${ID}`,
    `https://www.youtube-nocookie.com/embed/${ID}`,
    `https://www.youtube.com/shorts/${ID}`,
  ])("extracts the id from %s", (url) => {
    expect(parseYouTubeId(url)).toBe(ID);
  });

  it.each([
    "https://evil.example/watch?v=dQw4w9WgXcQ",
    "https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ",
    "https://www.youtube.com/watch?v=short",
    "https://www.youtube.com/watch",
    "https://www.youtube.com/channel/UC123456789",
    "javascript:alert(1)",
    "_public-assets/photo.jpg",
    "",
    undefined,
  ])("rejects %s", (url) => {
    expect(parseYouTubeId(url)).toBeNull();
  });
});

describe("url builders", () => {
  it("builds the canonical watch URL", () => {
    expect(youtubeWatchUrl(ID)).toBe(`https://www.youtube.com/watch?v=${ID}`);
  });

  it("embeds via the privacy-enhanced domain", () => {
    expect(youtubeEmbedUrl(ID)).toBe(
      `https://www.youtube-nocookie.com/embed/${ID}?autoplay=1&rel=0`,
    );
  });
});
