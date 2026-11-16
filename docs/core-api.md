# Core API

Everything the Astro integration does is built on plain functions with no Astro dependency. Use them in another
framework, a build script, a CMS or a dashboard.

```js
import { renderPage, siteFiles, auditSite, robotsTxt, llmsTxt, toMarkdown, buildGraph } from 'u1webcore';
```

## Pages

| Function | Does |
|---|---|
| `renderPage({ site, page, path, html, siteUrl, lastmod, tags })` | Returns `{ html, head, resolved, graph, detected, analysis }`: the page with the managed head. |
| `resolvePage(...)` | Final title, description, canonical, robots, OG and alternates for a page. |
| `pageHead(site, page, resolved, text)` | The head tags and JSON-LD graph. |
| `buildHead`, `renderHead`, `renderTag` | Head tags as data, and to HTML. |
| `buildGraph(...)`, `checkSchema(graph, page)` | The JSON-LD graph and its issues. |
| `analyze(html)` | Headings, images, links, word count, text of a page. |

## Site files

| Function | Does |
|---|---|
| `siteFiles({ site, pages, siteUrl, now })` | Every generated file as `{ path, type, body }`. |
| `robotsTxt`, `blockedBots`, `BOTS`, `PRESETS` | robots.txt and the crawler catalog. |
| `sitemaps(site, pages, siteUrl)` | Sitemap index + chunks. |
| `llmsTxt`, `llmsFullTxt`, `llmsSections` | llms.txt. |
| `toMarkdown(html)` | Clean Markdown of a page. |
| `feed`, `feedItems`, `feedType` | RSS / Atom / JSON feeds. |
| `webManifest`, `securityTxt`, `adsTxt`, `indexNowRequest` | |
| `checkRedirects`, `toAstro`, `toRedirectsFile`, `toVercel`, `toNginx` | Redirects. |
| `securityHeaders`, `headersFile` | Headers. |

## Checks

| Function | Does |
|---|---|
| `auditSite({ site, pages, links, siteUrl })` | The whole-site audit. |
| `aeoScore({ site, page, resolved, analysis })` | Answer-engine readiness score. |

## Settings metadata

`SCHEMA_TYPES`, `SITE_SPEC` and `PAGE_SPEC` describe every field with labels and help text, for building a
settings UI. Types: `SiteSettings`, `PageSettings`, `TagSettings`, `ConsentSettings`, `RedirectRule`.
