// XML sitemaps: an index plus chunks of ≤ 45,000 URLs (limit is 50,000 / 50 MB).
// Google ignores <priority> and <changefreq>, so neither is written. <lastmod> only when we know it
// (git history of the page source, or set by hand); a build-time date would be wrong and get ignored.
import type { SiteSettings } from '../shared/types';
import { escapeXml, isoDate, origin } from '../shared/util';
import { inSitemap, type SitePage } from '../shared/pages';

export type OutFile = { path: string; body: string; type: string };

const CHUNK = 45_000;

export function sitemaps(site: SiteSettings, pages: SitePage[], siteUrl: string): OutFile[] {
  if (site.sitemap?.enabled === false) return [];
  const base = origin(site.identity?.url || siteUrl);
  if (!base) return [];
  const list = pages.filter((p) => inSitemap(p, site)).sort((a, b) => a.path.localeCompare(b.path));
  const withImages = site.sitemap?.images !== false;
  const withLastmod = site.sitemap?.lastmod !== false;
  const listed = new Set(list.map((p) => p.url));

  const chunks: OutFile[] = [];
  for (let i = 0; i < Math.max(1, list.length); i += CHUNK) {
    const urls = list.slice(i, i + CHUNK).map((p) => {
      const parts = [`    <loc>${escapeXml(p.url)}</loc>`];
      const lastmod = withLastmod ? isoDate(p.lastmod) : undefined;
      if (lastmod) parts.push(`    <lastmod>${lastmod}</lastmod>`);
      // hreflang: the page's versions in other locales, only ones that are in the sitemap too.
      for (const a of p.resolved.alternates) if (listed.has(a.url)) parts.push(`    <xhtml:link rel="alternate" hreflang="${escapeXml(a.hreflang)}" href="${escapeXml(a.url)}"/>`);
      if (withImages) for (const img of p.images.slice(0, 1000)) parts.push(`    <image:image><image:loc>${escapeXml(img.url)}</image:loc></image:image>`);
      return `  <url>\n${parts.join('\n')}\n  </url>`;
    });
    const ns = [
      'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
      withImages && list.some((p) => p.images.length) && 'xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"',
      list.some((p) => p.resolved.alternates.length) && 'xmlns:xhtml="http://www.w3.org/1999/xhtml"',
    ].filter(Boolean);
    chunks.push({ path: `/sitemap-${chunks.length}.xml`, type: 'application/xml', body: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset ${ns.join(' ')}>\n${urls.join('\n')}\n</urlset>\n` });
  }

  const newest = (from: number) =>
    list
      .slice(from, from + CHUNK)
      .map((p) => isoDate(p.lastmod))
      .filter(Boolean)
      .sort()
      .pop();
  const index = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${chunks
    .map((c, i) => {
      const lm = withLastmod ? newest(i * CHUNK) : undefined;
      return `  <sitemap>\n    <loc>${escapeXml(base + c.path)}</loc>${lm ? `\n    <lastmod>${lm}</lastmod>` : ''}\n  </sitemap>`;
    })
    .join('\n')}\n</sitemapindex>\n`;
  return [{ path: '/sitemap-index.xml', type: 'application/xml', body: index }, ...chunks];
}
