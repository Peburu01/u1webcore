# Page settings

Per-page settings live in a `.u1wc.json` file next to the page:

```
src/pages/index.astro          → src/pages/index.u1wc.json
src/pages/about.astro          → src/pages/about.u1wc.json
src/pages/blog/[slug].astro    → src/pages/blog/[slug].u1wc.json
```

For a dynamic route, the file holds one entry per URL:

```json
{
  "/blog/first-post": { "title": "Our first post", "og": { "type": "article" } },
  "/blog/second-post": { "description": "…" }
}
```

Everything is optional. Without a file, the page keeps what it renders and gets the site defaults.

Types: `import type { PageSettings } from 'u1webcore'`.

## Title and description

| Field | Description |
|---|---|
| `title` | Goes through the site's `titleTemplate`. Without it, the page's own `<title>` is used as-is, then the site name. |
| `absoluteTitle` | `true` uses the title as-is. |
| `description` | Meta description; aim for 120–155 characters. |
| `canonical` | A different canonical URL. Pages whose canonical points elsewhere stay out of the sitemap. |
| `keywords` | `<meta name="keywords">` (Google ignores it; some other engines and tools read it). |

## robots

```json
"robots": { "index": false }
```

| Field | Effect |
|---|---|
| `index`, `follow` | `false` = `noindex` / `nofollow`. A noindex page is left out of the sitemap and llms.txt. |
| `nosnippet` | No text snippet. Also keeps the page out of AI Overviews' quoted text. |
| `maxSnippet` | Characters; `0` = none, `-1` = no limit. |
| `maxImagePreview` | `none`, `standard`, `large`. |
| `maxVideoPreview` | Seconds; `-1` = no limit. |
| `noimageindex`, `notranslate`, `indexifembedded`, `noarchive` | |
| `unavailableAfter` | ISO date after which the page drops out of results. |

## og (Open Graph)

| Field | Description |
|---|---|
| `type` | `website`, `article`, `profile`, `product`, `book`, `video.other` |
| `title`, `description` | Share-specific text; defaults to the page's. |
| `image`, `imageAlt`, `imageWidth`, `imageHeight` | 1200×630 recommended. Give width and height so apps render it on first share. |
| `card` | `false` = no generated card for this page. |
| `locale` | This page's locale when it differs from the site's. |
| `video` | An https `.mp4` or player URL. |
| `article` | `{ section, tags, author }` |
| `product` | `{ price, currency }` |
| `pinterest` | `false` = `nopin`. |

## twitter

`{ card, title, description, image, imageAlt, creator, label1, data1, label2, data2 }`. `label`/`data` pairs show
under the card in Slack and X ("Price" / "₹25 lakh").

## organization

Fields here replace the site's organization on this page only. Use it for each branch of a multi-location business:

```json
"organization": {
  "name": "Acme Dental, Kothrud",
  "telephone": "+91 20 9999 0000",
  "address": { "streetAddress": "4 Paud Road", "addressLocality": "Pune", "addressCountry": "IN" },
  "openingHours": ["Mo-Sa 10:00-20:00"]
}
```

## schema

See [Structured data](structured-data.md).

```json
"schema": {
  "type": "Product",
  "data": { "offers.price": 4999, "offers.priceCurrency": "INR", "brand.name": "Acme" },
  "breadcrumbs": [{ "name": "Home", "url": "/" }, { "name": "Shop", "url": "/shop" }],
  "speakable": ["h1", ".summary"]
}
```

## aeo (answers)

What answer engines quote. See [AI search](ai-search.md#answers).

| Field | Description |
|---|---|
| `summary` | Answer-first summary, 40–60 words. |
| `faq` | `[{ question, answer }]`: FAQPage nodes. Questions must also be visible on the page. |
| `author` | `{ name, url, jobTitle, description, image, sameAs, knowsAbout }` |
| `datePublished`, `dateModified` | ISO dates. |
| `about`, `mentions` | Entities: `[{ name, sameAs: "https://www.wikidata.org/wiki/Q…" }]` |
| `citations` | Source URLs. |

## sitemap, llms, alternates

- `sitemap`: `{ include: false }` to leave the page out, `lastmod` to set the date by hand.
- `llms`: `{ include, section, title, notes }`: where the page appears in llms.txt.
- `alternates`: `{ "en": "https://…/en/x", "ta": "https://…/ta/x" }` overrides the hreflang links.

## dataLayer

`{ "pageType": "product", "sku": "A1" }` is pushed to the dataLayer on this page before the tag manager loads.
