// YouTube URL helpers shared by the build (rehypeYouTube, agentMarkdown) and
// the browser (videoFacade). Only a strict set of hosts counts as YouTube, so
// an arbitrary `![](https://evil.example/watch?v=…)` is never turned into an
// embed.

const VIDEO_ID = /^[\w-]{11}$/;
const LONG_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);
// Path prefixes that carry the id as the next segment: /live/<id> etc.
const ID_PREFIXES = new Set(["live", "embed", "shorts", "v"]);

export function isVideoId(value) {
  return typeof value === "string" && VIDEO_ID.test(value);
}

// Returns the 11-character video id for the common URL shapes
// (watch?v=, youtu.be/, /live/, /embed/, /shorts/), or null.
export function parseYouTubeId(href) {
  let url;
  try {
    url = new URL(String(href).trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const host = url.hostname.toLowerCase();
  const segments = url.pathname.split("/").filter(Boolean);
  let id = null;

  if (host === "youtu.be") {
    id = segments[0];
  } else if (LONG_HOSTS.has(host)) {
    if (segments[0] === "watch") id = url.searchParams.get("v");
    else if (ID_PREFIXES.has(segments[0])) id = segments[1];
  }
  return isVideoId(id) ? id : null;
}

export const youtubeWatchUrl = (id) =>
  `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;

// Privacy-enhanced domain; `rel=0` limits suggestions to the same channel.
export const youtubeEmbedUrl = (id) =>
  `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0`;
