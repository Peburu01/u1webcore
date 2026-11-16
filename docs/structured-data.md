# Structured data (JSON-LD)

Every page gets one linked JSON-LD `@graph`, so search engines and AI assistants see who publishes the site, what the
page is and what it is about. Nodes reference each other by `@id` instead of repeating data.

## What every page gets

| Node | From |
|---|---|
| `WebSite` | `identity` (name, alternate names, URL, language) |
| `Organization` (or your subtype) | `organization`, `social.profiles` as `sameAs`, logo |
| `WebPage` (or the page type) | the page's title, description, URL, dates, primary image, breadcrumbs, `speakable` |
| `BreadcrumbList` | derived from the URL (`/blog/post` → Home › Blog › Post), or your own list |
| `ImageObject` | the page's share image |
| `FAQPage` | `aeo.faq`, when the page has questions |
| `Person` | `aeo.author` |
| the main entity | `schema.type` + `schema.data` (Article, Product, Event…) |

About and Contact pages also get the full Organization node with contact details.

## Choosing a type

Set `schema.type` in the page settings. Page types describe the page itself; entity types describe the thing on it
(and the page becomes a WebPage or ItemPage about that thing).

**Page types:** `WebPage`, `AboutPage`, `ContactPage`, `CollectionPage`, `ItemPage`, `SearchResultsPage`,
`FAQPage`, `ProfilePage`.

**Content:** `Article`, `BlogPosting`, `NewsArticle`, `HowTo`, `Recipe`, `VideoObject`, `Course`.

**Commerce and services:** `Product`, `Service`, `SoftwareApplication`, `RealEstateListing`, `JobPosting`, `Event`.

**Places and organisations:** `LocalBusiness`, `Restaurant`, `NGO`, `GovernmentService`.

## Filling in data

`schema.data` takes schema.org properties; dotted paths build nested objects:

```json
{
  "schema": {
    "type": "Product",
    "data": {
      "name": "Trail Runner 2",
      "brand.name": "Acme",
      "offers.price": 4999,
      "offers.priceCurrency": "INR",
      "offers.availability": "https://schema.org/InStock",
      "aggregateRating.ratingValue": 4.7,
      "aggregateRating.reviewCount": 213
    }
  }
}
```

Properties the page already provides (headline from the title, description, image, word count, dates, author) are
filled in for you.

## Breadcrumbs

```json
"schema": { "breadcrumbs": false }
"schema": { "breadcrumbs": [{ "name": "Home", "url": "/" }, { "name": "Guides", "url": "/guides" }] }
```

## Speakable

`"speakable": ["h1", ".summary"]` marks the parts voice assistants should read aloud.

## Custom nodes

Add any node to one page (`page.schema.extra`) or every page (`site.schema.extra`):

```json
"schema": {
  "extra": [
    { "@type": "MedicalClinic", "name": "Heart Clinic", "medicalSpecialty": "Cardiovascular" }
  ]
}
```

If a page already renders its own JSON-LD, u1webcore keeps it and the audit tells you about duplicates.

## Checks

The audit flags invalid JSON-LD, missing required properties for the chosen type, FAQ questions that aren't visible on
the page (which Google treats as spam), types whose rich results Google has retired, and a missing organization logo.
