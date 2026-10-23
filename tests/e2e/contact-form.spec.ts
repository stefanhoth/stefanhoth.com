import { expect, test } from "@playwright/test";

// Set (e.g. by the preview-deploy workflow) to run against a deployed Worker
// instead of the local preview server — see playwright.config.ts.
const REMOTE = Boolean(process.env.E2E_BASE_URL);

test("renders the form with a working Turnstile widget and enabled submit button", async ({
  page,
}) => {
  test.skip(
    REMOTE,
    "Deployed previews use the real sitekey, and the real Turnstile refuses to issue tokens to headless CI browsers — the remote variant below covers widget loading instead",
  );

  await page.goto("/");

  // The test sitekey resolves invisibly (no iframe) but populates the hidden
  // response token once solved — that's what proves the widget actually ran.
  const tokenInput = page.locator('input[name="cf-turnstile-response"]');
  await expect(tokenInput).toHaveValue(/\S+/, { timeout: 10_000 });
  await expect(page.locator('#contact button[type="submit"]')).toBeEnabled();
  await expect(page.locator("#contact-status")).toBeHidden();
});

test("renders the form and the real Turnstile widget loads without errors", async ({
  page,
}) => {
  test.skip(
    !REMOTE,
    "Remote-only variant: needs a deployed Worker with the real sitekey",
  );

  await page.goto("/");

  // The hidden response input is injected by the Turnstile script when the
  // widget renders — proof the script loaded and accepted the hostname. A
  // widget error (e.g. hostname not allowed) would surface the status banner
  // via the error callback instead.
  const tokenInput = page.locator('input[name="cf-turnstile-response"]');
  await expect(tokenInput).toBeAttached({ timeout: 10_000 });
  await expect(page.locator("#contact-status")).toBeHidden();
});

test("shows a success banner and cleans the URL for ?sent=true", async ({
  page,
}) => {
  await page.goto("/?sent=true");

  const status = page.locator("#contact-status");
  await expect(status).toBeVisible();
  await expect(status).toContainText("Thanks for your message");
  await expect(page).toHaveURL(/\/$/);
});

test("shows an error banner and cleans the URL for ?error=true", async ({
  page,
}) => {
  await page.goto("/?error=true");

  const status = page.locator("#contact-status");
  await expect(status).toBeVisible();
  await expect(status).toContainText("Something went wrong");
  await expect(page).toHaveURL(/\/$/);
});

test("disables submit and warns when the Turnstile script fails to load", async ({
  page,
}) => {
  await page.route(
    "**/challenges.cloudflare.com/turnstile/v0/api.js",
    (route) => route.abort(),
  );

  await page.goto("/");

  const status = page.locator("#contact-status");
  await expect(status).toBeVisible({ timeout: 10_000 });
  await expect(status).toContainText("Bot protection failed to load");
  await expect(page.locator('#contact button[type="submit"]')).toBeDisabled();
});
