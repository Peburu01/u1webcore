# Troubleshooting

**My title has the site name twice.** The page renders a `<title>` that already includes it, and you also set a
`titleTemplate`. Set `title` in the page settings (the template applies to that) or drop the name from your layout.

**Canonical / sitemap URLs are relative or missing.** Set `identity.url` or Astro's `site`.

**`robots.txt` / `sitemap` isn't generated.** A file with that name in `public/` wins; check the build log for
"exists in public/". Or `files: false` is set.

**Tags don't load in dev.** By design; pass `tagsInDev: true`.

**Tags don't load in production.** With `consent.enabled`, they wait for consent in their category. Check
`window.u1consent.get()`.

**A page is missing from the sitemap and llms.txt.** It's noindex, its canonical points elsewhere, it's under
`sitemap.exclude`, or it's a utility route (404, `/_…`).

**Server-rendered pages.** The head is rewritten while prerendering. On-demand pages work through the same
middleware when your adapter runs Astro middleware.

**Settings changes don't show.** In dev they're live; reload the page. In production, rebuild.

Still stuck? [Open an issue](https://github.com/Peburu01/u1webcore/issues).
