// Response headers: security defaults, X-Robots-Tag, Content-Usage. As a map and as a `_headers` file
// (Netlify / Cloudflare Pages format).
import type { SiteSettings } from '../shared/types';
import { markdownPath } from '../shared/util';
import type { SitePage } from '../shared/pages';

export function securityHeaders(site: SiteSettings): Record<string, string> {
  const h = site.security?.headers ?? {};
  if (h.enabled === false) return {};
  const out: Record<string, string> = {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': h.referrerPolicy ?? 'strict-origin-when-cross-origin',
    'Permissions-Policy': h.permissionsPolicy ?? 'camera=(), microphone=(), geolocation=()',
  };
  if (h.frameOptions !== '') out['X-Frame-Options'] = h.frameOptions ?? 'SAMEORIGIN';
  if (h.hsts) out['Strict-Transport-Security'] = 'max-age=63072000; includeSubDomains; preload';
  if (h.csp) out['Content-Security-Policy'] = h.csp;
  return out;
}

/** Headers for every response. Staging (indexable: false) gets X-Robots-Tag: noindex everywhere, incl. PDFs. */
export function siteHeaders(site: SiteSettings): Record<string, string> {
  const out = { ...securityHeaders(site) };
  if (site.robots?.indexable === false || site.robots?.preset === 'closed') out['X-Robots-Tag'] = 'noindex, nofollow';
  if (site.robots?.contentUsage) out['Content-Usage'] = site.robots.contentUsage;
  return out;
}

export function headersFile(site: SiteSettings, pages: SitePage[] = []): string {
  const blocks: string[] = [];
  const all = siteHeaders(site);
  if (Object.keys(all).length) blocks.push(`/*\n${Object.entries(all).map(([k, v]) => `  ${k}: ${v}`).join('\n')}`);
  // Markdown copies point at their HTML page so they never compete with it in search.
  if (site.llms?.markdownPages !== false && site.llms?.enabled !== false) {
    for (const p of pages) if (p.url && p.indexable) blocks.push(`${markdownPath(p.path)}\n  Link: <${p.url}>; rel="canonical"\n  X-Robots-Tag: noindex`);
  }
  blocks.push('/llms.txt\n  Content-Type: text/plain; charset=utf-8', '/llms-full.txt\n  Content-Type: text/plain; charset=utf-8');
  return `${blocks.join('\n\n')}\n`;
}
