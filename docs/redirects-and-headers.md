# Redirects and headers

## Redirects

```json
"redirects": [
  { "from": "/old-page", "to": "/new-page" },
  { "from": "/blog/2024/[slug]", "to": "/blog/[slug]", "status": 308 },
  { "from": "/promo", "to": "https://shop.example.com/sale", "status": 302 }
]
```

- `status` defaults to `301`.
- They become Astro redirects, so they work in `astro dev` and on every host (Astro writes redirect pages for static
  builds, or the host's own format with an adapter).
- Rules are checked at build: missing source or destination, self-redirects, loops and duplicates are reported, and
  chains (`/a → /b → /c`) are flattened to `/a → /c` with a warning.
- The core also exports `toRedirectsFile` (Netlify / Cloudflare `_redirects`), `toVercel` and `toNginx`.

## Security headers

```json
"security": {
  "headers": {
    "enabled": true,
    "hsts": true,
    "frameOptions": "SAMEORIGIN",
    "referrerPolicy": "strict-origin-when-cross-origin",
    "permissionsPolicy": "camera=(), microphone=(), geolocation=()",
    "csp": "default-src 'self'; img-src 'self' data: https:"
  }
}
```

Writes `/_headers` (Cloudflare Pages and Netlify), including `X-Content-Type-Options: nosniff`, plus the right
`Content-Type` for `.md` pages and feeds. On other hosts use `securityHeaders(site)` from the core.
