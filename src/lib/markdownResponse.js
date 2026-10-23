// Shared by the `.md` endpoints in src/pages/. The build writes the body to
// `dist/<slug>.md`; the Content-Type only matters for `astro dev`, since the
// deployed Worker sets its own (worker/index.js).
export function markdownResponse(markdown) {
  return new Response(markdown, {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
}
