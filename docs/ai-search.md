# AI search (AEO / GEO)

Answer engines (ChatGPT search, Perplexity, Claude, Google AI Overviews, Copilot) read the web differently from
classic search. u1webcore gives them clean, citable content and lets you choose which AI crawlers may visit.

## llms.txt

[llms.txt](https://llmstxt.org) is a Markdown index of your site for language models. It is on by default:

```
# Acme Dental
> Family and cosmetic dentistry in Pune.

## Pages
- [Home](https://acmedental.com/index.md): …
- [Contact](https://acmedental.com/contact.md): …

## Treatments
- [Dental implants](https://acmedental.com/treatments/implants.md): …
```

Every indexable page is listed, grouped by its first URL segment (`/treatments/…` → "Treatments"), with its
`aeo.summary` or description as the note. Customise it:

```json
"llms": {
  "summary": "One sentence about the site.",
  "details": "A paragraph agents should know: who you serve, where, what makes you different.",
  "sections": [
    { "title": "Optional", "links": [{ "title": "Careers", "url": "/careers", "notes": "Open roles" }] }
  ],
  "full": true,
  "markdownPages": true
}
```

A section titled `Optional` is always last (the spec's "agents may skip these").

Per page: `"llms": { "include": false }`, or `section`, `title`, `notes`.

## Markdown pages

With `markdownPages` (on by default), every page also gets a clean Markdown copy at `/<page>.md`, linked from the page
with `<link rel="alternate" type="text/markdown">`. Navigation, footers and scripts are stripped; headings, lists,
tables and links are kept. `llms-full.txt` (with `full: true`) joins them all in one file.

## Answers

Fill in `aeo` in the page settings so engines can quote you accurately:

```json
"aeo": {
  "summary": "Dental implants replace a missing tooth with a titanium post and crown. At Acme Dental the process takes 3–6 months, costs ₹35,000–₹60,000 per tooth and is done under local anaesthesia.",
  "faq": [{ "question": "Do implants hurt?", "answer": "…" }],
  "author": { "name": "Dr. Priya Rao", "jobTitle": "Implantologist", "sameAs": ["https://www.linkedin.com/in/…"] },
  "dateModified": "2026-10-01",
  "about": [{ "name": "Dental implant", "sameAs": "https://www.wikidata.org/wiki/Q1062470" }],
  "citations": ["https://www.ada.org/…"]
}
```

These become JSON-LD (FAQPage, author Person, `about`/`mentions` entities, `citation`) and the llms.txt notes.

The core exports `aeoScore()`, which rates a page's answer-readiness (summary, author, dates, FAQ, headings, entities)
for dashboards.

## Crawler presets

`robots.preset` decides which crawlers `robots.txt` lets in:

| Preset | Search engines | AI answers (search + user fetches) | AI training |
|---|---|---|---|
| `open` | ✓ | ✓ | ✓ |
| `no-training` (default) | ✓ | ✓ | ✗ |
| `search-only` | ✓ | ✗ | ✗ |
| `closed` | ✗ | ✗ | ✗ |

Known crawlers:

- **Search:** Googlebot, Bingbot, Applebot, DuckDuckBot, YandexBot, Baiduspider
- **AI search:** OAI-SearchBot, Claude-SearchBot, PerplexityBot
- **AI user fetches:** ChatGPT-User, Claude-User, Perplexity-User, MistralAI-User
- **AI training:** GPTBot, ClaudeBot, Google-Extended, Applebot-Extended, CCBot, Meta-ExternalAgent, Bytespider,
  Amazonbot, cohere-ai, Diffbot
- **SEO tools and social previews:** AhrefsBot, SemrushBot, facebookexternalhit, Twitterbot, LinkedInBot (previews
  stay allowed)

Add Cloudflare Content Signals (`contentSignals`) or an AIPREF `contentUsage` line to state your terms to crawlers
that read them.

## Snippet controls

`nosnippet` or `maxSnippet: 0` on a page also keeps it out of AI Overviews' quoted text. The audit reminds you.
