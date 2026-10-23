import { sendMailViaSmtp } from "./smtp.js";

const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const CONTACT_DESTINATION = "website-form@stefanhoth.de";
const CONTACT_SENDER = "website-form@stefanhoth.de";
const SMTP_HOST = "smtp.mailbox.org";
const SMTP_PORT = 465;

function escapeHtml(str) {
  return str.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}

// Values placed in email headers (Subject, Reply-To) must not contain CR/LF,
// or a submitter could inject arbitrary extra SMTP/MIME header lines.
function containsHeaderInjection(value) {
  return /[\r\n]/.test(value);
}

// Server-side size limits (the client-side maxlength attributes mirror these).
const MAX_LENGTHS = {
  name: 200,
  email: 320,
  phone: 100,
  website: 500,
  message: 5000,
};

function exceedsMaxLength(fields) {
  return Object.entries(MAX_LENGTHS).some(
    ([field, max]) => (fields[field]?.length ?? 0) > max,
  );
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const origin = new URL(request.url).origin;

  let formData;
  try {
    formData = await request.formData();
  } catch {
    // Not a form submission (wrong content type / malformed body).
    return Response.redirect(`${origin}/?error=true`, 303);
  }

  const token = formData.get("cf-turnstile-response");
  let turnstileOk = false;
  try {
    const verifyResponse = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: env.TURNSTILE_SECRET_KEY,
        response: token,
        remoteip: request.headers.get("CF-Connecting-IP"),
      }),
    });
    ({ success: turnstileOk } = await verifyResponse.json());
  } catch (err) {
    // Treat a siteverify outage as verification failure (fail closed).
    console.error("Turnstile verification failed", err);
  }

  const name = formData.get("name")?.toString().trim();
  const email = formData.get("email")?.toString().trim();
  const phone = formData.get("phone")?.toString().trim();
  const website = formData.get("website")?.toString().trim();
  const message = formData.get("message")?.toString().trim();

  if (
    !turnstileOk ||
    !name ||
    !email ||
    !message ||
    containsHeaderInjection(name) ||
    containsHeaderInjection(email) ||
    exceedsMaxLength({ name, email, phone, website, message })
  ) {
    return Response.redirect(`${origin}/?error=true`, 303);
  }

  const lines = [
    `Name: ${name}`,
    `Email: ${email}`,
    phone ? `Phone: ${phone}` : null,
    website ? `Website: ${website}` : null,
    "",
    message,
  ].filter((line) => line !== null);

  try {
    await sendMailViaSmtp({
      host: SMTP_HOST,
      port: SMTP_PORT,
      username: env.MAILSENDER_SMTP_USER,
      password: env.MAILSENDER_SMTP_PASS,
      to: CONTACT_DESTINATION,
      from: `"stefanhoth.com contact form" <${CONTACT_SENDER}>`,
      replyTo: email,
      subject: `New contact form message from ${name}`,
      text: lines.join("\n"),
      html: lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("\n"),
    });
  } catch (err) {
    console.error("Email send failed", err);
    return Response.redirect(`${origin}/?error=true`, 303);
  }

  return Response.redirect(`${origin}/?sent=true`, 303);
}
