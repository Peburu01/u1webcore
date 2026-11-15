// Social sharing tags: Open Graph (Facebook, LinkedIn, Slack, WhatsApp…) and X/Twitter cards.
import type { ResolvedPage } from '../shared/resolve';
import { meta, type HeadTag } from '../meta/tag';

export function openGraphTags(page: ResolvedPage): (HeadTag | null)[] {
  return [
    meta('property', 'og:type', page.og.type),
    meta('property', 'og:site_name', page.siteName),
    meta('property', 'og:title', page.og.title),
    meta('property', 'og:description', page.og.description),
    meta('property', 'og:url', page.url || undefined),
    meta('property', 'og:locale', page.ogLocale),
    ...[...new Set(page.alternates.map((a) => a.ogLocale).filter((o): o is string => !!o && o !== page.ogLocale))].map((o) => meta('property', 'og:locale:alternate', o)),
    meta('property', 'fb:app_id', page.og.appId),
    page.og.video ? meta('property', 'og:video', page.og.video) : null,
    page.og.video?.startsWith('https://') ? meta('property', 'og:video:secure_url', page.og.video) : null,
    meta('property', 'product:price:amount', page.og.product?.price),
    meta('property', 'product:price:currency', page.og.product?.currency),
    page.og.nopin ? meta('name', 'pinterest', 'nopin') : null,
    meta('name', 'fediverse:creator', page.og.fediverseCreator),
    ...(page.og.image
      ? [
          meta('property', 'og:image', page.og.image.url),
          page.og.image.url.startsWith('https://') ? meta('property', 'og:image:secure_url', page.og.image.url) : null,
          meta('property', 'og:image:type', imageType(page.og.image.url)),
          meta('property', 'og:image:width', page.og.image.width),
          meta('property', 'og:image:height', page.og.image.height),
          meta('property', 'og:image:alt', page.og.image.alt),
        ]
      : []),
    ...(page.og.article
      ? [
          meta('property', 'article:published_time', page.og.article.publishedTime),
          meta('property', 'article:modified_time', page.og.article.modifiedTime),
          meta('property', 'article:author', page.og.article.author),
          meta('property', 'article:section', page.og.article.section),
          ...page.og.article.tags.map((t) => meta('property', 'article:tag', t)),
        ]
      : []),
  ];
}

// Explicit twitter:* tags are emitted even though X falls back to og:*, so every app reads the same values.
export function twitterTags(page: ResolvedPage): (HeadTag | null)[] {
  return [
    meta('name', 'twitter:card', page.twitter.card),
    meta('name', 'twitter:site', page.twitter.site),
    meta('name', 'twitter:creator', page.twitter.creator),
    meta('name', 'twitter:title', page.twitter.title),
    meta('name', 'twitter:description', page.twitter.description),
    meta('name', 'twitter:image', page.twitter.image?.url),
    meta('name', 'twitter:image:alt', page.twitter.image?.alt),
    ...page.twitter.labels.flatMap((l, i) => [meta('name', `twitter:label${i + 1}`, l.label), meta('name', `twitter:data${i + 1}`, l.data)]),
  ];
}

export function imageType(url: string): string | undefined {
  const ext = /\.(png|jpe?g|webp|gif|avif|svg)(?:[?#]|$)/i.exec(url)?.[1]?.toLowerCase();
  if (!ext) return undefined;
  return ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'svg' ? 'image/svg+xml' : `image/${ext}`;
}
