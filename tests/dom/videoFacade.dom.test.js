// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { initVideoFacades } from "../../src/lib/videoFacade.js";

const ID = "dQw4w9WgXcQ";

function render(id = ID) {
  document.body.innerHTML = `
    <figure class="video" data-video-id="${id}">
      <a class="video-poster" href="https://www.youtube.com/watch?v=${id}">
        <span class="video-title">My talk</span>
      </a>
    </figure>`;
  return document.querySelector("figure");
}

const click = (target, init = {}) => {
  const event = new MouseEvent("click", {
    bubbles: true,
    cancelable: true,
    button: 0,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
};

describe("initVideoFacades", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("replaces the poster with a youtube-nocookie iframe on click", () => {
    const figure = render();
    initVideoFacades(document);

    const event = click(figure.querySelector("a"));

    expect(event.defaultPrevented).toBe(true);
    const iframe = figure.querySelector("iframe");
    expect(iframe.src).toBe(
      `https://www.youtube-nocookie.com/embed/${ID}?autoplay=1&rel=0`,
    );
    expect(iframe.title).toBe("My talk");
    expect(iframe.allowFullscreen).toBe(true);
    expect(iframe.referrerPolicy).toBe("strict-origin-when-cross-origin");
    expect(figure.querySelector("a")).toBeNull();
    expect(figure.classList.contains("is-playing")).toBe(true);
  });

  it("lets modified clicks open the link normally", () => {
    const figure = render();
    initVideoFacades(document);

    const event = click(figure.querySelector("a"), { ctrlKey: true });

    expect(event.defaultPrevented).toBe(false);
    expect(figure.querySelector("iframe")).toBeNull();
  });

  it("falls back to the link when the video id is invalid", () => {
    const figure = render("nope");
    initVideoFacades(document);

    const event = click(figure.querySelector("a"));

    expect(event.defaultPrevented).toBe(false);
    expect(figure.querySelector("iframe")).toBeNull();
  });

  it("ignores clicks elsewhere", () => {
    render();
    document.body.insertAdjacentHTML("beforeend", '<a id="x" href="#">x</a>');
    initVideoFacades(document);

    const event = click(document.getElementById("x"));

    expect(event.defaultPrevented).toBe(false);
    expect(document.querySelector("iframe")).toBeNull();
  });
});
