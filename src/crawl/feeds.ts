// RSS 2.0, Atom 1.0 and JSON Feed 1.1 for a collection of pages (e.g. everything under /blog/).
import type { FeedSettings, SiteSettings } from '../shared/types';
import { absolute, escapeXml, isoDate, matchPath, origin } from '../shared/util';
import type { SitePage } from '../shared/pages';

export function feedItems(feed: FeedSettings, pages: SitePage[], limit = 50) {
  const prefix = feed.include;
  return pages
    .filter((p) => p.indexable && p.canonicalSelf && p.path !== prefix && p.path !== prefix.replace(/\/$/, '') && matchPath(prefix.replace(/\*+$/, ''), p.path))
    .map((p) => ({ page: p, date: isoDate(p.datePublished ?? p.dateModified ?? p.lastmod) }))
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
    .slice(0, limit);
}

export function feed(site: SiteSettings, f: FeedSettings, pages: SitePage[], siteUrl: string): string {
  const base = origin(site.identity?.url || siteUrl);
  const title = f.title ?? site.identity?.name ?? 'Feed';
  const description = f.description ?? site.identity?.description ?? '';
  const self = absolute(f.path, base) ?? f.path;
  const home = absolute(f.include.replace(/\*+$/, ''), base) ?? base;
  const items = feedItems(f, pages);
  const updated = items.map((i) => i.date).filter(Boolean).sort().pop() ?? undefined;
  const lang = site.identity?.language;

  if (f.format === 'json') {
    return `${JSON.stringify(
      {
        version: 'https://jsonfeed.org/version/1.1',
        title,
        home_page_url: home,
        feed_url: self,
        description: description || undefined,
        language: lang,
        items: items.map(({ page: p, date }) => ({
          id: p.url,
          url: p.url,
          title: p.pageTitle,
          summary: p.description || undefined,
          image: p.resolved.og.image?.url,
          date_published: date,
          date_modified: isoDate(p.dateModified),
          authors: p.resolved.author ? [{ name: p.resolved.author.name, url: p.resolved.author.url }] : undefined,
          tags: p.settings.og?.article?.tags,
        })),
      },
      null,
      2,
    )}\n`;
  }

  if (f.format === 'atom') {
    const entries = items.map(({ page: p, date }) =>
      [
        '  <entry>',
        `    <title>${escapeXml(p.pageTitle)}</title>`,
        `    <link href="${escapeXml(p.url)}"/>`,
        `    <id>${escapeXml(p.url)}</id>`,
        `    <updated>${isoDate(p.dateModified) ?? date ?? updated ?? new Date(0).toISOString()}</updated>`,
        date ? `    <published>${date}</published>` : '',
        p.description ? `    <summary>${escapeXml(p.description)}</summary>` : '',
        p.resolved.author ? `    <author><name>${escapeXml(p.resolved.author.name)}</name></author>` : '',
        '  </entry>',
      ].filter(Boolean).join('\n'),
    );
    return `<?xml version="1.0" encoding="utf-8"?>\n<feed xmlns="http://www.w3.org/2005/Atom"${lang ? ` xml:lang="${escapeXml(lang)}"` : ''}>\n  <title>${escapeXml(title)}</title>\n${description ? `  <subtitle>${escapeXml(description)}</subtitle>\n` : ''}  <link href="${escapeXml(home)}"/>\n  <link rel="self" href="${escapeXml(self)}"/>\n  <id>${escapeXml(self)}</id>\n  <updated>${updated ?? new Date(0).toISOString()}</updated>\n  <author><name>${escapeXml(site.organization?.name ?? title)}</name></author>\n${entries.join('\n')}\n</feed>\n`;
  }

  const rssItems = items.map(({ page: p, date }) =>
    [
      '    <item>',
      `      <title>${escapeXml(p.pageTitle)}</title>`,
      `      <link>${escapeXml(p.url)}</link>`,
      `      <guid isPermaLink="true">${escapeXml(p.url)}</guid>`,
      date ? `      <pubDate>${new Date(date).toUTCString()}</pubDate>` : '',
      p.description ? `      <description>${escapeXml(p.description)}</description>` : '',
      p.resolved.author ? `      <dc:creator>${escapeXml(p.resolved.author.name)}</dc:creator>` : '',
      ...(p.settings.og?.article?.tags ?? []).map((t) => `      <category>${escapeXml(t)}</category>`),
      '    </item>',
    ].filter(Boolean).join('\n'),
  );
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">\n  <channel>\n    <title>${escapeXml(title)}</title>\n    <link>${escapeXml(home)}</link>\n    <description>${escapeXml(description || title)}</description>\n${lang ? `    <language>${escapeXml(lang)}</language>\n` : ''}    <atom:link href="${escapeXml(self)}" rel="self" type="application/rss+xml"/>\n${updated ? `    <lastBuildDate>${new Date(updated).toUTCString()}</lastBuildDate>\n` : ''}${rssItems.join('\n')}\n  </channel>\n</rss>\n`;
}

export const feedType = (f: FeedSettings) => (f.format === 'atom' ? 'application/atom+xml' : f.format === 'json' ? 'application/feed+json' : 'application/rss+xml');
