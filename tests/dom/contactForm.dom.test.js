// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { initContactForm } from "../../src/lib/contactForm.js";

function renderForm({ sitekey = "test-sitekey" } = {}) {
  document.body.innerHTML = `
    <form id="contact">
      <p id="contact-status" hidden></p>
      <div class="cf-turnstile" ${sitekey ? `data-sitekey="${sitekey}"` : ""}></div>
      <button type="submit">Let's go!</button>
    </form>
  `;
  return {
    form: document.getElementById("contact"),
    statusEl: document.getElementById("contact-status"),
    button: document.querySelector('#contact button[type="submit"]'),
  };
}

describe("initContactForm", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("disables the submit button and warns when the Turnstile sitekey is missing", () => {
    const { form, statusEl, button } = renderForm({ sitekey: "" });

    initContactForm({ form, statusEl, win: window });

    expect(button.disabled).toBe(true);
    expect(statusEl.hidden).toBe(false);
    expect(statusEl.className).toContain("contact-status--error");
    expect(statusEl.textContent).toMatch(/isn't fully set up/i);
  });

  it("leaves the submit button enabled when the sitekey is present", () => {
    const { form, statusEl, button } = renderForm();

    initContactForm({ form, statusEl, win: window });

    expect(button.disabled).toBe(false);
    expect(statusEl.hidden).toBe(true);
  });

  it("shows the success banner and cleans the URL for ?sent=true", () => {
    const { form, statusEl } = renderForm();
    const fakeWindow = {
      location: { pathname: "/", search: "?sent=true", hash: "" },
      history: {
        replaceState: (_state, _title, url) => {
          fakeWindow.location.search = new URL(
            url,
            "https://example.com",
          ).search;
        },
      },
      setTimeout: () => {},
      turnstile: {},
    };

    initContactForm({ form, statusEl, win: fakeWindow });

    expect(statusEl.hidden).toBe(false);
    expect(statusEl.className).toContain("contact-status--success");
    expect(statusEl.textContent).toMatch(/thanks for your message/i);
    expect(fakeWindow.location.search).toBe("");
  });

  it("disables submit and shows an error when the Turnstile error callback fires", () => {
    const { form, statusEl, button } = renderForm();

    initContactForm({ form, statusEl, win: window });
    window.onTurnstileError();

    expect(button.disabled).toBe(true);
    expect(statusEl.hidden).toBe(false);
    expect(statusEl.className).toContain("contact-status--error");
  });

  it("re-enables submit on a later Turnstile success after an error", () => {
    const { form, statusEl, button } = renderForm();

    initContactForm({ form, statusEl, win: window });
    window.onTurnstileError();
    window.onTurnstileSuccess();

    expect(button.disabled).toBe(false);
    expect(statusEl.hidden).toBe(true);
  });

  it("does not clear a real ?error=true submission banner when Turnstile later succeeds", () => {
    // Regression test: onTurnstileSuccess must only clear *its own* warning,
    // not an unrelated status banner rendered from the redirect query params.
    const { form, statusEl } = renderForm();
    const fakeWindow = {
      location: { pathname: "/", search: "?error=true", hash: "" },
      history: { replaceState: () => {} },
      setTimeout: () => {},
      turnstile: {},
    };

    initContactForm({ form, statusEl, win: fakeWindow });
    fakeWindow.onTurnstileSuccess();

    expect(statusEl.hidden).toBe(false);
    expect(statusEl.textContent).toMatch(/something went wrong/i);
  });

  it("falls back to an error state if the Turnstile script never loads", () => {
    const { form, statusEl, button } = renderForm();
    let timeoutCallback;
    const fakeWindow = {
      location: { pathname: "/", search: "", hash: "" },
      history: { replaceState: () => {} },
      setTimeout: (cb) => {
        timeoutCallback = cb;
      },
      turnstile: undefined,
    };

    initContactForm({
      form,
      statusEl,
      win: fakeWindow,
      turnstileLoadTimeoutMs: 8000,
    });
    expect(button.disabled).toBe(false);

    timeoutCallback();

    expect(button.disabled).toBe(true);
    expect(statusEl.textContent).toMatch(/bot protection failed to load/i);
  });
});
