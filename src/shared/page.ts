// One call per rendered page: resolve settings, build head + JSON-LD + tags, inject into the HTML.
import { analyze, detect } from '../checker/analyze';
import { buildHead, type HeadTag } from '../meta/head';
import { inject } from '../meta/rewrite';
import { resolvePage, type ResolvedPage } from './resolve';
import { buildGraph, type Graph } from '../schema/graph';
import { renderTags } from '../consent/tags';
import type { Detected, PageAnalysis, PageSettings, SiteSettings } from './types';
import { absolute, markdownPath } from './util';

export type RenderInput = {
  site: SiteSettings;
  page?: PageSettings;
  path: string;
  html: string;
  siteUrl?: string;
  lastmod?: string;
  /** Third-party tags and the consent banner (off in the editor preview). */
  tags?: boolean;
};

export type Rendered = { html: string; head: HeadTag[]; resolved: ResolvedPage; graph: Graph; detected: Detected; analysis: PageAnalysis };

export function pageHead(site: SiteSettings, page: PageSettings, resolved: ResolvedPage, text?: string): { head: HeadTag[]; graph: Graph } {
  const graph = buildGraph({ site, page, resolved, text });
  const llms = site.llms?.enabled !== false;
  const md = llms && site.llms?.markdownPages !== false && resolved.robots.indexable;
  const mdPath = markdownPath(resolved.path);
  const head = buildHead(resolved, site, {
    jsonLd: graph,
    markdownUrl: md ? absolute(mdPath, resolved.siteUrl) ?? mdPath : undefined,
    llmsUrl: llms ? absolute('/llms.txt', resolved.siteUrl) ?? '/llms.txt' : undefined,
  });
  return { head, graph };
}

export function renderPage({ site, page = {}, path, html, siteUrl, lastmod, tags = true }: RenderInput): Rendered {
  const detected = detect(html);
  const resolved = resolvePage({ site, page, path, detected, siteUrl, lastmod });
  const analysis = analyze(html);
  const { head, graph } = pageHead(site, page, resolved, analysis.text);
  const t = tags ? renderTags(site, { path: resolved.path, page }) : {};
  return { html: inject(html, { head, lang: resolved.lang, ...t }), head, resolved, graph, detected, analysis };
}
