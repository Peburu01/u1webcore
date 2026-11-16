# Share images

Every page gets Open Graph and X card tags. The share image is chosen in this order:

1. `og.image` in the page settings
2. an `og:image` the page renders itself
3. a generated share card, when `social.card.enabled`
4. `social.image`, the site default

Set width and height (`og.imageWidth`, `og.imageHeight`) so WhatsApp, LinkedIn and Slack render the preview on the
first share. 1200×630 works everywhere.

## Generated share cards

```json
"social": { "card": { "enabled": true, "background": "#0f172a", "color": "#ffffff", "accent": "#f97316" } }
```

Pages without their own image get a 1200×630 PNG at `/og/<page>.png` with the page title, site name and domain,
rendered at build. Turn it off for one page with `"og": { "card": false }`.

## X (Twitter)

`twitter.card` defaults to `summary_large_image` when there's an image. `label1`/`data1` and `label2`/`data2` add the
two data rows Slack and X show under the card.

## Checks

The audit warns about a missing share image or http image URLs, and notes small images, wrong aspect ratios, missing
dimensions and missing alt text.
