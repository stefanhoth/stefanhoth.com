import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendMailViaSmtp = vi.fn();

vi.mock("../../functions/smtp.js", () => ({
  sendMailViaSmtp: (...args) => sendMailViaSmtp(...args),
}));

const { onRequestPost } = await import("../../functions/contact.js");

function buildEnv() {
  return {
    TURNSTILE_SECRET_KEY: "test-secret",
    MAILSENDER_SMTP_USER: "user@example.com",
    MAILSENDER_SMTP_PASS: "password",
  };
}

function buildRequest(overrides = {}) {
  const fields = {
    "cf-turnstile-response": "test-token",
    name: "Jane Doe",
    email: "jane@example.com",
    message: "Hello there",
    ...overrides,
  };
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) formData.set(key, value);
  }
  return new Request("https://example.com/contact", {
    method: "POST",
    body: formData,
  });
}

function mockTurnstileVerify(success) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ json: async () => ({ success }) }),
  );
}

describe("onRequestPost", () => {
  beforeEach(() => {
    sendMailViaSmtp.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("redirects to /?error=true when Turnstile verification fails", async () => {
    mockTurnstileVerify(false);

    const response = await onRequestPost({
      request: buildRequest(),
      env: buildEnv(),
    });

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://example.com/?error=true",
    );
    expect(sendMailViaSmtp).not.toHaveBeenCalled();
  });

  it("redirects to /?error=true when a required field is missing", async () => {
    mockTurnstileVerify(true);

    const response = await onRequestPost({
      request: buildRequest({ message: "" }),
      env: buildEnv(),
    });

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://example.com/?error=true",
    );
    expect(sendMailViaSmtp).not.toHaveBeenCalled();
  });

  it("redirects to /?error=true when sending the email fails", async () => {
    mockTurnstileVerify(true);
    sendMailViaSmtp.mockRejectedValue(new Error("SMTP down"));

    const response = await onRequestPost({
      request: buildRequest(),
      env: buildEnv(),
    });

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://example.com/?error=true",
    );
  });

  it("redirects to /?error=true when name contains a CRLF (header injection attempt)", async () => {
    mockTurnstileVerify(true);

    const response = await onRequestPost({
      request: buildRequest({ name: "Bob\r\nBcc: attacker@example.com" }),
      env: buildEnv(),
    });

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://example.com/?error=true",
    );
    expect(sendMailViaSmtp).not.toHaveBeenCalled();
  });

  it("redirects to /?error=true when email contains a CRLF (header injection attempt)", async () => {
    mockTurnstileVerify(true);

    const response = await onRequestPost({
      request: buildRequest({
        email: "jane@example.com\r\nBcc: attacker@example.com",
      }),
      env: buildEnv(),
    });

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://example.com/?error=true",
    );
    expect(sendMailViaSmtp).not.toHaveBeenCalled();
  });

  it("redirects to /?error=true when a field exceeds its maximum length", async () => {
    mockTurnstileVerify(true);

    const response = await onRequestPost({
      request: buildRequest({ message: "x".repeat(5001) }),
      env: buildEnv(),
    });

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://example.com/?error=true",
    );
    expect(sendMailViaSmtp).not.toHaveBeenCalled();
  });

  it("redirects to /?error=true when the name exceeds its maximum length", async () => {
    mockTurnstileVerify(true);

    const response = await onRequestPost({
      request: buildRequest({ name: "x".repeat(201) }),
      env: buildEnv(),
    });

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://example.com/?error=true",
    );
    expect(sendMailViaSmtp).not.toHaveBeenCalled();
  });

  it("redirects to /?error=true when the body is not form data", async () => {
    mockTurnstileVerify(true);

    const request = new Request("https://example.com/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Jane" }),
    });
    const response = await onRequestPost({ request, env: buildEnv() });

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://example.com/?error=true",
    );
    expect(sendMailViaSmtp).not.toHaveBeenCalled();
  });

  it("redirects to /?error=true when the Turnstile siteverify call throws (fails closed)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("siteverify down")),
    );

    const response = await onRequestPost({
      request: buildRequest(),
      env: buildEnv(),
    });

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://example.com/?error=true",
    );
    expect(sendMailViaSmtp).not.toHaveBeenCalled();
  });

  it("escapes the message in the HTML body and redirects to /?sent=true on success", async () => {
    mockTurnstileVerify(true);
    sendMailViaSmtp.mockResolvedValue(undefined);

    const response = await onRequestPost({
      request: buildRequest({ message: "Hi <script>alert(1)</script>" }),
      env: buildEnv(),
    });

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://example.com/?sent=true",
    );

    expect(sendMailViaSmtp).toHaveBeenCalledTimes(1);
    const mailArgs = sendMailViaSmtp.mock.calls[0][0];
    expect(mailArgs.to).toBe("website-form@stefanhoth.de");
    expect(mailArgs.replyTo).toBe("jane@example.com");
    expect(mailArgs.text).toContain("Hi <script>alert(1)</script>");
    expect(mailArgs.html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(mailArgs.html).not.toContain("<script>alert(1)</script>");
  });
});
