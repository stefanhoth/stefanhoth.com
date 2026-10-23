import { describe, expect, it, vi } from "vitest";

// The Worker pulls in the contact handler, which needs the Workers runtime.
vi.mock("../../functions/smtp.js", () => ({ sendMailViaSmtp: vi.fn() }));
const { default: worker } = await import("../../worker/index.js");

const BROWSER =
  "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";
const AGENT = "text/markdown, text/html;q=0.8";

// Stands in for the static asset layer: what `astro build` leaves in dist/.
const FILES = {
  "/_pages.json": ["index", "projects"],
  "/index.html": "<html>home</html>",
  "/index.md": "# Home",
  "/projects.html": "<html>projects</html>",
  "/projects.md": "# Projects",
  "/_public-assets/talk.pdf": "pdf",
};

const env = {
  ASSETS: {
    async fetch(input) {
      const { pathname } = new URL(
        input instanceof Request ? input.url : input,
      );
      const key = /\.\w+$/.test(pathname)
        ? pathname
        : `${pathname === "/" ? "/index" : pathname}.html`;
      const file = FILES[key];
      if (file === undefined) return new Response("not found", { status: 404 });
      if (typeof file !== "string") return Response.json(file);
      const type = key.endsWith(".html") ? "text/html" : "text/plain";
      return new Response(file, { headers: { "Content-Type": type } });
    },
  },
};

function get(path, accept, method = "GET") {
  const headers = accept === undefined ? {} : { Accept: accept };
  return worker.fetch(
    new Request(`https://example.com${path}`, { method, headers }),
    env,
  );
}

async function expectRedirect(response, status, location) {
  expect(response.status).toBe(status);
  expect(new URL(response.headers.get("Location"), "https://x").pathname).toBe(
    location,
  );
}

describe("content matches the URL when the client has no preference", () => {
  for (const accept of [undefined, "*/*", "text/plain"]) {
    it(`serves html at /projects and markdown at /projects.md (Accept: ${accept})`, async () => {
      const html = await get("/projects", accept);
      expect(html.status).toBe(200);
      expect(html.headers.get("Content-Type")).toContain("text/html");
      expect(await html.text()).toBe("<html>projects</html>");

      const markdown = await get("/projects.md", accept);
      expect(markdown.status).toBe(200);
      expect(markdown.headers.get("Content-Type")).toBe(
        "text/markdown; charset=utf-8",
      );
      expect(await markdown.text()).toBe("# Projects");
    });
  }

  it("serves the homepage as html at / and markdown at /index.md", async () => {
    expect((await get("/")).headers.get("Content-Type")).toContain("text/html");
    expect((await get("/index.md")).headers.get("Content-Type")).toContain(
      "text/markdown",
    );
  });

  it("drops the trailing slash permanently", async () => {
    await expectRedirect(await get("/projects/", "*/*"), 301, "/projects");
  });
});

describe("redirects to the URL that fits the preferred format", () => {
  it("sends markdown-preferring clients from html URLs to .md", async () => {
    await expectRedirect(await get("/projects", AGENT), 307, "/projects.md");
    await expectRedirect(await get("/projects", AGENT), 307, "/projects.md");
    await expectRedirect(await get("/", AGENT), 307, "/index.md");
  });

  it("sends html-preferring clients (browsers) from .md URLs to html", async () => {
    await expectRedirect(await get("/projects.md", BROWSER), 307, "/projects");
    await expectRedirect(await get("/index.md", BROWSER), 307, "/");
  });

  it("does not redirect when URL and preference already agree", async () => {
    expect((await get("/projects", BROWSER)).status).toBe(200);
    expect((await get("/projects.md", AGENT)).status).toBe(200);
  });

  it("keeps the query string and marks the response as varying by Accept", async () => {
    const response = await get("/projects?a=1", AGENT);
    expect(response.headers.get("Location")).toBe("/projects.md?a=1");
    expect(response.headers.get("Vary")).toBe("Accept");
  });

  it("never loops: following a redirect lands on a 200", async () => {
    for (const accept of [BROWSER, AGENT, "*/*", undefined]) {
      for (const path of [
        "/projects",
        "/projects/",
        "/projects.md",
        "/",
        "/index.md",
      ]) {
        let response = await get(path, accept);
        let hops = 0;
        while (response.status >= 300 && response.status < 400) {
          response = await get(response.headers.get("Location"), accept);
          hops += 1;
        }
        expect(response.status).toBe(200);
        expect(hops).toBeLessThanOrEqual(2);
      }
    }
  });
});

describe("page responses", () => {
  it("advertises the other representation and varies by Accept", async () => {
    const html = await get("/projects", BROWSER);
    expect(html.headers.get("Vary")).toBe("Accept");
    expect(html.headers.get("Link")).toBe(
      '</projects.md>; rel="alternate"; type="text/markdown"',
    );

    const markdown = await get("/projects.md", AGENT);
    expect(markdown.headers.get("Vary")).toBe("Accept");
    expect(markdown.headers.get("Link")).toBe(
      '</projects>; rel="canonical"; type="text/html"',
    );
  });

  it("keeps the security headers on page responses and redirects", async () => {
    for (const response of [
      await get("/projects", BROWSER),
      await get("/projects.md", AGENT),
      await get("/projects", AGENT),
    ]) {
      expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    }
  });

  it("answers HEAD like GET", async () => {
    const response = await get("/projects.md", AGENT, "HEAD");
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/markdown");
  });
});

describe("everything else", () => {
  it("404s unknown pages and does not expose the build manifest", async () => {
    expect((await get("/nope/", AGENT)).status).toBe(404);
    expect((await get("/nope.md", AGENT)).status).toBe(404);
    expect((await get("/_pages.json")).status).toBe(404);
  });

  it("passes static assets through untouched, whatever the Accept header", async () => {
    const response = await get("/_public-assets/talk.pdf", AGENT);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("pdf");
  });
});
