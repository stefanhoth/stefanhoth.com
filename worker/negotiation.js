// Content negotiation between the two representations of a page.

// Quality (q-value) the Accept header assigns to a concrete media type. The
// most specific matching range wins (`text/markdown` over `text/*` over
// `*/*`), as RFC 9110 §12.5.1 prescribes.
function quality(ranges, type) {
  const [major] = type.split("/");
  let best = { specificity: -1, q: 0 };
  for (const range of ranges) {
    const specificity =
      range.type === type
        ? 2
        : range.type === `${major}/*`
          ? 1
          : range.type === "*/*"
            ? 0
            : -1;
    if (specificity > best.specificity) best = { specificity, q: range.q };
  }
  return best.q;
}

function parseAccept(header) {
  return header
    .split(",")
    .map((part) => {
      const [type, ...params] = part.trim().toLowerCase().split(";");
      const q = params
        .map((param) => param.trim().match(/^q=(\d(?:\.\d{0,3})?)$/)?.[1])
        .find((value) => value !== undefined);
      return { type: type.trim(), q: q === undefined ? 1 : Number(q) };
    })
    .filter((range) => range.type !== "");
}

// Which representation the client prefers: "markdown", "html", or null when
// the Accept header is absent or does not rank one above the other (`*/*`,
// `text/plain`, …). null means "no opinion": the URL decides.
export function preferredFormat(acceptHeader) {
  if (!acceptHeader) return null;
  const ranges = parseAccept(acceptHeader);
  const markdown = quality(ranges, "text/markdown");
  const html = quality(ranges, "text/html");
  if (markdown > html) return "markdown";
  if (html > markdown) return "html";
  return null;
}
