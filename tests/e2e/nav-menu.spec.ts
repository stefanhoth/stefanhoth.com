import { expect, test } from "@playwright/test";

// "About me" (How I show up + How I manage) is the dropdown group that is
// always populated from the published vault pages.
const GROUP = "About me";

const header = (page) => page.locator(".site-header");
const trigger = (page) =>
  page.getByRole("button", { name: GROUP, exact: true });
const panel = (page) => page.locator("#nav-panel-0");

async function layoutSnapshot(page) {
  return page.evaluate(() => ({
    headerHeight: document.querySelector(".site-header").offsetHeight,
    mainTop: document.querySelector("main").getBoundingClientRect().top,
    triggerLeft: document
      .querySelector("[data-nav-trigger]")
      .getBoundingClientRect().left,
    scrollWidth: document.documentElement.scrollWidth,
  }));
}

test.describe("desktop (mouse)", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("opens on hover, stays open while moving to the panel, closes on leave", async ({
    page,
  }) => {
    await page.goto("/projects/");
    await expect(panel(page)).toBeHidden();

    await trigger(page).hover();
    await expect(panel(page)).toBeVisible();

    // Travel down into the list through the gap below the trigger.
    await panel(page).getByRole("link").first().hover();
    await expect(panel(page)).toBeVisible();

    await page.mouse.move(640, 500);
    await expect(panel(page)).toBeHidden();
  });

  test("a click on the hover-opened trigger keeps the menu open, a second click closes it", async ({
    page,
  }) => {
    await page.goto("/projects/");

    await trigger(page).hover();
    await trigger(page).click();
    await expect(panel(page)).toBeVisible();

    await page.mouse.move(640, 500);
    await expect(panel(page)).toBeVisible();

    await trigger(page).click();
    await expect(panel(page)).toBeHidden();
  });

  test("Escape closes the menu and focuses the trigger", async ({ page }) => {
    await page.goto("/projects/");
    await trigger(page).focus();
    await page.keyboard.press("Enter");
    await expect(panel(page)).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(panel(page)).toBeHidden();
    await expect(trigger(page)).toBeFocused();
  });

  test("opening the menu doesn't move anything", async ({ page }) => {
    await page.goto("/projects/");
    const before = await layoutSnapshot(page);

    await trigger(page).click();
    await expect(panel(page)).toBeVisible();

    expect(await layoutSnapshot(page)).toEqual(before);
  });
});

test.describe("phone (touch)", () => {
  test.use({
    viewport: { width: 360, height: 640 },
    hasTouch: true,
    isMobile: true,
  });

  test("header stays on one row, also on the home page", async ({ page }) => {
    for (const path of ["/", "/projects/"]) {
      await page.goto(path);
      const rows = await page
        .locator(".site-header nav > *")
        .evaluateAll(
          (els) =>
            new Set(els.map((el) => Math.round(el.getBoundingClientRect().top)))
              .size,
        );
      expect(rows, path).toBe(1);
    }
  });

  test("tap opens a full-width sheet without shifting the page; tapping outside closes it", async ({
    page,
  }) => {
    await page.goto("/");
    const before = await layoutSnapshot(page);

    await trigger(page).tap();
    await expect(panel(page)).toBeVisible();
    expect(await layoutSnapshot(page)).toEqual(before);

    const box = await panel(page).boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(360);

    // A tap anywhere outside closes the sheet again.
    await page.locator("main").tap({ position: { x: 20, y: 300 } });
    await expect(panel(page)).toBeHidden();
  });

  test("a link in the sheet navigates", async ({ page }) => {
    await page.goto("/");
    await trigger(page).tap();
    await panel(page).getByRole("link", { name: "How I manage" }).tap();
    await expect(page).toHaveURL(/manager-readme/);
  });

  test("tap targets in the sheet are at least 44px tall", async ({ page }) => {
    await page.goto("/");
    await trigger(page).tap();
    for (const link of await panel(page).getByRole("link").all()) {
      expect((await link.boundingBox()).height).toBeGreaterThanOrEqual(44);
    }
  });
});

test("the header never causes horizontal scroll", async ({ page }) => {
  for (const width of [320, 360, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 700 });
    await page.goto("/projects/");
    await trigger(page).click();
    const { scrollWidth } = await layoutSnapshot(page);
    expect(scrollWidth, `${width}px`).toBeLessThanOrEqual(width);
    await expect(header(page)).toBeVisible();
  }
});
