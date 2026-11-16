# SEO audit CLI

```sh
npx u1webcore audit [dist]
```

Audits the built site: every `.html` file in `dist/` (or the folder you pass) with your `src/site.u1wc.json`. It
follows internal links against the built files and your redirects, prints every issue, and exits with code 1 when
there are errors, so it can fail CI.

```yaml
# .github/workflows/seo.yml
- run: npm run build
- run: npx u1webcore audit
```

## What it checks

**Per page**

| Level | Checks |
|---|---|
| error | no title; no site URL; robots.txt blocks search engines; no viewport; invalid JSON-LD |
| warning | title or description too wide for Google (measured in pixels, not characters); no description; duplicate titles or descriptions; http site URL; whole site noindex; no share image; images without alt text; no `<meta charset>`; no page language; FAQ questions not visible on the page |
| info | short title or description; canonical pointing elsewhere; noindex / nosnippet / max-snippet notes; AI crawlers blocked; share image size, ratio, dimensions, alt; heading level skips; thin content; duplicate JSON-LD; retired rich result types; missing organization logo |

**Whole site:** broken internal links, links into redirects, orphan pages (no other page links to them).

In `astro dev`, `GET /_u1webcore/audit` returns the same audit as JSON for the running site.
