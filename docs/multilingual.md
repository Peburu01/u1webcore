# Multilingual sites

```json
"languages": {
  "defaultLocale": "en",
  "xDefault": "en",
  "locales": [
    { "code": "en", "prefix": "/en", "ogLocale": "en_IN", "label": "English" },
    { "code": "mr", "prefix": "/mr", "ogLocale": "mr_IN", "label": "मराठी" }
  ]
}
```

With two or more locales, every page gets:

- `<link rel="alternate" hreflang>` for each locale and `x-default`
- `og:locale` and `og:locale:alternate`
- sitemap `xhtml:link` alternates
- `inLanguage` in the JSON-LD

Paths are matched by prefix: `/en/about` ↔ `/mr/about`. Override one page with `alternates` in its page settings.

For translating the content itself, use [u1i18n-astro](https://www.npmjs.com/package/u1i18n-astro): no keys in
templates, catalogs generated from your pages.
