import { expect, test } from "@playwright/test";

// Every page exists as HTML at /<slug>/ and as Markdown at /<slug>.md, and
// the Cloudflare Worker (worker/index.js) keeps content and URL in line,
// redirecting based on the Accept header. `astro preview` never runs that
// Worker, so these only make sense against a real deployment.
test.skip(
  !process.env.E2E_BASE_URL,
  "Content negotiation is done by the Cloudflare Worker, which the local `astro preview` server doesn't run",
);

const BROWSER =
  "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";
const AGENT = "text/markdown, text/html;q=0.8";

const PAGES = [
  { html: "/", markdown: "/index.md" },
  { html: "/employee-readme/", markdown: "/employee-readme.md" },
  { html: "/manager-readme/", markdown: "/manager-readme.md" },
  { html: "/projects/", markdown: "/projects.md" },
];

for (const { html, markdown } of PAGES) {
  test.describe(`${html} / ${markdown}`, () => {
    test("HTML URL serves HTML without a preference", async ({ request }) => {
      const response = await request.get(html, {
        headers: { Accept: "*/*" },
        maxRedirects: 0,
      });
      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toContain("text/html");
      expect(response.headers().vary).toContain("Accept");
    });

    test("Markdown URL serves Markdown without a preference", async ({
      request,
    }) => {
      const response = await request.get(markdown, {
        headers: { Accept: "*/*" },
        maxRedirects: 0,
      });
      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toContain("text/markdown");
      expect(response.headers().vary).toContain("Accept");
      expect(await response.text()).toMatch(/^# \S/);
    });

    test("HTML URL redirects clients asking for Markdown", async ({
      request,
    }) => {
      const response = await request.get(html, {
        headers: { Accept: AGENT },
        maxRedirects: 0,
      });
      expect(response.status()).toBe(307);
      expect(response.headers().location).toBe(markdown);
    });

    test("Markdown URL redirects browsers to the HTML page", async ({
      request,
    }) => {
      const response = await request.get(markdown, {
        headers: { Accept: BROWSER },
        maxRedirects: 0,
      });
      expect(response.status()).toBe(307);
      expect(response.headers().location).toBe(html);
    });

    test("a browser opening the Markdown URL lands on the rendered page", async ({
      page,
    }) => {
      const response = await page.goto(markdown);
      expect(response?.url()).toMatch(new RegExp(`${html}$`));
      expect(response?.headers()["content-type"]).toContain("text/html");
      await expect(page.locator("main")).toBeVisible();
    });
  });
}

for (const slug of ["employee-readme", "manager-readme", "projects"]) {
  test(`/${slug} completes to /${slug}/`, async ({ request }) => {
    const response = await request.get(`/${slug}`, {
      headers: { Accept: "*/*" },
      maxRedirects: 0,
    });
    expect(response.status()).toBe(301);
    expect(response.headers().location).toBe(`/${slug}/`);
  });
}

test("the build manifest and unknown .md URLs are not served", async ({
  request,
}) => {
  expect((await request.get("/_pages.json")).status()).toBe(404);
  expect((await request.get("/nope.md")).status()).toBe(404);
});
