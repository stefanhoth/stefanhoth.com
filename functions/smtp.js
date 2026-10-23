import { connect } from "cloudflare:sockets";

const EHLO_DOMAIN = "stefanhoth.com";

function encode(str) {
  return new TextEncoder().encode(str);
}

async function readResponse(reader) {
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) throw new Error("SMTP connection closed unexpectedly");
    buffer += new TextDecoder().decode(value, { stream: true });
    const lines = buffer.split("\r\n").filter((line) => line.length > 0);
    const last = lines[lines.length - 1];
    if (last && /^\d{3} /.test(last)) {
      return { code: Number(last.slice(0, 3)), text: buffer };
    }
  }
}

async function sendCommand(writer, reader, command) {
  await writer.write(encode(`${command}\r\n`));
  return readResponse(reader);
}

function assertCode(response, expectedCodes, step) {
  if (!expectedCodes.includes(response.code)) {
    throw new Error(
      `SMTP ${step} failed (${response.code}): ${response.text.trim()}`,
    );
  }
}

function buildMimeMessage({ from, to, replyTo, subject, text, html }) {
  const boundary = `----=_Boundary_${crypto.randomUUID()}`;
  return [
    `From: ${from}`,
    `To: ${to}`,
    ...(replyTo ? [`Reply-To: ${replyTo}`] : []),
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    text,
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=utf-8",
    "",
    html,
    "",
    `--${boundary}--`,
  ].join("\r\n");
}

// RFC 5321 transparency: lines starting with "." must be escaped with an extra "."
function dotStuff(message) {
  return message.replace(/\r\n\./g, "\r\n..");
}

export async function sendMailViaSmtp({
  host,
  port,
  username,
  password,
  from,
  to,
  replyTo,
  subject,
  text,
  html,
}) {
  const socket = connect({ hostname: host, port }, { secureTransport: "on" });
  const writer = socket.writable.getWriter();
  const reader = socket.readable.getReader();

  try {
    assertCode(await readResponse(reader), [220], "greeting");
    assertCode(
      await sendCommand(writer, reader, `EHLO ${EHLO_DOMAIN}`),
      [250],
      "EHLO",
    );

    const authToken = btoa(`\0${username}\0${password}`);
    assertCode(
      await sendCommand(writer, reader, `AUTH PLAIN ${authToken}`),
      [235],
      "AUTH",
    );

    // The envelope takes a bare address — `from` may be `"Display Name" <addr>`.
    const envelopeFrom = from.match(/<([^>]+)>/)?.[1] ?? from;
    assertCode(
      await sendCommand(writer, reader, `MAIL FROM:<${envelopeFrom}>`),
      [250],
      "MAIL FROM",
    );
    assertCode(
      await sendCommand(writer, reader, `RCPT TO:<${to}>`),
      [250],
      "RCPT TO",
    );
    assertCode(await sendCommand(writer, reader, "DATA"), [354], "DATA");

    const message = dotStuff(
      buildMimeMessage({ from, to, replyTo, subject, text, html }),
    );
    await writer.write(encode(`${message}\r\n.\r\n`));
    assertCode(await readResponse(reader), [250], "message body");

    await sendCommand(writer, reader, "QUIT").catch(() => {});
  } finally {
    await writer.close().catch(() => {});
    await socket.close().catch(() => {});
  }
}
