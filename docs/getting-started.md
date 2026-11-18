# Getting started

## Requirements

- Node 20 or newer
- Astro 7 or newer, with static output (the default) or prerendered pages

## Install

```sh
npm install u1webcore
```

## Add the integration

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import u1webcore from 'u1webcore/astro';

export default defineConfig({
  site: 'https://example.com', // your public URL: used for canonical links, sitemaps and share URLs
  integrations: [u1webcore()],
});
```

Run `astro dev` or `astro build`. Nothing else is required.

## What happens

u1webcore adds an Astro middleware that rewrites the `<head>` of every HTML page, in `astro dev` and while pages are
prerendered, so the built HTML is final and works on any static host.

For every page it adds or completes:

- `<title>` (through your title template) and `<meta name="description">`
- the canonical link and, for multilingual sites, `hreflang` alternates
- robots directives
- Open Graph and X (Twitter) card tags
- a JSON-LD graph: WebSite, Organization, WebPage, BreadcrumbList and the page's main entity
- verification meta tags, icons, theme colour, the web app manifest link
- your analytics and marketing tags, gated by the consent banner when you turn it on

Your own tags win: if a page already renders a title, description, canonical or share image, u1webcore reads it and
uses it as the default instead of overwriting it with nothing.

At build time it also writes into `dist/` (and serves live in `astro dev`):

| File | When |
|---|---|
| `/sitemap-index.xml` and `/sitemap-0.xml`, `/sitemap-1.xml`… | always, unless `sitemap.enabled: false` |
| `/robots.txt` | always |
| `/llms.txt` (and `/llms-full.txt` with `llms.full`) | always, unless `llms.enabled: false` |
| `/<page>.md` | with llms.txt, unless `llms.markdownPages: false` |
| RSS / Atom / JSON feeds | for each entry in `feeds` |
| `/site.webmanifest` | `manifest.enabled` |
| `/.well-known/security.txt` | `security.txt.contact` is set |
| `/ads.txt`, `/app-ads.txt` | `ads.adsTxt` / `ads.appAdsTxt` |
| `/_headers` | `security.headers.enabled` |
| `/og/<page>.png` | `social.card.enabled`, for pages without their own share image |

A file you put in `public/` always wins: u1webcore logs a warning and keeps yours.

`lastmod` dates in the sitemap come from your git history (the last commit that touched each page's files).

## Your first settings

Create `src/site.u1wc.json`:

```json
{
  "identity": {
    "name": "Acme Dental",
    "url": "https://acmedental.com",
    "titleTemplate": "%s · Acme Dental",
    "description": "Family and cosmetic dentistry in Pune."
  },
  "organization": {
    "type": "Dentist",
    "telephone": "+91 20 1234 5678",
    "address": { "streetAddress": "12 MG Road", "addressLocality": "Pune", "postalCode": "411001", "addressCountry": "IN" },
    "openingHours": ["Mo-Sa 09:00-19:00"]
  },
  "social": { "image": "/og.png", "profiles": ["https://www.instagram.com/acmedental"] },
  "llms": { "enabled": true, "markdownPages": true }
}
```

Every field is optional. See [Site settings](site-settings.md) for all of them.

For one page, put a settings file next to it:

```
src/pages/contact.astro
src/pages/contact.u1wc.json   ← { "title": "Contact us", "schema": { "type": "ContactPage" } }
```

See [Page settings](page-settings.md).

## Options

```js
u1webcore({
  files: true,          // write robots.txt, sitemaps, llms.txt… at build
  tagsInDev: false,     // load third-party tags and the consent banner in astro dev too
  editor: true,         // embed page facts for the U1CMS visual editor in dev
  announcements: false, // or { api, siteKey }: banners edited in the CMS (megaphone in the top bar)
});
```

| Option | Default | Description |
|---|---|---|
| `files` | `true` | Write robots.txt, sitemaps, llms.txt, Markdown pages and the rest at build. Set `false` if you generate them yourself. |
| `tagsInDev` | `false` | Tags and the consent banner are off in dev so your own visits aren't tracked. |
| `editor` | `true` | Dev only: lets the U1CMS editor show each page's SEO facts. Harmless without it. |
| `announcements` | from env | Site announcements (strip, popup, toast), edited in the CMS editor (megaphone button). Reads `PUBLIC_UNI1_API_URL` and `PUBLIC_UNI1_SITE_KEY`; pass `{ api, siteKey }` or `false`. |

## Check your site

```sh
npm run build
npx u1webcore audit dist
```

See [SEO audit CLI](audit.md).
