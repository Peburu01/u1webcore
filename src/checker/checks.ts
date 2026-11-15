// Live checks for one page (dashboard) and across pages (audit).
import { blockedBots } from '../crawl/robots';
import type { SitePage } from '../shared/pages';
import type { ResolvedPage } from '../shared/resolve';
import { checkSchema, type Graph } from '../schema/graph';
import { schemaType } from '../schema/types';
import type { PageAnalysis, PageSettings, SiteSettings } from '../shared/types';
import { SERP, textWidth } from './pixels';
import { TAG_PRESETS } from '../consent/tags';

export type CheckLevel = 'error' | 'warning' | 'info' | 'pass';
export type CheckGroup = 'search' | 'social' | 'schema' | 'content' | 'crawl' | 'tech' | 'compliance';
export type Check = { id: string; level: CheckLevel; group: CheckGroup; message: string; /** Settings field that fixes it. */ field?: string };

export type PageCheckInput = {
  site: SiteSettings;
  page: PageSettings;
  resolved: ResolvedPage;
  analysis?: PageAnalysis;
  graph?: Graph;
  /** Other pages, for duplicate checks. */
  others?: Pick<SitePage, 'path' | 'title' | 'description'>[];
};

export function checkPage({ site, page, resolved: r, analysis: a, graph, others = [] }: PageCheckInput): Check[] {
  const out: Check[] = [];
  const add = (id: string, level: CheckLevel, group: CheckGroup, message: string, field?: string) => out.push({ id, level, group, message, field });

  // Search
  if (!r.title) add('title.missing', 'error', 'search', 'No title.', 'title');
  else {
    const w = textWidth(r.title, SERP.title.font);
    if (w > SERP.title.max) add('title.long', 'warning', 'search', `Title is ${w}px wide; Google cuts it around ${SERP.title.max}px.`, 'title');
    else if (r.title.length < 15) add('title.short', 'info', 'search', 'Title is very short; say what the page is about.', 'title');
    else add('title.ok', 'pass', 'search', `Title fits (${w}px).`, 'title');
  }
  if (!r.description) add('description.missing', 'warning', 'search', 'No meta description; Google will pick text from the page.', 'description');
  else {
    const w = textWidth(r.description, SERP.description.font);
    if (w > SERP.description.max) add('description.long', 'warning', 'search', `Description is ${w}px; it gets cut around ${SERP.description.max}px (desktop).`, 'description');
    else if (r.description.length < 70) add('description.short', 'info', 'search', 'Description is short; aim for 120–155 characters.', 'description');
    else add('description.ok', 'pass', 'search', 'Description length is good.', 'description');
  }
  const dupTitle = others.filter((o) => o.path !== r.path && o.title && o.title === r.title);
  if (dupTitle.length) add('title.duplicate', 'warning', 'search', `Same title as ${dupTitle.map((o) => o.path).slice(0, 3).join(', ')}.`, 'title');
  const dupDesc = others.filter((o) => o.path !== r.path && o.description && o.description === r.description);
  if (dupDesc.length) add('description.duplicate', 'warning', 'search', `Same description as ${dupDesc.map((o) => o.path).slice(0, 3).join(', ')}.`, 'description');

  if (!r.siteUrl) add('url.missing', 'error', 'search', 'Site URL is not set; canonical, Open Graph and sitemap URLs need it.', 'site:identity.url');
  if (r.siteUrl && r.url && !r.url.startsWith(r.siteUrl)) add('canonical.external', 'info', 'search', `Canonical points to another site: ${r.url}`, 'canonical');
  else if (r.siteUrl && r.url && r.url.replace(/\/$/, '') !== `${r.siteUrl}${r.path}`.replace(/\/$/, '')) add('canonical.other', 'info', 'search', `Canonical points to ${r.url}; this page stays out of the sitemap.`, 'canonical');
  if (r.siteUrl.startsWith('http://')) add('url.http', 'warning', 'search', 'Site URL uses http; use https.', 'site:identity.url');

  if (site.robots?.indexable === false) add('robots.site-noindex', 'warning', 'crawl', 'The whole site is set to noindex (staging mode).', 'site:robots.indexable');
  else if (!r.robots.indexable) add('robots.noindex', 'info', 'crawl', 'This page is noindex; it is left out of the sitemap and llms.txt.', 'robots.index');
  if (r.robots.directives.nosnippet) add('robots.nosnippet', 'info', 'crawl', 'nosnippet also keeps this page out of AI Overviews text.', 'robots.nosnippet');
  if (r.robots.directives.maxSnippet === 0) add('robots.maxsnippet', 'info', 'crawl', 'max-snippet:0 hides snippets and AI Overview quotes.', 'robots.maxSnippet');

  const blocked = blockedBots(site);
  const search = blocked.filter((b) => b.purpose === 'search');
  if (search.length && site.robots?.indexable !== false) add('bots.search', 'error', 'crawl', `robots.txt blocks search engines: ${search.map((b) => b.agent).join(', ')}.`, 'site:robots.preset');
  const ai = blocked.filter((b) => b.purpose === 'ai-search');
  if (ai.length && !search.length) add('bots.ai', 'info', 'crawl', `AI answer engines are blocked (${ai.map((b) => b.agent).join(', ')}); you won't be cited there.`, 'site:robots.preset');

  // Social
  const img = r.og.image;
  if (!img) add('og.image', 'warning', 'social', 'No share image; links show without a preview picture.', 'og.image');
  else {
    if (img.width && img.height) {
      const ratio = img.width / img.height;
      if (img.width < 1200) add('og.small', 'info', 'social', `Share image is ${img.width}px wide; 1200×630 is sharpest everywhere.`, 'og.image');
      if (Math.abs(ratio - 1.91) > 0.15) add('og.ratio', 'info', 'social', 'Share image is not 1.91:1; some apps will crop it.', 'og.image');
    } else add('og.size', 'info', 'social', 'Add the share image width and height so apps render it on first share.', 'og.imageWidth');
    if (!img.alt) add('og.alt', 'info', 'social', 'Share image has no alt text.', 'og.imageAlt');
    if (img.url.startsWith('http://')) add('og.http', 'warning', 'social', 'Share image uses http; some apps refuse it.', 'og.image');
  }

  // Content
  if (a) {
    if (!a.h1.length) add('h1.missing', 'warning', 'content', 'No h1 heading.');
    else if (a.h1.length > 1) add('h1.many', 'info', 'content', `${a.h1.length} h1 headings; one is clearer.`);
    let prev = 0;
    for (const h of a.headings) {
      if (prev && h.level > prev + 1) {
        add('headings.skip', 'info', 'content', `Heading jumps from h${prev} to h${h.level} ("${h.text.slice(0, 40)}").`);
        break;
      }
      prev = h.level;
    }
    const noAlt = a.images.filter((i) => i.alt === null);
    if (noAlt.length) add('img.alt', 'warning', 'content', `${noAlt.length} image${noAlt.length > 1 ? 's' : ''} without alt text.`);
    if (a.words < 150 && r.robots.indexable) add('content.thin', 'info', 'content', `Only ${a.words} words of main text.`);
    if (!a.hasViewport) add('tech.viewport', 'error', 'tech', 'No viewport meta tag; the page will not be mobile friendly.');
    if (!a.hasCharset) add('tech.charset', 'warning', 'tech', 'No <meta charset>.');
    const own = a.jsonLd.filter((j) => !JSON.stringify(j).includes('"#webpage"'));
    if (own.some((j) => (j as { invalid?: boolean }).invalid)) add('schema.invalid', 'error', 'schema', 'The page has a JSON-LD block that is not valid JSON.');
    const ownTypes = own.flatMap(types);
    const dup = ownTypes.filter((t) => t === 'Organization' || t === 'WebSite' || t === 'BreadcrumbList');
    if (dup.length) add('schema.duplicate', 'info', 'schema', `The page already has its own ${[...new Set(dup)].join(', ')} markup; u1webcore adds one too.`);
  }
  if (!r.lang) add('tech.lang', 'warning', 'tech', 'No page language.', 'site:identity.language');

  // Schema
  if (graph) {
    for (const i of checkSchema(graph, page)) add(`schema.${i.field}`, i.level, 'schema', i.message, `schema.data.${i.field}`);
    const t = schemaType(page.schema?.type);
    if (t?.rich === 'retired') add('schema.retired', 'info', 'schema', `${t.label}: Google no longer shows a rich result; still read by Bing and AI assistants.`);
    if (a && page.aeo?.faq?.length) {
      const text = a.text.toLowerCase();
      const missing = page.aeo.faq.filter((f) => !text.includes(f.question.toLowerCase().slice(0, 40)));
      if (missing.length) add('schema.faq-visible', 'warning', 'schema', `${missing.length} FAQ question${missing.length > 1 ? 's are' : ' is'} not visible on the page; structured data must match visible content.`, 'aeo.faq');
    }
  }
  if (!site.organization?.logo && r.isHome) add('org.logo', 'info', 'schema', 'No organization logo (≥112px) for Google knowledge panels.', 'site:organization.logo');
  return out;
}

const types = (j: unknown): string[] => {
  if (!j || typeof j !== 'object') return [];
  const o = j as Record<string, unknown>;
  const own = o['@type'] ? ([] as unknown[]).concat(o['@type']).map(String) : [];
  const graph = Array.isArray(o['@graph']) ? o['@graph'].flatMap(types) : [];
  return [...own, ...graph];
};

export type SiteCheck = Check & { path?: string };

/** Across all pages: duplicates, sitemap vs noindex, missing basics. */
export function checkSite(site: SiteSettings, pages: SitePage[]): SiteCheck[] {
  const out: SiteCheck[] = [];
  const by = (key: 'title' | 'description') => {
    const map = new Map<string, string[]>();
    for (const p of pages) if (p.indexable && p[key]) map.set(p[key], [...(map.get(p[key]) ?? []), p.path]);
    for (const [v, paths] of map) if (paths.length > 1) out.push({ id: `${key}.duplicate`, level: 'warning', group: 'search', message: `${paths.length} pages share the ${key} "${v.slice(0, 60)}": ${paths.slice(0, 5).join(', ')}` });
  };
  by('title');
  by('description');
  if (!site.identity?.url) out.push({ id: 'url.missing', level: 'error', group: 'search', message: 'Site URL is not set.', field: 'site:identity.url' });
  if (!site.identity?.name) out.push({ id: 'name.missing', level: 'warning', group: 'search', message: 'Site name is not set.', field: 'site:identity.name' });
  if (!site.social?.image) out.push({ id: 'og.default', level: 'info', group: 'social', message: 'No default share image.', field: 'site:social.image' });
  if (!site.icons?.favicon && !site.icons?.svg) out.push({ id: 'icons.favicon', level: 'info', group: 'tech', message: 'No favicon set in u1webcore (the page’s own is kept).', field: 'site:icons.favicon' });
  return [...out, ...complianceChecks(site)];
}

/** Privacy and cookie rules that depend on which tags are on. Not legal advice: they flag gaps. */
function complianceChecks(site: SiteSettings): SiteCheck[] {
  const out: SiteCheck[] = [];
  const active = (site.tags ?? []).filter((t) => t.enabled !== false);
  const categoryOf = (t: (typeof active)[number]) => t.consent ?? TAG_PRESETS.find((p) => p.kind === t.kind)?.consent ?? 'analytics';
  const tracking = active.filter((t) => categoryOf(t) !== 'necessary');
  const consentOn = !!site.consent?.enabled;
  if (tracking.length && !site.legal?.privacy) out.push({ id: 'legal.privacy', level: 'error', group: 'compliance', message: 'Tags load but there is no privacy policy URL.', field: 'site:legal.privacy' });
  if (tracking.length && !consentOn) out.push({ id: 'consent.off', level: 'error', group: 'compliance', message: 'Analytics or marketing tags load without a consent banner. Turn consent on.', field: 'site:consent.enabled' });
  if (active.length && !site.legal?.cookies) out.push({ id: 'legal.cookies', level: 'warning', group: 'compliance', message: 'Tags use cookies but there is no cookie policy URL.', field: 'site:legal.cookies' });
  if (active.some((t) => t.kind === 'gtm') && consentOn && !site.consent?.googleConsentMode) out.push({ id: 'consent.mode', level: 'warning', group: 'compliance', message: 'Google Tag Manager is on without Google Consent Mode.', field: 'site:consent.googleConsentMode' });
  if (consentOn && !site.consent?.respectGpc) out.push({ id: 'consent.gpc', level: 'warning', group: 'compliance', message: 'Global Privacy Control is not honoured. Turn on respectGpc for US state laws.', field: 'site:consent.respectGpc' });
  if (!site.organization?.email && !site.organization?.telephone) out.push({ id: 'legal.contact', level: 'warning', group: 'compliance', message: 'No contact email or phone for the organization (privacy and consumer rules expect one).', field: 'site:organization.email' });
  if (!site.legal?.terms) out.push({ id: 'legal.terms', level: 'info', group: 'compliance', message: 'No terms page URL set.', field: 'site:legal.terms' });
  return out;
}
