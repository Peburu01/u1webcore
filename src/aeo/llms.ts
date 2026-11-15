// llms.txt (https://llmstxt.org): H1 name, blockquote summary, free text, then H2 sections of
// "- [title](url): notes" links. A section titled "Optional" holds links agents may skip.
// llms-full.txt is the same index followed by every listed page's markdown.
import type { LlmsLink, SiteSettings } from '../shared/types';
import { collapse, humanize } from '../shared/util';
import { inLlms, markdownUrl, type SitePage } from '../shared/pages';

export function llmsSections(site: SiteSettings, pages: SitePage[]): { title: string; links: LlmsLink[] }[] {
  const md = site.llms?.markdownPages !== false;
  const sections = new Map<string, LlmsLink[]>();
  const add = (title: string, link: LlmsLink) => {
    const list = sections.get(title) ?? [];
    if (!list.some((l) => l.url === link.url)) list.push(link);
    sections.set(title, list);
  };
  for (const s of site.llms?.sections ?? []) for (const l of s.links) add(s.title, l);
  const listed = new Set([...sections.values()].flat().map((l) => l.url));

  const auto = pages.filter((p) => inLlms(p, site)).sort((a, b) => depth(a.path) - depth(b.path) || a.path.localeCompare(b.path));
  for (const p of auto) {
    const url = md ? markdownUrl(p) : p.url;
    if (listed.has(url) || listed.has(p.url)) continue;
    const seg = p.resolved.path.split('/').filter(Boolean)[0];
    const title = p.settings.llms?.section ?? (p.resolved.isHome || !seg || depth(p.path) === 1 ? 'Pages' : humanize(seg));
    const notes = collapse(p.settings.llms?.notes ?? p.settings.aeo?.summary ?? p.description);
    add(title, { title: p.settings.llms?.title ?? p.pageTitle ?? p.path, url, notes: notes || undefined });
  }
  const out = [...sections.entries()].map(([title, links]) => ({ title, links }));
  // "Optional" always last, per spec.
  return [...out.filter((s) => s.title.toLowerCase() !== 'optional'), ...out.filter((s) => s.title.toLowerCase() === 'optional')];
}

export function llmsTxt(site: SiteSettings, pages: SitePage[]): string {
  const name = site.identity?.name || site.organization?.name || 'Website';
  const summary = collapse(site.llms?.summary ?? site.identity?.description ?? site.organization?.description ?? '');
  const parts = [`# ${name}`];
  if (summary) parts.push(`> ${summary}`);
  if (site.llms?.details?.trim()) parts.push(site.llms.details.trim());
  for (const s of llmsSections(site, pages)) {
    if (!s.links.length) continue;
    parts.push(`## ${s.title}\n\n${s.links.map((l) => `- [${l.title.replace(/[[\]]/g, '')}](${l.url})${l.notes ? `: ${l.notes}` : ''}`).join('\n')}`);
  }
  return `${parts.join('\n\n')}\n`;
}

export function llmsFullTxt(site: SiteSettings, pages: SitePage[]): string {
  const head = llmsTxt(site, pages).split('\n## ')[0].trim();
  const body = pages
    .filter((p) => inLlms(p, site) && p.markdown)
    .sort((a, b) => depth(a.path) - depth(b.path) || a.path.localeCompare(b.path))
    .map((p) => p.markdown!.trim().replace(/^# /gm, '## ').replace(/^## /, '# '));
  return `${[head, ...body].join('\n\n---\n\n')}\n`;
}

const depth = (p: string) => p.split('/').filter(Boolean).length;
