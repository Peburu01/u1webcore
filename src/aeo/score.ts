// AEO/GEO score: how easy the page is for answer engines (AI Overviews, ChatGPT, Claude, Perplexity) to
// quote and cite. Heuristics from published GEO studies and engine docs: a direct answer up front, question
// headings, concrete facts and sources, freshness, a named author, clean structure, linked entities.
import { blockedBots } from '../crawl/robots';
import type { ResolvedPage } from '../shared/resolve';
import type { PageAnalysis, PageSettings, SiteSettings } from '../shared/types';
import { wordCount } from '../shared/util';

export type AeoItem = { id: string; label: string; weight: number; pass: boolean; partial?: boolean; tip: string; field?: string };
export type AeoScore = { score: number; items: AeoItem[] };

const QUESTION = /^(how|what|why|when|where|which|who|can|does|do|is|are|should|will)\b|\?$/i;

export function aeoScore({ site, page, resolved: r, analysis: a, now = new Date() }: { site: SiteSettings; page: PageSettings; resolved: ResolvedPage; analysis?: PageAnalysis; now?: Date }): AeoScore {
  const items: AeoItem[] = [];
  const add = (i: AeoItem) => items.push(i);
  const summaryWords = wordCount(page.aeo?.summary ?? '');
  const firstPara = (a?.intro ?? '').split(/(?<=[.!?])\s/).slice(0, 2).join(' ');

  add({
    id: 'answer', label: 'Answer first', weight: 15, field: 'aeo.summary',
    pass: summaryWords >= 30 && summaryWords <= 80,
    partial: summaryWords > 0 || (wordCount(firstPara) >= 15 && wordCount(firstPara) <= 70),
    tip: 'Open with a 40–60 word direct answer to the page’s main question.',
  });
  const h = (a?.headings ?? []).filter((x) => x.level >= 2 && x.level <= 3);
  const questions = h.filter((x) => QUESTION.test(x.text)).length;
  add({ id: 'questions', label: 'Question headings', weight: 10, pass: questions >= 2, partial: questions === 1, tip: 'Phrase some h2/h3 headings as the questions people ask.' });
  add({ id: 'structure', label: 'Clear structure', weight: 10, pass: (a?.h1.length ?? 0) === 1 && h.length >= 2, partial: h.length >= 1, tip: 'One h1, then sections with h2/h3 headings.' });
  const stats = (a?.text.match(/\b\d[\d,.]*\s?(%|percent|x|k|m|million|billion|years?|days?|hours?|₹|\$|€|£)/gi) ?? []).length;
  add({ id: 'facts', label: 'Concrete facts', weight: 10, pass: stats >= 3, partial: stats >= 1, tip: 'Include specific numbers, dates and measurable claims.' });
  const host = safeHost(r.siteUrl);
  const outbound = (a?.links ?? []).filter((l) => /^https?:/.test(l.href) && safeHost(l.href) !== host).length;
  const cites = (page.aeo?.citations?.length ?? 0) + outbound;
  add({ id: 'sources', label: 'Cites sources', weight: 10, pass: cites >= 2, partial: cites === 1, tip: 'Link to the sources behind your claims (and list them under Citations).', field: 'aeo.citations' });
  const modified = r.dateModified ?? page.sitemap?.lastmod;
  const age = modified ? (now.getTime() - new Date(modified).getTime()) / 864e5 : Infinity;
  add({ id: 'fresh', label: 'Fresh', weight: 10, pass: age <= 365, partial: age <= 730, tip: 'Show a last-updated date and keep it current.', field: 'aeo.dateModified' });
  add({ id: 'author', label: 'Named author', weight: 8, pass: !!page.aeo?.author?.name && !!(page.aeo.author.url || page.aeo.author.sameAs?.length), partial: !!page.aeo?.author?.name || !!site.organization?.name, tip: 'Name the author with a profile link (expertise signals).', field: 'aeo.author' });
  const entities = [...(page.aeo?.about ?? []), ...(page.aeo?.mentions ?? [])];
  add({ id: 'entities', label: 'Linked entities', weight: 7, pass: entities.some((e) => e.sameAs), partial: entities.length > 0, tip: 'Add what the page is about, linked to Wikipedia/Wikidata.', field: 'aeo.about' });
  add({ id: 'faq', label: 'FAQ', weight: 6, pass: (page.aeo?.faq?.length ?? 0) >= 3, partial: (page.aeo?.faq?.length ?? 0) > 0, tip: 'Answer 3+ common questions on the page.', field: 'aeo.faq' });
  add({ id: 'schema', label: 'Structured data', weight: 6, pass: !!page.schema?.type && page.schema.type !== 'WebPage', partial: true, tip: 'Pick the schema type that matches the page.', field: 'schema.type' });
  const words = a?.words ?? 0;
  add({ id: 'depth', label: 'Depth', weight: 4, pass: words >= 500, partial: words >= 250, tip: 'Cover the topic fully; very short pages are rarely cited.' });
  const ai = blockedBots(site).filter((b) => b.purpose === 'ai-search' || b.purpose === 'search');
  add({ id: 'crawlable', label: 'AI engines allowed', weight: 4, pass: !ai.length && r.robots.indexable && !r.robots.directives.nosnippet, tip: 'Allow AI search crawlers and avoid nosnippet.', field: 'site:robots.preset' });

  const total = items.reduce((s, i) => s + i.weight, 0);
  const got = items.reduce((s, i) => s + (i.pass ? i.weight : i.partial ? i.weight / 2 : 0), 0);
  return { score: Math.round((got / total) * 100), items };
}

const safeHost = (u: string) => {
  try {
    return new URL(u).host;
  } catch {
    return '';
  }
};
