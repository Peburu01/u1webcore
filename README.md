# u1webcore — SEO, AEO and structured data for Astro

[![npm](https://img.shields.io/npm/v/u1webcore)](https://www.npmjs.com/package/u1webcore)
[![downloads](https://img.shields.io/npm/dm/u1webcore)](https://www.npmjs.com/package/u1webcore)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

One Astro integration for everything search engines and AI assistants read: **meta tags, Open Graph share images, JSON-LD schema, sitemaps, robots.txt, llms.txt, redirects, security headers and cookie consent**, plus a CLI that audits your built site.

Add it once and every page gets correct, complete SEO without hand-written `<head>` tags.

## Why

- **Classic SEO** — titles, descriptions, canonical URLs, hreflang, Open Graph and Twitter cards on every page.
- **AEO / GEO (AI search)** — `llms.txt` and a clean Markdown copy of each page, so ChatGPT, Perplexity, Claude and Google AI Overviews can read and cite your content.
- **Structured data** — a linked JSON-LD graph (Organization, WebSite, WebPage, Article, BreadcrumbList, FAQ and more) for rich results.
- **Share images** — auto-generated `/og/<page>.png` cards for pages without their own image.
- **Crawl files** — `sitemap.xml`, `robots.txt`, RSS feeds, `manifest`, `security.txt`, written at build and served live in `astro dev`.
- **Redirects and headers** — `_redirects` and `_headers` for Cloudflare Pages / Netlify.
- **Tags with consent** — analytics and pixels load only after consent (GDPR-friendly banner).
- **Audit** — `npx u1webcore audit dist` checks every built page for missing titles, broken schema, duplicate descriptions and more.

## Install

```sh
npm install u1webcore
```

## Documentation

- [Getting started](https://github.com/Peburu01/u1webcore/blob/main/docs/getting-started.md)
- [Site settings](https://github.com/Peburu01/u1webcore/blob/main/docs/site-settings.md) · [Page settings](https://github.com/Peburu01/u1webcore/blob/main/docs/page-settings.md)
- [Structured data (JSON-LD)](https://github.com/Peburu01/u1webcore/blob/main/docs/structured-data.md)
- [AI search: llms.txt, Markdown pages, AI crawlers](https://github.com/Peburu01/u1webcore/blob/main/docs/ai-search.md)
- [Sitemaps, robots.txt, feeds and other crawl files](https://github.com/Peburu01/u1webcore/blob/main/docs/crawl-files.md)
- [Share images](https://github.com/Peburu01/u1webcore/blob/main/docs/share-images.md) · [Tags and consent](https://github.com/Peburu01/u1webcore/blob/main/docs/tags-and-consent.md)
- [Redirects and headers](https://github.com/Peburu01/u1webcore/blob/main/docs/redirects-and-headers.md) · [Multilingual](https://github.com/Peburu01/u1webcore/blob/main/docs/multilingual.md)
- [SEO audit CLI](https://github.com/Peburu01/u1webcore/blob/main/docs/audit.md) · [Core API](https://github.com/Peburu01/u1webcore/blob/main/docs/core-api.md) · [Troubleshooting](https://github.com/Peburu01/u1webcore/blob/main/docs/troubleshooting.md)

## Usage

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import u1webcore from 'u1webcore/astro';

export default defineConfig({
  site: 'https://example.com',
  integrations: [u1webcore()],
});
```

That's it. Settings live as JSON in your site (`src/site.u1wc.json`); on first run they're seeded from what your pages already render.

### Options

| Option | Default | |
|---|---|---|
| `files` | `true` | Write robots.txt, sitemaps, llms.txt and Markdown pages at build |
| `tagsInDev` | `false` | Load third-party tags and the consent banner in `astro dev` |
| `editor` | `true` | Embed page facts for the visual CMS editor in dev |
| `announcements` | from env | `{ api, siteKey }`, or `false` to turn site announcements off |

## SEO audit CLI

```sh
npx u1webcore audit dist
```

## Framework-free core

The core (`import { … } from 'u1webcore'`) is plain TypeScript with no Astro dependency: head tags, JSON-LD graphs, sitemaps, robots, llms.txt, redirects and checks you can use from any build tool.

## Requirements

Node 20+, Astro 7+.

## Develop

```sh
bun install
node build.mjs   # builds dist/
bun test
```

## Related

- [u1i18n](https://github.com/Peburu01/u1i18n) — zero-markup translations for Astro.

## License

[MIT](LICENSE)
