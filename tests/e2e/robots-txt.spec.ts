import { expect, test } from "@playwright/test";

// robots.txt is a static file served straight out of public/ — no Worker
// involvement — so it works against both the local `astro preview` server
// and a real deployment.
test("/robots.txt declares content signals and keeps crawling open", async ({
  request,
}) => {
  const response = await request.get("/robots.txt");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("text/plain");

  const body = await response.text();
  expect(body).toContain(
    "Content-Signal: search=yes, ai-input=yes, ai-train=no",
  );
  expect(body).toMatch(/^User-agent: \*$/m);
  expect(body).toMatch(/^Allow: \/$/m);
  expect(body).toContain("Sitemap: https://stefanhoth.com/sitemap.xml");
});
