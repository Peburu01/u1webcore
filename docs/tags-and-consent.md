# Tags and consent

Add analytics and marketing tags in the site settings instead of pasting snippets into layouts. u1webcore injects
them, loads them only where you say and only after the visitor consents.

## Tags

```json
"tags": [
  { "id": "gtm", "kind": "gtm", "value": "GTM-ABC123", "consent": "analytics" },
  { "id": "ga", "kind": "ga4", "value": "G-XXXXXXX", "consent": "analytics" },
  { "id": "fb", "kind": "meta", "value": "1234567890", "consent": "marketing", "paths": { "include": ["/shop"] } },
  { "id": "chat", "kind": "custom", "html": "<script src=\"https://chat.example.com/w.js\" async></script>", "placement": "body-end", "consent": "preferences" }
]
```

| Field | Description |
|---|---|
| `id` | Your own unique id. |
| `kind` | `gtm`, `ga4`, `meta`, `linkedin`, `tiktok`, `clarity`, `hotjar`, `plausible`, `fathom`, `umami`, `custom` |
| `value` | Container / measurement / pixel / site id; the domain for Plausible. |
| `src` | Script URL for Umami or custom tags. |
| `html` | Raw HTML for custom tags. |
| `consent` | `necessary`, `analytics`, `marketing`, `preferences`. Waits for that category. |
| `placement` | `head`, `body-start`, `body-end`. |
| `serverUrl` | GTM only: a first-party server container (`https://tags.example.com`). |
| `paths` | `{ include, exclude }` path prefixes; `exclude` wins. |
| `enabled` | `false` keeps the tag configured but off. |

Tags don't load in `astro dev` unless you pass `tagsInDev: true`, so your own work isn't tracked.

## dataLayer triggers

Push events without writing JavaScript; GTM tags listen for the event `name`:

```json
"tagManager": {
  "triggers": [
    { "id": "cta", "name": "cta_click", "on": "click", "selector": "a.cta", "params": { "location": "hero" } },
    { "id": "lead", "name": "lead_submit", "on": "submit", "selector": "form#contact" },
    { "id": "pricing", "name": "pricing_seen", "on": "view", "selector": "#pricing" }
  ]
}
```

`on` is `click`, `submit` or `view` (first time the element is on screen). Page settings' `dataLayer` object is pushed
before the tag manager loads.

## Consent banner

```json
"consent": {
  "enabled": true,
  "googleConsentMode": true,
  "googleMode": "advanced",
  "regions": ["GB", "FR", "DE", "US-CA"],
  "respectGpc": true,
  "position": "bottom",
  "expiryDays": 180,
  "version": "1",
  "text": { "title": "Cookies", "message": "We use cookies to…", "accept": "Accept all", "reject": "Reject", "customize": "Choose" }
}
```

| Field | Default | Description |
|---|---|---|
| `enabled` | `false` | Show the banner and hold back non-necessary tags until consent. |
| `googleConsentMode` | | Emit Google Consent Mode v2 defaults (denied) before any tag. |
| `googleMode` | | `advanced`: Google tags load at once and send cookieless pings until consent (Google's recommendation). `basic`: Google tags wait like the rest. |
| `regions` | everywhere | ISO 3166 codes where defaults are denied; elsewhere granted. |
| `respectGpc` | `true` | Treat Global Privacy Control as "reject marketing". |
| `position` | `bottom` | `bottom`, `bottom-left`, `bottom-right` |
| `expiryDays` | `180` | How long a choice is remembered. |
| `version` | | Change it to ask everyone again. |

The banner links to `legal.privacy` and `legal.cookies` when set.

### From your own code

```js
window.u1consent.get();      // { necessary, analytics, marketing, preferences } or null
window.u1consent.open();     // reopen the banner (e.g. a "Cookie settings" footer link)
window.u1consent.set({ analytics: true, marketing: false });
window.u1consent.reset();    // forget the choice

window.addEventListener('u1:consent', (e) => console.log(e.detail));
```
