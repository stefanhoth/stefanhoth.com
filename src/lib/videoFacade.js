// Click-to-load behaviour for the video facades built by rehypeYouTube.js.
// Extracted so it can be jsdom tested (tests/dom/videoFacade.dom.test.js).
//
// One delegated click listener: a plain left-click on a poster replaces it
// with a youtube-nocookie iframe that autoplays. Modified clicks (new tab,
// etc.) and clicks without JavaScript keep the poster's normal link to YouTube.

import { isVideoId, youtubeEmbedUrl } from "./youtube.js";

export function createPlayer(figure) {
  const id = figure.dataset.videoId;
  if (!isVideoId(id)) return null;

  const title =
    figure.querySelector(".video-title")?.textContent?.trim() || "Video";
  const iframe = figure.ownerDocument.createElement("iframe");
  iframe.src = youtubeEmbedUrl(id);
  iframe.title = title;
  iframe.allow =
    "autoplay; encrypted-media; picture-in-picture; fullscreen; web-share";
  iframe.allowFullscreen = true;
  // YouTube refuses to play embeds that arrive without a referrer.
  iframe.referrerPolicy = "strict-origin-when-cross-origin";
  return iframe;
}

export function initVideoFacades(root = document) {
  root.addEventListener("click", (event) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    const poster = event.target.closest?.("figure.video a.video-poster");
    if (!poster) return;

    const figure = poster.closest("figure.video");
    const iframe = createPlayer(figure);
    if (!iframe) return; // invalid id: let the link navigate

    event.preventDefault();
    figure.replaceChildren(iframe);
    figure.classList.add("is-playing");
    iframe.focus();
  });
}
