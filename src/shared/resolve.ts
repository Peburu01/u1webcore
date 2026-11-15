// site settings + page settings + what the page renders → the final values every output is built from.
import type { Detected, PageSettings, Person, RobotsDirectives, SiteSettings } from './types';
import { absolute, cardPath, collapse, isUtilityPath, merge, normalizePath, origin } from './util';
import { alternatePaths, localeOf, ogLocaleOf } from './i18n';

export type ResolvedImage = { url: string; alt?: string; width?: number; height?: number };

export type ResolvedPage = {
  path: string;
  /** Absolute canonical URL ("" when no site URL is known). */
  url: string;
  siteUrl: string;
  siteName: string;
  isHome: boolean;
  lang: string;
  ogLocale: string;
  /** hreflang alternates (absolute URLs): this page in every locale, plus x-default. Empty for one-language sites. */
  alternates: { hreflang: string; url: string; ogLocale?: string }[];
  /** Final <title>. */
  title: string;
  /** Title without the site template (for og:title, schema headline, breadcrumbs). */
  pageTitle: string;
  description: string;
  keywords: string[];
  robots: { directives: RobotsDirectives; content: string; indexable: boolean };
  og: {
    type: string;
    title: string;
    description: string;
    image?: ResolvedImage;
    video?: string;
    article?: { publishedTime?: string; modifiedTime?: string; author?: string; section?: string; tags: string[] };
    product?: { price: number; currency: string };
    appId?: string;
    fediverseCreator?: string;
    nopin: boolean;
  };
  twitter: { card: string; title: string; description: string; image?: ResolvedImage; site?: string; creator?: string; labels: { label: string; data: string }[] };
  datePublished?: string;
  dateModified?: string;
  author?: Person;
};

export const DEFAULT_ROBOTS: RobotsDirectives = { index: true, follow: true, maxImagePreview: 'large' };

/** Directive list for the robots meta tag. Defaults are written out so the intent is explicit. */
export function robotsContent(d: RobotsDirectives): string {
  const out = [d.index === false ? 'noindex' : 'index', d.follow === false ? 'nofollow' : 'follow'];
  if (d.nosnippet) out.push('nosnippet');
  if (d.maxSnippet !== undefined && !d.nosnippet) out.push(`max-snippet:${d.maxSnippet}`);
  if (d.maxImagePreview) out.push(`max-image-preview:${d.maxImagePreview}`);
  if (d.maxVideoPreview !== undefined) out.push(`max-video-preview:${d.maxVideoPreview}`);
  if (d.noimageindex) out.push('noimageindex');
  if (d.notranslate) out.push('notranslate');
  if (d.indexifembedded && d.index === false) out.push('indexifembedded');
  if (d.unavailableAfter) out.push(`unavailable_after:${d.unavailableAfter}`);
  if (d.noarchive) out.push('noarchive');
  return out.join(', ');
}

export function applyTemplate(title: string, template: string | undefined, siteName: string): string {
  if (!template || !template.includes('%s')) return title;
  if (!title || title === siteName) return siteName || title;
  return template.replace('%s', title).replace(/\{name\}/g, siteName);
}

export type ResolveInput = {
  site: SiteSettings;
  page?: PageSettings;
  path: string;
  detected?: Detected;
  /** Fallback public origin (Astro's `site`). */
  siteUrl?: string;
  /** Last change of the page's source, ISO. */
  lastmod?: string;
};

export function resolvePage({ site, page = {}, path: rawPath, detected = {}, siteUrl: fallbackUrl, lastmod }: ResolveInput): ResolvedPage {
  const id = site.identity ?? {};
  const siteUrl = origin(id.url || fallbackUrl || (detected.canonical && /^https?:/.test(detected.canonical) ? new URL(detected.canonical).origin : ''));
  const path = normalizePath(rawPath, id.trailingSlash ?? 'ignore');
  const isHome = path === '/' || path === '';
  const siteName = id.name || '';

  // Translated sites: the page's locale (from its URL prefix) sets lang and og:locale.
  const loc = localeOf(path, site.languages);
  const lang = loc?.code ?? id.language ?? detected.lang ?? 'en';
  // Open Graph locale: "en_US" form. Set identity.ogLocale (or the locale's ogLocale) to be exact.
  const og = loc ? (loc.ogLocale ?? (loc.code === id.language ? id.ogLocale : undefined) ?? ogLocaleOf(loc)) : (id.ogLocale ?? lang.replace('-', '_'));
  const alternates = page.alternates
    ? Object.entries(page.alternates).map(([hreflang, href]) => ({ hreflang, url: absolute(href, siteUrl) ?? href }))
    : alternatePaths(path, site.languages).map((a) => ({ hreflang: a.hreflang, url: siteUrl ? `${siteUrl}${a.path}` : a.path, ogLocale: a.ogLocale }));

  // Title: page setting (templated) → the page's own <title> (already composed) → site name.
  const ownTitle = collapse(detected.title ?? '');
  const pageTitle = collapse(page.title ?? '') || stripTemplate(ownTitle, id.titleTemplate, siteName) || siteName;
  const title = page.title?.trim()
    ? page.absoluteTitle ? page.title.trim() : applyTemplate(page.title.trim(), id.titleTemplate, siteName)
    : ownTitle || siteName;

  const description = collapse(page.description ?? '') || collapse(detected.description ?? '') || (isHome ? collapse(id.description ?? '') : '') || collapse(id.description ?? '');

  const directives = merge(merge(DEFAULT_ROBOTS, site.robots?.defaults ?? {}), page.robots ?? {});
  if (site.robots?.indexable === false) directives.index = false;

  const url = absolute(page.canonical, siteUrl) ?? (siteUrl ? `${siteUrl}${path}` : detected.canonical ?? '');

  const image = pickImage(page, site, detected, siteUrl, path);
  const twitterImage = page.twitter?.image ? { url: absolute(page.twitter.image, siteUrl) ?? page.twitter.image, alt: page.twitter.imageAlt ?? image?.alt } : image;

  const datePublished = page.aeo?.datePublished;
  const dateModified = page.aeo?.dateModified ?? (datePublished ? lastmod : undefined);
  const ogType = page.og?.type ?? (isHome ? 'website' : page.schema?.type && /Article|BlogPosting/.test(page.schema.type) ? 'article' : 'website');
  const ogTitle = collapse(page.og?.title ?? '') || pageTitle;
  const ogDescription = collapse(page.og?.description ?? '') || description;

  return {
    path,
    url,
    siteUrl,
    siteName,
    isHome,
    lang,
    ogLocale: page.og?.locale || og,
    alternates,
    title,
    pageTitle,
    description,
    keywords: page.keywords ?? [],
    robots: { directives, content: robotsContent(directives), indexable: directives.index !== false },
    og: {
      type: ogType,
      title: ogTitle,
      description: ogDescription,
      image,
      video: absolute(page.og?.video, siteUrl) ?? page.og?.video,
      article: ogType === 'article' ? { publishedTime: datePublished, modifiedTime: dateModified, author: page.og?.article?.author ?? page.aeo?.author?.url ?? page.aeo?.author?.name, section: page.og?.article?.section, tags: page.og?.article?.tags ?? [] } : undefined,
      product: page.og?.product?.price !== undefined && page.og.product.currency ? { price: page.og.product.price, currency: page.og.product.currency } : undefined,
      appId: site.social?.facebookAppId || undefined,
      fediverseCreator: site.social?.fediverseCreator?.trim() || undefined,
      nopin: page.og?.pinterest === false,
    },
    twitter: {
      card: page.twitter?.card ?? (twitterImage ? 'summary_large_image' : 'summary'),
      title: collapse(page.twitter?.title ?? '') || ogTitle,
      description: collapse(page.twitter?.description ?? '') || ogDescription,
      image: twitterImage,
      site: handle(site.social?.twitterSite),
      creator: handle(page.twitter?.creator) ?? handle(site.social?.twitterCreator),
      labels: [
        { label: page.twitter?.label1 ?? '', data: page.twitter?.data1 ?? '' },
        { label: page.twitter?.label2 ?? '', data: page.twitter?.data2 ?? '' },
      ].filter((l) => l.label.trim() && l.data.trim()),
    },
    datePublished,
    dateModified,
    author: page.aeo?.author,
  };
}

const handle = (h?: string) => (h?.trim() ? `@${h.trim().replace(/^@/, '').replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//, '')}` : undefined);

/** Whether `path` gets a generated share card: the site turned them on, the page has no image and didn't opt out. */
export const cardEnabled = (site: SiteSettings, page: PageSettings, path: string) => !!site.social?.card?.enabled && page.og?.card !== false && !page.og?.image && !isUtilityPath(path);

function pickImage(page: PageSettings, site: SiteSettings, detected: Detected, siteUrl: string, path: string): ResolvedImage | undefined {
  if (page.og?.image) return { url: absolute(page.og.image, siteUrl) ?? page.og.image, alt: page.og.imageAlt, width: page.og.imageWidth, height: page.og.imageHeight };
  if (cardEnabled(site, page, path)) return { url: absolute(cardPath(path), siteUrl) ?? cardPath(path), width: 1200, height: 630 };
  if (site.social?.image) return { url: absolute(site.social.image, siteUrl) ?? site.social.image, alt: site.social.imageAlt, width: site.social.imageWidth, height: site.social.imageHeight };
  if (detected.ogImage) return { url: absolute(detected.ogImage, siteUrl) ?? detected.ogImage };
  return undefined;
}

/** "About · Acme" with template "%s · Acme" → "About". */
function stripTemplate(title: string, template: string | undefined, siteName: string): string {
  if (!title || !template?.includes('%s')) return title;
  const [pre, post] = template.replace(/\{name\}/g, siteName).split('%s');
  if (title.startsWith(pre) && title.endsWith(post) && title.length > pre.length + post.length) return title.slice(pre.length, title.length - post.length);
  return title;
}
