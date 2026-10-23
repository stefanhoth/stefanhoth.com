# Stefan Hoth's Personal Website

Welcome! This is my personal portfolio website where you can find information about my background, experience, and current projects.

## Get in Touch

Have questions or want to reach out? Please use the **contact form on the website** to send me a message directly. I'd love to hear from you!

## Tech Stack

If you want to look under the hood, here's what powers this site:

- **Framework**: Astro 7
- **Styling**: Tailwind CSS 4
- **Languages**: TypeScript, Astro components
- **Linting & Formatting**: Biome 2
- **Deployment**: Cloudflare Workers (wrangler)

## Development

### Getting Started

```bash
npm install          # Install dependencies
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run linter
npm run format       # Format code
npm run lint:fix     # Auto-fix linting issues
```

## Deployment

This site runs on [Cloudflare Workers](https://workers.cloudflare.com). A Worker (`worker/index.js`, configured via `wrangler.jsonc`) serves the static Astro build, handles the contact form, and adds security headers (CSP, HSTS, X-Frame-Options, etc.). Cache and security headers for static assets live in `public/_headers`.

- Production deploys: `npm run worker:deploy`
- PR previews: deployed automatically by GitHub Actions (`.github/workflows/preview-deploy.yml`)

## Documentation

For detailed documentation about the codebase, architecture, and development guidelines, see [AGENTS.md](./AGENTS.md).

---

Built with modern web technologies. Deployed via Cloudflare Workers.
