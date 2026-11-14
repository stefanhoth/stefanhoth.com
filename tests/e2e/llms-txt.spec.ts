import { expect, test } from "@playwright/test";

// llms.txt (https://llmstxt.org/) is a static file served straight out of
// public/ — no Worker involvement — so it works against both the local
// `astro preview` server and a real deployment.
test("/llms.txt is served with the expected llms.txt structure", async ({
  request,
}) => {
  const response = await request.get("/llms.txt");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("text/plain");
  expect(response.headers()["content-type"]).toContain("charset=utf-8");

  const body = await response.text();
  expect(body).toMatch(/^# Stefan Hoth\n/);
  expect(body).toContain("\n> ");
  expect(body).toContain("## Pages");
  expect(body).toContain("(https://stefanhoth.com/manager-readme.md)");
  expect(body).toContain("(https://stefanhoth.com/talks.md)");
  expect(body).toContain("(https://stefanhoth.com/employee-readme.md)");
  expect(body).toContain("(https://stefanhoth.com/projects.md)");
});
