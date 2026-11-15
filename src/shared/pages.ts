// One entry per built page: the facts sitemaps, llms.txt, feeds and site checks are built from.
import { analyze, detect } from '../checker/analyze';
import { resolvePage, type ResolvedPage } from './resolve';
import type { PageAnalysis, PageSettings, SiteSettings } from './types';
import { absolute, markdownPath, matchPath } from './util';
import { toMarkdown } from '../aeo/markdown';

export type SitePage = {
  path: string;
  url: string;
  title: string;
  pageTitle: string;
  description: string;
  lang: string;
  indexable: boolean;
  /** Canonical points at this page (not a duplicate of another URL). */
  canonicalSelf: boolean;
  lastmod?: string;
  datePublished?: string;
  dateModified?: string;
  images: { url: string; title?: string }[];
  settings: PageSettings;
  markdown?: string;
  resolved: ResolvedPage;
  analysis?: PageAnalysis;
};

export type SitePageInput = { site: SiteSettings; page?: PageSettings; path: string; html?: string; siteUrl?: string; lastmod?: string; markdown?: boolean };

export function sitePage({ site, page = {}, path, html, siteUrl, lastmod, markdown }: SitePageInput): SitePage {
  const detected = html ? detect(html) : {};
  const r = resolvePage({ site, page, path, detected, siteUrl, lastmod });
  const analysis = html ? analyze(html) : undefined;
  const own = r.siteUrl ? `${r.siteUrl}${r.path}` : r.url;
  const images = (analysis?.images ?? [])
    .map((i) => ({ url: absolute(i.src, r.siteUrl) ?? '', title: i.alt || undefined }))
    .filter((i) => i.url && !i.url.startsWith('data:') && sameHost(i.url, r.siteUrl));
  return {
    path: r.path,
    url: r.url,
    title: r.title,
    pageTitle: r.pageTitle,
    description: r.description,
    lang: r.lang,
    indexable: r.robots.indexable,
    canonicalSelf: !r.url || stripSlash(r.url) === stripSlash(own),
    lastmod: page.sitemap?.lastmod ?? r.dateModified ?? lastmod,
    datePublished: r.datePublished,
    dateModified: r.dateModified,
    images: dedupe(images),
    settings: page,
    markdown: html && markdown ? toMarkdown(html, { base: r.siteUrl, title: r.pageTitle, url: r.url || undefined }) : undefined,
    resolved: r,
    analysis,
  };
}

import { isUtilityPath } from './util';
export { isUtilityPath };

export function inSitemap(p: SitePage, site: SiteSettings): boolean {
  if (!p.indexable || !p.canonicalSelf || p.settings.sitemap?.include === false || isUtilityPath(p.path)) return false;
  return !(site.sitemap?.exclude ?? []).some((pat) => matchPath(pat, p.path));
}

export function inLlms(p: SitePage, site: SiteSettings): boolean {
  if (p.settings.llms?.include === false || !p.indexable || !p.canonicalSelf || isUtilityPath(p.path)) return false;
  return p.settings.llms?.include === true || !(site.sitemap?.exclude ?? []).some((pat) => matchPath(pat, p.path));
}

export const markdownUrl = (p: SitePage) => absolute(markdownPath(p.path), p.resolved.siteUrl) ?? markdownPath(p.path);

const stripSlash = (u: string) => u.replace(/\/+$/, '').toLowerCase();
const sameHost = (url: string, site: string) => {
  if (!site) return true;
  try {
    return new URL(url).host === new URL(site).host;
  } catch {
    return false;
  }
};
const dedupe = <T extends { url: string }>(list: T[]) => [...new Map(list.map((i) => [i.url, i])).values()];
