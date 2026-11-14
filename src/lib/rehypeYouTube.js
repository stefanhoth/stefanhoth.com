// Rehype plugin: a paragraph that holds nothing but an image whose URL is a
// YouTube video — `![Recording title](https://youtu.be/<id>)`, which Obsidian
// renders as an embedded player — becomes a click-to-load video facade:
//
//   <figure class="video" data-video-id="<id>">
//     <a class="video-poster" href="<watch url>"> play button, title, hint </a>
//   </figure>
//
// Nothing is requested from YouTube/Google until the visitor clicks: the
// poster is plain markup, and src/lib/videoFacade.js swaps it for a
// youtube-nocookie iframe on click. Without JavaScript the poster is simply a
// link to the video. Runs on every template; wherever the paragraph sits in
// the page (e.g. under an h3 in a project card) decides where the player shows.

import { parseYouTubeId, youtubeWatchUrl } from "./youtube.js";

const DEFAULT_TITLE = "Watch the recording";

const text = (value) => ({ type: "text", value });
const el = (tagName, properties, children = []) => ({
  type: "element",
  tagName,
  properties,
  children,
});

// The image of a paragraph that contains only that image, else null.
function soleImage(node) {
  if (node?.type !== "element" || node.tagName !== "p") return null;
  const children = node.children.filter(
    (child) => child.type !== "text" || child.value.trim() !== "",
  );
  return children.length === 1 && children[0].tagName === "img"
    ? children[0]
    : null;
}

function toFigure(id, alt) {
  const title = alt.trim() || DEFAULT_TITLE;
  return el("figure", { className: ["video"], dataVideoId: id }, [
    el(
      "a",
      {
        className: ["video-poster"],
        href: youtubeWatchUrl(id),
        rel: ["noopener"],
        ariaLabel: `Play video: ${title}`,
      },
      [
        el("span", { className: ["video-play"], ariaHidden: "true" }),
        el("span", { className: ["video-title"] }, [text(title)]),
        el("span", { className: ["video-hint"] }, [
          text("The player loads from YouTube once you click."),
        ]),
      ],
    ),
  ]);
}

function transform(node) {
  const children = node.children;
  if (!children) return;
  for (let i = 0; i < children.length; i++) {
    const image = soleImage(children[i]);
    const id = image && parseYouTubeId(image.properties?.src);
    if (id) {
      children[i] = toFigure(id, String(image.properties.alt ?? ""));
    } else {
      transform(children[i]);
    }
  }
}

export default function rehypeYouTube() {
  return (tree) => transform(tree);
}
