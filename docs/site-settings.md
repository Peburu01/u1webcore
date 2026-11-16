# Site settings

Site-wide settings live in `src/site.u1wc.json`. Every field is optional: an empty value falls back to a sensible
default, then to what your pages already render. Changes are picked up live in `astro dev`.

Types are exported: `import type { SiteSettings } from 'u1webcore'`.

## identity

| Field | Type | Description |
|---|---|---|
| `name` | string | Site name: `og:site_name`, the WebSite node, llms.txt title. |
| `alternateName` | string[] | Shorter names or acronyms Google may show as the site name. |
| `url` | string | Public origin, e.g. `https://example.com`. Falls back to Astro's `site`. Needed for canonical, sitemap and share URLs. |
| `language` | string | BCP 47 code (`en`, `en-IN`) for `<html lang>` when the page has none. |
| `ogLocale` | string | Open Graph locale, e.g. `en_IN`. |
| `titleTemplate` | string | `%s · Acme`, where `%s` is the page title. Applied to titles set in page settings (not with `absoluteTitle`); a `<title>` the page renders itself is used as-is. |
| `description` | string | Default meta description for pages without one. |
| `trailingSlash` | `always` \| `never` \| `ignore` | How canonical and sitemap URLs end. |
| `themeColor`, `themeColorDark` | string | `<meta name="theme-color">` for light and dark mode. |

## organization

Becomes the Organization (or any subtype) node in every page's JSON-LD graph, which is what drives Google's knowledge
panel and local results.

| Field | Description |
|---|---|
| `type` | `Organization`, `Corporation`, `LocalBusiness` or any subtype: `Dentist`, `Restaurant`, `Physician`, `RealEstateAgent`, `OnlineStore`… |
| `name`, `alternateName`, `legalName`, `description` | |
| `logo` | Square-ish, at least 112×112, readable on white. A path in `public/` or a URL. |
| `image` | A photo of the business. |
| `email`, `telephone` | Telephone with country code: `+91 80 1234 5678`. |
| `address` | `{ streetAddress, addressLocality, addressRegion, postalCode, addressCountry }`; country as ISO alpha-2 (`IN`). |
| `geo` | `{ latitude, longitude }` |
| `openingHours` | Schema.org format: `["Mo-Fr 09:00-18:00", "Sa 10:00-14:00"]`. |
| `priceRange` | `₹₹`, `$$` |
| `areaServed` | Cities or regions. |
| `foundingDate`, `numberOfEmployees`, `founders` | |
| `contactPoints` | `[{ contactType: "customer support", telephone, email, areaServed, availableLanguage }]` |
| `identifiers` | `vatID`, `taxID`, `iso6523Code` (preferred by Google), `duns`, `leiCode`, `naics`, `globalLocationNumber` |

A page can override any of these for itself (one branch of a multi-location business): see
[Page settings → organization](page-settings.md#organization).

## social

| Field | Description |
|---|---|
| `image`, `imageAlt`, `imageWidth`, `imageHeight` | Default share image (1200×630) for pages without their own. |
| `twitterSite`, `twitterCreator` | `@handle` |
| `profiles` | Profile URLs (LinkedIn, X, Instagram, YouTube, Wikipedia, Wikidata): the Organization's `sameAs`. |
| `facebookAppId` | `fb:app_id` |
| `fediverseCreator` | `@you@mastodon.social` |
| `card` | Generated share cards: `{ enabled, background, color, accent }`. See [Share images](share-images.md). |

## icons and manifest

```json
"icons": { "favicon": "/favicon.ico", "svg": "/favicon.svg", "appleTouchIcon": "/apple-touch-icon.png", "icon192": "/icon-192.png", "icon512": "/icon-512.png", "maskable": "/icon-maskable.png" },
"manifest": { "enabled": true, "shortName": "Acme", "backgroundColor": "#ffffff", "display": "standalone", "startUrl": "/" }
```

With `manifest.enabled`, `/site.webmanifest` is generated from your name, theme colour and icons.

## verification

Search console and platform verification meta tags:
`{ "google": "…", "bing": "…", "yandex": "…", "baidu": "…", "naver": "…", "pinterest": "…", "facebook": "…" }`.

## robots

| Field | Description |
|---|---|
| `indexable` | `false` = noindex every page and block every crawler. Use it on staging. |
| `preset` | Which crawlers `robots.txt` lets in: `open`, `no-training` (default), `search-only`, `closed`. See [AI search](ai-search.md#crawler-presets). |
| `defaults` | Robots directives for every page (see [Page settings → robots](page-settings.md#robots)). |
| `disallow` | Extra paths blocked for every bot: `["/admin/", "/drafts/"]`. |
| `rules` | Your own groups: `[{ agents: ["Bingbot"], allow: ["/"], disallow: ["/search"], crawlDelay: 5 }]`. |
| `contentSignals` | Cloudflare Content Signals line: `{ search, aiInput, aiTrain }`. |
| `contentUsage` | IETF AIPREF `Content-Usage` line, e.g. `train-ai=n`. |

## sitemap

`{ enabled, exclude, images, lastmod }`. `exclude` takes path prefixes. `images` (default on) lists each page's
images; `lastmod` (default on) uses git history.

## llms

`{ enabled, summary, details, sections, full, markdownPages }`. See [AI search](ai-search.md).

## languages

`{ locales: [{ code, prefix, ogLocale, label }], defaultLocale, xDefault }`. See [Multilingual sites](multilingual.md).

## feeds

`[{ path: "/blog/rss.xml", title, description, include: "/blog/", format: "rss" }]`; `format` is `rss`, `atom` or
`json`. Pages under `include` become feed items, newest first. See [Crawl files](crawl-files.md#feeds).

## redirects

`[{ from: "/old", to: "/new", status: 301 }]`. See [Redirects and headers](redirects-and-headers.md).

## security

- `txt`: `/.well-known/security.txt` fields: `contact` (required), `expires`, `encryption`, `policy`,
  `acknowledgments`, `preferredLanguages`, `hiring`.
- `headers`: `{ enabled, hsts, csp, referrerPolicy, permissionsPolicy, frameOptions }` writes `/_headers`
  (Cloudflare Pages and Netlify).

## ads and indexNow

- `ads.adsTxt`, `ads.appAdsTxt`: lines of `ads.txt` / `app-ads.txt`.
- `indexNow`: `{ enabled, key }`: publishes the key file so you can ping Bing, Yandex and others on change.

## tags, tagManager and consent

Analytics and marketing tags, dataLayer triggers and the cookie banner. See [Tags and consent](tags-and-consent.md).

## announcements

`{ "enabled": false }` turns off banners from the uni1 dashboard on this site.

## legal

`{ privacy, terms, cookies, imprint }`: URLs, linked from the consent banner and the JSON-LD.

## hints

`{ preconnect: ["https://fonts.gstatic.com"], dnsPrefetch: ["https://www.googletagmanager.com"] }`

## schema

`{ "extra": [ { "@type": "…", … } ] }`: custom JSON-LD nodes added to every page's graph. See
[Structured data](structured-data.md#custom-nodes).

## Editing

The uni1 dashboard and the U1CMS editor read and write this same file, so you can edit it by hand, in the dashboard,
or both.
