# u1webcore

SEO, AEO/GEO, meta tags, Open Graph, JSON-LD, robots.txt / sitemaps / llms.txt, redirects, tags and consent for websites. A pure core plus an Astro integration.

## Install

```sh
npm install github:Peburu01/u1webcore
```

## Astro

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import u1webcore from 'u1webcore/astro';

export default defineConfig({
  site: 'https://example.com',
  integrations: [u1webcore()],
});
```

Settings live as JSON in the site (`src/site.u1wc.json`). On first run it seeds them from what the site already renders.

## Develop

```sh
bun install
node build.mjs   # builds dist/ (committed, so git installs need no build step)
bun test
```
