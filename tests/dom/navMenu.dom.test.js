// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HOVER_CLOSE_DELAY_MS, initNavMenu } from "../../src/lib/navMenu.js";

function renderNav() {
  document.body.innerHTML = `
    <nav aria-label="Site">
      <div data-nav-group id="a">
        <button type="button" data-nav-trigger aria-expanded="false">About me</button>
        <div><a href="/one">One</a></div>
      </div>
      <div data-nav-group id="b">
        <button type="button" data-nav-trigger aria-expanded="false">About my work</button>
        <div><a href="/two">Two</a></div>
      </div>
      <a href="/plain" id="plain">Plain</a>
    </nav>
    <p id="outside">outside</p>
  `;
  const nav = document.querySelector("nav");
  initNavMenu(nav);
  const group = (id) => document.getElementById(id);
  return {
    a: group("a"),
    b: group("b"),
    triggerA: group("a").querySelector("button"),
    triggerB: group("b").querySelector("button"),
  };
}

const pointer = (target, type, pointerType) => {
  const event = new Event(type, { bubbles: type !== "pointerenter" });
  event.pointerType = pointerType;
  target.dispatchEvent(event);
};

const isOpen = (group) => group.hasAttribute("data-open");

describe("initNavMenu", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("toggles a group on trigger click and mirrors the state in aria-expanded", () => {
    const { a, triggerA } = renderNav();

    triggerA.click();
    expect(isOpen(a)).toBe(true);
    expect(triggerA.getAttribute("aria-expanded")).toBe("true");

    triggerA.click();
    expect(isOpen(a)).toBe(false);
    expect(triggerA.getAttribute("aria-expanded")).toBe("false");
  });

  it("keeps only one group open at a time", () => {
    const { a, b, triggerA, triggerB } = renderNav();

    triggerA.click();
    triggerB.click();

    expect(isOpen(a)).toBe(false);
    expect(isOpen(b)).toBe(true);
  });

  it("opens on mouse hover and closes after the delay", () => {
    const { a } = renderNav();

    pointer(a, "pointerenter", "mouse");
    expect(isOpen(a)).toBe(true);

    pointer(a, "pointerleave", "mouse");
    vi.advanceTimersByTime(HOVER_CLOSE_DELAY_MS - 1);
    expect(isOpen(a)).toBe(true);
    vi.advanceTimersByTime(1);
    expect(isOpen(a)).toBe(false);
  });

  it("stays open when the pointer comes back before the delay runs out", () => {
    const { a } = renderNav();

    pointer(a, "pointerenter", "mouse");
    pointer(a, "pointerleave", "mouse");
    vi.advanceTimersByTime(HOVER_CLOSE_DELAY_MS - 50);
    pointer(a, "pointerenter", "mouse");
    vi.advanceTimersByTime(HOVER_CLOSE_DELAY_MS);

    expect(isOpen(a)).toBe(true);
  });

  it("pins a hover-opened menu on click instead of closing it", () => {
    const { a, triggerA } = renderNav();

    pointer(a, "pointerenter", "mouse");
    triggerA.click();
    expect(isOpen(a)).toBe(true);

    pointer(a, "pointerleave", "mouse");
    vi.advanceTimersByTime(HOVER_CLOSE_DELAY_MS * 2);
    expect(isOpen(a)).toBe(true);

    triggerA.click();
    expect(isOpen(a)).toBe(false);
  });

  it("ignores touch and pen hover so a tap doesn't open then re-close", () => {
    const { a, triggerA } = renderNav();

    pointer(a, "pointerenter", "touch");
    expect(isOpen(a)).toBe(false);

    triggerA.click();
    expect(isOpen(a)).toBe(true);
    pointer(a, "pointerleave", "touch");
    vi.advanceTimersByTime(HOVER_CLOSE_DELAY_MS * 2);
    expect(isOpen(a)).toBe(true);
  });

  it("closes on a press outside, but not inside the group", () => {
    const { a, triggerA } = renderNav();
    triggerA.click();

    pointer(a.querySelector("a"), "pointerdown", "touch");
    expect(isOpen(a)).toBe(true);

    pointer(document.getElementById("outside"), "pointerdown", "touch");
    expect(isOpen(a)).toBe(false);
  });

  it("closes on Escape and returns focus to the trigger", () => {
    const { a, triggerA } = renderNav();
    triggerA.click();
    a.querySelector("a").focus();

    a.querySelector("a").dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );

    expect(isOpen(a)).toBe(false);
    expect(document.activeElement).toBe(triggerA);
  });

  it("closes when focus leaves the group, not when it moves within it", () => {
    const { a, triggerA } = renderNav();
    triggerA.click();

    a.dispatchEvent(
      new FocusEvent("focusout", {
        bubbles: true,
        relatedTarget: a.querySelector("a"),
      }),
    );
    expect(isOpen(a)).toBe(true);

    a.dispatchEvent(
      new FocusEvent("focusout", {
        bubbles: true,
        relatedTarget: document.getElementById("plain"),
      }),
    );
    expect(isOpen(a)).toBe(false);
  });

  it("closes everything when the page is restored from bfcache", () => {
    const { a, triggerA } = renderNav();
    triggerA.click();

    window.dispatchEvent(new Event("pageshow"));

    expect(isOpen(a)).toBe(false);
  });
});
