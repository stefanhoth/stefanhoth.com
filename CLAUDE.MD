# Stefan Hoth Personal Website

## Project Overview

This is Stefan Hoth's personal website built with Astro, showcasing professional profile, experience, and contact information. The site is built as static assets and served by a Cloudflare Worker.

## Tech Stack

- **Framework**: Astro 5.16.6
- **Styling**: Tailwind CSS 4.1.18
- **Languages**: TypeScript, Astro components
- **Linting/Formatting**: Biome 2.3.10
- **Deployment**: Cloudflare Workers (wrangler)

## Project Structure

```
/
├── public/              # Static assets (incl. _headers for Cloudflare)
├── worker/
│   └── index.js         # Cloudflare Worker entry (serves assets, routes /contact)
├── functions/
│   ├── contact.js       # Contact form handler (Turnstile + SMTP)
│   └── smtp.js          # Minimal SMTP client
├── src/
│   ├── components/      # Astro components
│   │   ├── About.astro
│   │   ├── ContactForm.astro
│   │   ├── JobHunt.astro
│   │   ├── Links.astro
│   │   ├── Profile.astro
│   │   └── Quote.astro
│   ├── layouts/
│   │   └── Layout.astro # Base layout
│   ├── pages/
│   │   └── index.astro  # Main page
│   ├── styles/
│   │   └── global.css   # Global styles
│   └── lib/
│       └── contactForm.js # Contact form frontend logic
├── astro.config.mjs     # Astro configuration
├── wrangler.jsonc       # Cloudflare Workers configuration
├── biome.json          # Biome linter/formatter config
└── tsconfig.json       # TypeScript configuration
```

## Development Commands

```bash
npm run dev        # Start dev server
npm run build      # Build for production
npm run preview    # Preview production build
npm run lint       # Run Biome linter
npm run og:images  # Regenerate the social preview cards in public/img/og/
npm run format     # Format code with Biome
npm run lint:fix   # Auto-fix linting issues
npm run test       # Run Vitest (unit + jsdom) tests
npm run test:watch # Run Vitest in watch mode
npm run test:e2e   # Run Playwright end-to-end tests (real browser)
npm run worker:dev    # Build, then run the Worker locally with wrangler dev
npm run worker:deploy # Build, then deploy the Worker to Cloudflare
```

## Key Features

1. **Profile Section**: Professional introduction and photo
2. **Job Hunt Status**: Current job search status
3. **About Section**: Detailed background and expertise
4. **Quote Section**: Featured quote or motto
5. **Links Section**: Social media and professional links
6. **Contact Form**: POSTs to `/contact`, handled by the Cloudflare Worker (Turnstile bot check + email via SMTP)

## Design Patterns

- Component-based architecture with Astro
- Utility-first styling with Tailwind CSS
- Type-safe development with TypeScript
- Responsive design

## Configuration Notes

- Node version managed via `.nvmrc` (currently v24)
- Renovate bot enabled for dependency updates
- Worker secrets (`TURNSTILE_SECRET_KEY`, `MAILSENDER_SMTP_USER`, `MAILSENDER_SMTP_PASS`) are set via `wrangler secret`; local values go in `.dev.vars` (see `.dev.vars.example`)
- `PUBLIC_TURNSTILE_SITE_KEY` is a build-time env var for the frontend Turnstile widget (see `.env.example`)

## Deployment

The site runs on Cloudflare Workers. A single Worker (`worker/index.js`, configured via `wrangler.jsonc`) serves the static Astro build from `dist/` through the `ASSETS` binding, handles `POST /contact`, and stamps security headers on every asset response. It is bound to the custom domain `stefanhoth.com`.

**Configuration** (`wrangler.jsonc`):
- Worker name: `stefanhoth-com`, entry point `worker/index.js`
- Static assets served from `dist/` (Astro build output)
- Route: `stefanhoth.com` as a custom domain
- Observability logs enabled

**Headers**:
- Security headers (X-Frame-Options, X-Content-Type-Options, HSTS, CSP, Referrer-Policy, Permissions-Policy) are defined in two places that must be kept in sync: `public/_headers` (applied by the assets platform) and the `SECURITY_HEADERS` object in `worker/index.js`
- The CSP allows `https://challenges.cloudflare.com` (script + frame) for the Turnstile widget
- `public/_headers` caches `/_astro/*` for 1 year with the immutable directive

**Deploys**:
- Production: automatic — the Cloudflare GitHub App ("Cloudflare Workers and Pages", installed on this repo) builds and deploys `stefanhoth-com` to production on every push to `main`, reported as a `Workers Builds: stefanhoth-com` check run. This is Cloudflare's native git integration (configured in the Cloudflare dashboard, not a file in this repo) — it is separate from and runs in addition to `ci.yml`. `npm run worker:deploy` still works for a manual/local deploy (e.g. to push a change without going through `main`), but isn't the normal path.
- PR previews: `.github/workflows/preview-deploy.yml` builds the site and uploads a preview version via `cloudflare/wrangler-action` with a `pr-<number>` alias, then registers a GitHub deployment and comments the preview URL (`https://pr-<number>-stefanhoth-com.stefanhoth-de.workers.dev`) on the PR
- CI (`.github/workflows/ci.yml`) runs lint, build, unit tests, and Playwright e2e on every PR and push to main
- Local Worker testing: `npm run worker:dev` (secrets from `.dev.vars`)

## Working with This Codebase

### Adding New Components

1. Create `.astro` files in `src/components/` for static content
2. Import and use in `src/pages/index.astro`

### Styling

- Use Tailwind utility classes directly in components
- Global styles in `src/styles/global.css`
- Custom utilities via Tailwind configuration

### Vault Publishing

Pages come from `vault/`, which `.github/workflows/sync-vault.yml` pulls from Obsidian Sync as an exact mirror (the directory is emptied before each pull, so files deleted or renamed in Obsidian are deleted here too). Because of that, vault content — including frontmatter — must be edited in Obsidian, not in the repo; repo-side edits are overwritten by the next sync.

Frontmatter controls publishing:
- `publish: true` (plus `title`) — required for a page to be built
- `permalink: <slug>` or `permalink: <slug>.md` — optional override of the filename-derived slug. With the `.md` suffix the page is published as a file-style URL (`/<slug>.md`); the bare and trailing-slash forms 301-redirect to it. The build writes those slugs to `dist/_file-style-pages.json` (integration in `astro.config.mjs`); the Worker reads that manifest at runtime, with `run_worker_first` in `wrangler.jsonc` routing page requests through it. Wikilinks resolve to the target's permalink.
- `template: sidebar` — optional page template (default: `default`). Renders the content with a table-of-contents sidebar linking every h2 as a smooth-scroll anchor. The h2s are extracted at build time by Astro's markdown pipeline (`render()` returns `headings`; `rehypeHeadingIds` stamps the matching `id`s on the headings); `src/pages/[slug].astro` picks the layout, `src/components/TocSidebar.astro` renders the nav. On desktop the sidebar sits sticky right of the content, on mobile above it. Pages without any h2s fall back to the plain template.
- `template: projects` — renders every h2 section as a project card: the first project featured full-width, the rest in a two-column grid (single column on mobile). The structure is built at build time by `src/lib/rehypeProjectCards.js` (registered in `astro.config.mjs`); the styles live in `src/pages/[slug].astro`. Conventions inside a section (all optional): an h2 that is a markdown link becomes the card's title link (with an ↗ hint); each card gets an icon tile — the title's leading emoji if it starts with one (e.g. `## [🔦 STARlog](url)`, the emoji is moved out of the title), otherwise a letter monogram — tinted with a stable per-project hue; a paragraph containing only an `*emphasized*` line directly after the title becomes a row of chips split on `·` (e.g. `*TypeScript · Gemini · browser-only*`); the next paragraph, if it contains only a `**strong**` line, becomes the card's pitch line; every h3 (e.g. `### The story`, `### Lessons learned`) opens a collapsed `<details>` section holding everything up to the next h3; a trailing bullet list whose items are only links becomes the card's action-button row.

### Site Navigation

`src/components/SiteHeader.astro` builds the header nav from the published vault pages. `NAV_GROUPS` (in that file) defines the dropdown groups — "About me" (How I show up, How I manage) and "About my work" (What I built, Talks I gave) — with their labels and page order; a group with a single published page collapses into a plain link, one with none disappears, and published pages no group lists follow as plain links. Dropdown behaviour lives in `src/lib/navMenu.js` (jsdom-tested in `tests/dom/navMenu.dom.test.js`): mouse hover opens (a click pins it), touch/keyboard toggle, Escape/outside press/focus-out close. The panel is `position: absolute` and solid (no `backdrop-filter`), so opening never shifts the page; on phones it becomes a full-width sheet with 44px tap targets. `tests/e2e/nav-menu.spec.ts` covers desktop and touch.

### Social Sharing Previews

`Layout.astro` emits per-page Open Graph / Twitter Card meta tags plus a per-page canonical URL (the `.md` form for file-style vault pages). The 1200×630 preview images live in `public/img/og/` — one per published vault page plus `home.png` (front page) and `default.png` (fallback for pages without a generated card). They are rendered from vault frontmatter (`title`/`description`) by `scripts/generate-og-images.mjs` (sharp, palette-quantized to stay under WhatsApp's ~300 KB preview limit) and committed. The vault sync workflow regenerates them whenever it pulls content changes, so cards never go stale relative to frontmatter; generation is deterministic, so unchanged frontmatter causes no image churn. Run `npm run og:images` manually only after changing the card design or the profile photo.

### Contact Form

The contact form POSTs to `/contact`, which the Worker routes to `onRequestPost` in `functions/contact.js`. The handler:
1. Verifies the Cloudflare Turnstile token (`cf-turnstile-response`) against the siteverify API using `TURNSTILE_SECRET_KEY`
2. Validates required fields (name, email, message) and rejects CR/LF in name/email to prevent SMTP header injection
3. Sends the email via SMTP through mailbox.org (`smtp.mailbox.org:465`, credentials in `MAILSENDER_SMTP_USER`/`MAILSENDER_SMTP_PASS`) using the minimal client in `functions/smtp.js`
4. Redirects back to `/?sent=true` on success or `/?error=true` on failure

The frontend widget needs `PUBLIC_TURNSTILE_SITE_KEY` at build time.

## Git Workflow

- Commit incrementally per logical step, not one bundled commit at the end.
- PR titles must be valid Conventional Commit messages (e.g. `feat(ui): add X`, `fix(worker): handle Y`), since they are used as the squash commit message on merge.
- Once a chunk of work is done and verified (build/tests pass), push the branch and open a PR automatically — no need to ask each time. This does not extend to merging a PR or force-pushing; those still require explicit confirmation.

## Recent Changes

- Migrated hosting from Netlify to Cloudflare Workers (PR #44)
- Contact form now handled by the Worker: Turnstile verification + email via mailbox.org SMTP
- Updated to Node.js v24
- Activated Renovate bot for automated dependency updates
