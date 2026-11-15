// The <head> tags for one page, as data + HTML. Also the keys used to replace a page's own tags.
import type { ResolvedPage } from '../shared/resolve';
import type { FeedSettings, SiteSettings } from '../shared/types';
import { absolute, escapeHtml, scriptJson } from '../shared/util';
import { link, meta, type HeadTag } from './tag';
import { openGraphTags, twitterTags } from '../social/social';

export type { HeadTag } from './tag';

export type HeadExtras = {
  /** JSON-LD graph to embed. */
  jsonLd?: unknown;
  /** URL of this page's markdown version. */
  markdownUrl?: string;
  /** URL of llms.txt. */
  llmsUrl?: string;
};


export function buildHead(page: ResolvedPage, site: SiteSettings, extras: HeadExtras = {}): HeadTag[] {
  const s = page.siteUrl;
  const id = site.identity ?? {};
  const icons = site.icons ?? {};
  const v = site.verification ?? {};
  const tags: (HeadTag | null)[] = [
    { tag: 'title', attrs: {}, content: page.title },
    meta('name', 'description', page.description),
    page.keywords.length ? meta('name', 'keywords', page.keywords.join(', ')) : null,
    meta('name', 'author', page.author?.name),
    meta('name', 'robots', page.robots.content),
    link({ rel: 'canonical', href: page.url || undefined }),
    ...page.alternates.map((a) => link({ rel: 'alternate', hreflang: a.hreflang, href: a.url })),

    ...openGraphTags(page),
    ...twitterTags(page),

    // Browser chrome & icons
    id.themeColor ? { tag: 'meta', attrs: { name: 'theme-color', content: id.themeColor, ...(id.themeColorDark ? { media: '(prefers-color-scheme: light)' } : {}) } } : null,
    id.themeColorDark ? { tag: 'meta', attrs: { name: 'theme-color', content: id.themeColorDark, media: '(prefers-color-scheme: dark)' } } : null,
    link({ rel: 'icon', href: icons.favicon, sizes: icons.favicon?.endsWith('.ico') ? '32x32' : undefined }),
    link({ rel: 'icon', href: icons.svg, type: 'image/svg+xml' }),
    link({ rel: 'apple-touch-icon', href: icons.appleTouchIcon }),
    site.manifest?.enabled ? link({ rel: 'manifest', href: '/site.webmanifest' }) : null,

    // Verification
    meta('name', 'google-site-verification', v.google),
    meta('name', 'msvalidate.01', v.bing),
    meta('name', 'yandex-verification', v.yandex),
    meta('name', 'baidu-site-verification', v.baidu),
    meta('name', 'naver-site-verification', v.naver),
    meta('name', 'p:domain_verify', v.pinterest),
    meta('name', 'facebook-domain-verification', v.facebook),

    // Discovery
    ...(site.feeds ?? []).map((f) => link({ rel: 'alternate', type: feedType(f), title: f.title ?? page.siteName, href: absolute(f.path, s) ?? f.path })),
    link({ rel: 'alternate', type: 'text/markdown', href: extras.markdownUrl }),
    link({ rel: 'describedby', type: 'text/plain', href: extras.llmsUrl }),
    ...(site.hints?.preconnect ?? []).map((h) => link({ rel: 'preconnect', href: h, crossorigin: '' })),
    ...(site.hints?.dnsPrefetch ?? []).map((h) => link({ rel: 'dns-prefetch', href: h })),

    extras.jsonLd ? { tag: 'script', attrs: { type: 'application/ld+json' }, content: scriptJson(extras.jsonLd) } : null,
  ];
  return tags.filter((t): t is HeadTag => t !== null);
}

const feedType = (f: FeedSettings) => (f.format === 'atom' ? 'application/atom+xml' : f.format === 'json' ? 'application/feed+json' : 'application/rss+xml');

export function renderTag(t: HeadTag): string {
  const attrs = Object.entries(t.attrs)
    .map(([k, v]) => (v === '' && k === 'crossorigin' ? ` ${k}` : ` ${k}="${escapeHtml(v)}"`))
    .join('');
  if (t.tag === 'title') return `<title>${escapeHtml(t.content ?? '')}</title>`;
  if (t.tag === 'script') return `<script${attrs}>${t.content ?? ''}</script>`;
  return `<${t.tag}${attrs}>`;
}

export const renderHead = (tags: HeadTag[]) => tags.map(renderTag).join('\n');

/**
 * Identity of a head tag for replacement: a page's own tag is dropped when we emit one with the same key.
 * null = never replaced (e.g. a site's own JSON-LD, stylesheets).
 */
export function tagKey(tag: string, attrs: Record<string, string>): string | null {
  const t = tag.toLowerCase();
  if (t === 'title') return 'title';
  if (t === 'meta') {
    if (attrs.name) return `name:${attrs.name.toLowerCase()}`;
    if (attrs.property) return `property:${attrs.property.toLowerCase()}`;
    return null;
  }
  if (t === 'link') {
    const rel = (attrs.rel ?? '').toLowerCase().split(/\s+/);
    if (rel.includes('canonical')) return 'canonical';
    if (rel.includes('alternate') && attrs.hreflang) return 'hreflang';
    if (rel.includes('alternate') && /rss|atom|feed\+json|markdown/.test(attrs.type ?? '')) return `alternate:${attrs.type}`;
    if (rel.includes('icon') || rel.includes('shortcut')) return 'icon';
    if (rel.includes('apple-touch-icon')) return 'apple-touch-icon';
    if (rel.includes('manifest')) return 'manifest';
    if (rel.includes('describedby')) return 'describedby';
    return null;
  }
  return null;
}
