import { expect, test } from "@playwright/test";

// Social sharing previews (LinkedIn, Slack, WhatsApp, X, …) are built from
// the Open Graph / Twitter Card meta tags Layout.astro emits. Each page
// must carry its own canonical URL (the HTML URL, not the `.md` twin) and
// its own pre-rendered 1200×630 card from public/img/og/
// (scripts/generate-og-images.mjs).
const PAGES = [
  {
    path: "/",
    canonical: "https://stefanhoth.com/",
    image: "https://stefanhoth.com/img/og/home.png",
  },
  {
    path: "/manager-readme",
    canonical: "https://stefanhoth.com/manager-readme",
    image: "https://stefanhoth.com/img/og/manager-readme.png",
  },
  {
    path: "/employee-readme",
    canonical: "https://stefanhoth.com/employee-readme",
    image: "https://stefanhoth.com/img/og/employee-readme.png",
  },
  {
    path: "/projects",
    canonical: "https://stefanhoth.com/projects",
    image: "https://stefanhoth.com/img/og/projects.png",
  },
];

for (const { path, canonical, image } of PAGES) {
  test(`${path} carries the social preview meta tags`, async ({ page }) => {
    await page.goto(path);

    const content = (selector: string) =>
      page.locator(selector).getAttribute("content");

    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      canonical,
    );
    expect(await content('meta[property="og:url"]')).toBe(canonical);
    expect(await content('meta[property="og:image"]')).toBe(image);
    expect(await content('meta[property="og:title"]')).toBeTruthy();
    expect(await content('meta[property="og:description"]')).toBeTruthy();
    expect(await content('meta[name="twitter:card"]')).toBe(
      "summary_large_image",
    );
  });

  test(`${path} social preview image is served`, async ({ request }) => {
    const response = await request.get(new URL(image).pathname);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/png");
  });
}
