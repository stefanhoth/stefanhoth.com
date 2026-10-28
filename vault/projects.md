---
title: Projects
description: A few things I've built on the side. Learning by doing.
publish: true
permalink: projects.md
template: projects
---

# Projects

A few things I've built on the side - mostly scratching my own itches around AI agents, job hunting, and home automation.

## [🌟 STARlog](https://github.com/stefanhoth/starlog)

*TypeScript · Gemini · Gemma4· runs entirely in the browser*

**Turn rough memories into interview-ready STAR stories - and see your gaps before the interviewer does.**

This little browser app, running locally without any server or login, helps you frame your experience into stories everyone can understand. Speak or paste a rough description of something that happened, and Gemini turns it into a polished story following the STAR method (Situation, Task, Action, Result) - then maps it against the competencies a specific job posting is likely to probe for. Everything runs in the browser; nothing leaves your machine except the API calls made with your own key.

### Motivation

Job hunting meant retelling the same experiences over and over - and losing the good details every time. I wanted a tool that takes a two-minute voice ramble and produces a structured story I can actually rehearse, without shipping my career history to someone else's backend.

### What I learned

While this project started as a conversion of a basic skill in my job application workflow it became so much more: I learned 
- how I create a usable product - and how to restrict myself
- how much implicit expectations need to be made explicit,
- how good UX is hard to get to
- how fun an AI-enabled product can be
- how a good platform and automation helps with shipping improvements effectively
- how a "council of agents" can improve the output substantially

I came out with a lot of practical puzzle pieces I will be using in the future.

- [GitHub](https://github.com/stefanhoth/starlog)
- [Live Web App](https://starlog.stefanhoth.com/)

## [🦀 crusty-proxy](https://github.com/stefanhoth/crusty-proxy)

*Rust · MCP · security*

**My AI agent never sees an API key - need-to-know, enforced by a proxy.**

crusty-proxy is an MCP that keeps API keys away from your AI agents and lets you cherry-pick their tools - read ✅, delete ⛔. Built for OpenClaw, works with any MCP client.

### The story

Self-hosting an agent means handing it credentials for every API it may ever call - which is one prompt injection away from leaked keys. crusty-proxy moves the trust boundary: the agent talks to the proxy, the proxy holds the secrets and refuses anything that isn't on the allowlist.

- [GitHub](https://github.com/stefanhoth/crusty-proxy)

## [🔗 Open in Obsidian](https://github.com/stefanhoth/open-obsidian)

*JavaScript · Cloudflare Workers · Agent Skill · runs entirely in the browser*

**Lets AI agents hand me a link that opens the right note - in Obsidian, on desktop or phone.**

open-obsidian is a single static page that turns an `obsidian://` URI into a normal https link: click it and the note opens in the Obsidian app, in a new tab. That also makes note links work in Telegram, Slack and todo apps, which refuse custom URI schemes. An included agent skill (`npx skills add stefanhoth/open-obsidian`) teaches Claude and other agents to build these links, alongside the obsidian-cli skill. Without parameters, the page shows a small generator for vault and file.

### Motivation

Agents like Claude could already create notes in my vault through the Obsidian CLI. But whenever they tried to link me to the result, it broke: the link opened in the agent's project folder, its private scratchpad, or some other wrong place - never in my actual vault. A plain https link that points to the real file in my Obsidian desktop or mobile app closed that gap.

### What I learned

- Getting URL encoding right is the whole trick: encode the values, then the entire URI once more - and not a third time.
- GitHub Pages can't do real 301 redirects. Moving to Cloudflare Workers meant keeping the old URL alive with an instant client-side redirect that keeps every parameter.
- Even a one-file page needs a security review: inserting the URL parameter into HTML unescaped was an XSS hole.
- Writing an agent skill forces you to spell out what "obvious" usage really looks like.

- [GitHub](https://github.com/stefanhoth/open-obsidian)
- [Live Web App](https://open-obsidian.stefanhoth.com/)

## [🔤 MonoMix](https://github.com/stefanhoth/monomix)

*Svelte · TypeScript · Cloudflare Workers · runs entirely in the browser*

**Type your initials, pick a look, and get a monogram you'd actually put on something.**

MonoMix is a browser-local, installable PWA that turns one to three letters into a monogram. Pick a Design, add a Frame, tune the colors, and export as SVG, PNG, JPG, or PDF. Everything happens client-side, including autosave. Nothing you type ever leaves your machine.

### Motivation

Every monogram maker I found online was either a paid template shop or a form that uploads your initials to someone's server. I wanted the fast, local version instead: initials in, a good result out in seconds, nothing saved anywhere but my own browser.

### What I learned

No compatible-license monogram font exists. Every Design is algorithmic composition, my own layout and clipping logic applied to ordinary OFL display fonts, not a font swap.

The rendering engine is a pure function: letters and config in, an SVG string out, no DOM. That let me snapshot-test dozens of Designs without a browser.

A written domain glossary keeps a solo project's naming consistent across code, UI copy, and docs. "Shape," "Frame," and "Arrangement" stopped being interchangeable in my own head too.

A small council of specialist review agents covering persistence, accessibility, product fit, and evidence catches state-corruption bugs a single review pass misses.

- [GitHub](https://github.com/stefanhoth/monomix)
- [Live Web App](https://monomix.stefanhoth.com/)

## [📥 paperless-ngx-cli](https://github.com/stefanhoth/paperless-ngx-cli)

*Go · CLI · self-hosted*

**My document archive, one command away - scriptable from shell, cron, and agents.**

A terminal client for Paperless-NGX, my self-hosted document archive. Search, inspect metadata, and trigger bulk operations without opening a browser - built as a single static binary so it drops straight into shell scripts, cron jobs, and AI agent workflows.

### Lessons learned

A single static binary beats a "proper" package: the zero-dependency install is the feature people actually notice.

- [GitHub](https://github.com/stefanhoth/paperless-ngx-cli)