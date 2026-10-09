// Open/close behaviour for the header's dropdown groups (SiteHeader.astro).
// Extracted so the logic can be jsdom tested directly (tests/dom/navMenu.dom.test.js).
//
// Markup contract: every `[data-nav-group]` holds one `[data-nav-trigger]`
// button (carries aria-expanded) and a panel of links. The open state is the
// `data-open` attribute on the group; the panel itself is out of flow
// (position: absolute), so opening never moves anything on the page.
//
// - Mouse: hovering opens, leaving closes after a short delay (so the
//   pointer can cross the gap to the panel). Clicking while it is only
//   hover-open pins it, so a click never flips an already visible menu shut.
// - Touch / keyboard: the trigger toggles. Touch and pen never open on hover,
//   which would otherwise fire a phantom open right before the tap's click.
// - Closes on Escape (focus returns to the trigger), on a press outside, when
//   focus leaves the group, and when the page is restored from bfcache.

export const HOVER_CLOSE_DELAY_MS = 150;

export function initNavMenu(nav, { win = window } = {}) {
  const doc = nav.ownerDocument;
  const groups = [...nav.querySelectorAll("[data-nav-group]")].map((el) => ({
    el,
    trigger: el.querySelector("[data-nav-trigger]"),
    pinned: false,
    timer: null,
  }));

  const isOpen = (group) => group.el.hasAttribute("data-open");

  function close(group) {
    win.clearTimeout(group.timer);
    group.pinned = false;
    group.el.removeAttribute("data-open");
    group.trigger.setAttribute("aria-expanded", "false");
  }

  function open(group, { pinned }) {
    win.clearTimeout(group.timer);
    for (const other of groups) if (other !== group) close(other);
    group.pinned = pinned;
    group.el.setAttribute("data-open", "");
    group.trigger.setAttribute("aria-expanded", "true");
  }

  const closeAll = () => {
    for (const group of groups) close(group);
  };

  for (const group of groups) {
    group.el.addEventListener("pointerenter", (event) => {
      if (event.pointerType !== "mouse") return;
      win.clearTimeout(group.timer);
      if (!isOpen(group)) open(group, { pinned: false });
    });

    group.el.addEventListener("pointerleave", (event) => {
      if (event.pointerType !== "mouse" || group.pinned) return;
      win.clearTimeout(group.timer);
      group.timer = win.setTimeout(() => close(group), HOVER_CLOSE_DELAY_MS);
    });

    group.trigger.addEventListener("click", () => {
      if (!isOpen(group)) open(group, { pinned: true });
      else if (!group.pinned) group.pinned = true;
      else close(group);
    });

    group.el.addEventListener("focusout", (event) => {
      if (isOpen(group) && !group.el.contains(event.relatedTarget)) {
        close(group);
      }
    });

    group.el.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || !isOpen(group)) return;
      close(group);
      group.trigger.focus();
    });
  }

  doc.addEventListener("pointerdown", (event) => {
    for (const group of groups) {
      if (isOpen(group) && !group.el.contains(event.target)) close(group);
    }
  });

  win.addEventListener("pageshow", closeAll);

  return { closeAll };
}
