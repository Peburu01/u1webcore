// Whole-site audit: every page's own checks (with duplicates across pages), plus what only shows across the site:
// broken internal links, links that go through a redirect, mixed content, orphan pages and redirect-rule problems.
// Pure: the caller crawls (dev server) or reads the built files (CLI) and passes the pages and link results in.
import { buildGraph } from '../schema/graph';
import { checkRedirects } from '../edge/redirects';
import { isUtilityPath, type SitePage } from '../shared/pages';
import type { SiteSettings } from '../shared/types';
import { pageKey } from '../shared/util';
import { checkPage, type CheckLevel } from './checks';

/** One followed internal link: where it was, where it points, and what that URL answered. */
export type AuditLink = { from: string; to: string; status: number; location?: string };

export type AuditIssue = {
  id: string;
  level: Exclude<CheckLevel, 'pass'>;
  message: string;
  /** Pages where it happens. */
  pages: string[];
  /** Settings field that fixes it, as in page checks (`site:` prefix for site settings). */
  field?: string;
  /** The page's own wording, when it has specifics (e.g. "Title is 642px wide"). */
  notes?: Record<string, string>;
};

/** Site-level wording for page checks whose message has page specifics in it. */
const LABELS: Record<string, string> = {
  'title.long': 'Title too wide: Google cuts it off',
  'description.long': 'Description gets cut off in Google',
  'canonical.external': 'Canonical points to another site',
  'canonical.other': 'Canonical points to another page',
  'og.small': 'Share image narrower than 1200 px',
  'headings.skip': 'Heading levels skip',
  'img.alt': 'Images without alt text',
  'content.thin': 'Little main text',
  'schema.duplicate': 'Structured data added twice (page and u1webcore)',
  'schema.retired': 'Schema type with no Google rich result',
  'schema.faq-visible': 'FAQ answers not visible on the page',
};

export type AuditResult = { pages: number; links: number; issues: AuditIssue[] };

const RANK = { error: 0, warning: 1, info: 2 } as const;

export function auditSite({ site, pages, links = [], siteUrl = '' }: { site: SiteSettings; pages: SitePage[]; links?: AuditLink[]; siteUrl?: string }): AuditResult {
  const issues = new Map<string, AuditIssue>();
  const add = (id: string, level: AuditIssue['level'], message: string, page: string, field?: string, note?: string) => {
    const cur = issues.get(id) ?? issues.set(id, { id, level, message, pages: [], field }).get(id)!;
    if (!cur.pages.includes(page)) cur.pages.push(page);
    if (note) (cur.notes ??= {})[page] = note;
  };

  const content = pages.filter((p) => !isUtilityPath(p.path));
  const others = content.filter((p) => p.indexable).map((p) => ({ path: p.path, title: p.title, description: p.description }));

  // Each page's own checks; the same check on several pages becomes one issue listing them.
  for (const p of content) {
    const graph = buildGraph({ site, page: p.settings, resolved: p.resolved, text: p.analysis?.text });
    for (const c of checkPage({ site, page: p.settings, resolved: p.resolved, analysis: p.analysis, graph, others: p.indexable ? others : [] })) {
      if (c.level === 'pass') continue;
      // Duplicate checks name the other page; group by the shared value instead.
      const id = c.id.startsWith('title.duplicate') ? `${c.id}:${p.title}` : c.id.startsWith('description.duplicate') ? `${c.id}:${p.description}` : c.id;
      const label = LABELS[c.id];
      const message = c.id.startsWith('title.duplicate') ? `Same title on several pages: “${p.title}”` : c.id.startsWith('description.duplicate') ? 'Same description on several pages' : label ?? c.message;
      add(id, c.level, message, p.path, c.field, label ? c.message : undefined);
    }
  }

  // Links
  for (const l of links) {
    if (l.status >= 400 || l.status === 0) add(`link.broken:${l.to}`, 'error', `Broken link to ${l.to}${l.status ? ` (${l.status})` : ''}`, l.from);
    else if (l.status >= 300) add(`link.redirect:${l.to}`, 'warning', `Link to ${l.to} redirects${l.location ? ` to ${l.location}` : ''}; link to the final URL`, l.from);
  }

  // Mixed content: http:// images on an https site are blocked by browsers.
  if (siteUrl.startsWith('https://')) {
    for (const p of content) for (const img of p.analysis?.images ?? []) if (img.src.startsWith('http://')) add(`mixed:${img.src}`, 'error', `Insecure image (http://) ${img.src}`, p.path);
  }

  // Orphans: pages no other page links to (search engines and visitors can't find them by browsing).
  if (links.length) {
    const linked = new Set(links.filter((l) => pageKey(l.from) !== pageKey(l.to)).map((l) => pageKey(l.to)));
    for (const p of content) if (p.path !== '/' && p.indexable && !linked.has(pageKey(p.path))) add('orphan', 'info', 'No other page links here', p.path);
  }

  // Redirect rules
  for (const i of checkRedirects(site.redirects ?? []).issues) add(`redirects:${i.from}`, 'warning', `Redirect ${i.from}: ${i.message}`, i.from, 'site:redirects');

  const list = [...issues.values()].sort((a, b) => RANK[a.level] - RANK[b.level] || b.pages.length - a.pages.length);
  return { pages: pages.length, links: links.length, issues: list };
}

/** Internal links on a page, as site paths (no hash or query); `null` for external or non-page links. */
export function internalPath(href: string, from: string, origins: string[]): string | null {
  if (!href || /^(mailto|tel|javascript|data):/i.test(href) || href.startsWith('#')) return null;
  let url: URL;
  try {
    url = new URL(href, `http://local${from}`);
  } catch {
    return null;
  }
  const own = url.host === 'local' || origins.some((o) => o && url.origin === new URL(o).origin);
  if (!own) return null;
  const p = decodeURI(url.pathname);
  // Files (images, PDFs, feeds) are not pages; .html and .md pages are.
  if (/\.[a-z0-9]+$/i.test(p) && !/\.html?$/i.test(p)) return null;
  return p;
}
