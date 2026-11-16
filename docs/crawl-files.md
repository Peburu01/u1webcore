# Crawl files

Generated at build into `dist/` and served live in `astro dev`. A file of the same name in `public/` always wins.

## Sitemaps

`/sitemap-index.xml` points to `/sitemap-0.xml`, `/sitemap-1.xml`… (split at the protocol's limit). It lists every
indexable page, skipping noindex pages, pages whose canonical points elsewhere, utility routes (404, `/_…`), and
paths in `sitemap.exclude`.

```json
"sitemap": { "exclude": ["/thank-you", "/drafts/"], "images": true, "lastmod": true }
```

- `lastmod` comes from the last git commit touching the page's files (or `sitemap.lastmod` in the page settings).
- `images` lists the page's images for Google Images.
- Multilingual sites get `xhtml:link` alternates per URL.

`robots.txt` references the sitemap automatically.

## robots.txt

Built from `robots.preset` (see [AI search](ai-search.md#crawler-presets)), `disallow`, `rules`, `contentSignals`
and `contentUsage`. With `indexable: false` it blocks everything.

## Feeds

```json
"feeds": [
  { "path": "/blog/rss.xml", "title": "Acme blog", "include": "/blog/", "format": "rss" },
  { "path": "/blog/feed.json", "include": "/blog/", "format": "json" }
]
```

Pages under `include` become items, newest first (published date, then modified date, then lastmod), up to 50. Each page head
gets the `<link rel="alternate">` for discovery.

## Web app manifest

`"manifest": { "enabled": true }` writes `/site.webmanifest` from `identity.name`, `manifest.shortName`, theme colour,
`backgroundColor`, `display`, `startUrl` and `icons`.

## security.txt

```json
"security": { "txt": { "contact": "mailto:security@example.com", "policy": "https://example.com/security", "preferredLanguages": ["en"] } }
```

Written to `/.well-known/security.txt` (RFC 9116). `expires` defaults to a year after the build.

## ads.txt / app-ads.txt

```json
"ads": { "adsTxt": ["google.com, pub-0000000000000000, DIRECT, f08c47fec0942fa0"] }
```

## IndexNow

`"indexNow": { "enabled": true }` publishes `/<key>.txt`. The core's `indexNowRequest(site, siteUrl, urls)` builds
the ping request for Bing, Yandex, Seznam and Naver after a deploy.
