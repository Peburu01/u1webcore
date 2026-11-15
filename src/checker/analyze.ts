// Reads a rendered page: what it already declares (fallbacks for settings) and content facts for checks.
import { find, findAll, innerRange, textOf, tokens, tree, type Node } from '../shared/html';
import type { Detected, PageAnalysis } from '../shared/types';
import { collapse, wordCount } from '../shared/util';

export function detect(html: string): Detected {
  const head = innerRange(html, 'head');
  const out: Detected = {};
  for (const t of tokens(html, 0, head?.[1] ?? Math.min(html.length, 200_000))) {
    if (t.type === 'open' && t.name === 'html' && t.attrs.lang) out.lang = t.attrs.lang;
    if (t.type !== 'open') continue;
    const a = t.attrs;
    if (t.name === 'title') {
      const close = html.toLowerCase().indexOf('</title', t.end);
      out.title ??= collapse(textOf(tree(html, t.end, close === -1 ? t.end : close)));
    } else if (t.name === 'meta') {
      const key = (a.name ?? a.property ?? '').toLowerCase();
      if (key === 'description') out.description ??= a.content;
      if (key === 'og:image') out.ogImage ??= a.content;
      if (key === 'theme-color') out.themeColor ??= a.content;
    } else if (t.name === 'link') {
      const rel = (a.rel ?? '').toLowerCase();
      if (rel === 'canonical') out.canonical ??= a.href;
      if (/\bicon\b/.test(rel) && !out.favicon) out.favicon = a.href;
    }
  }
  return out;
}

export function analyze(html: string): PageAnalysis {
  const doc = tree(html);
  const main = find(doc, (n) => n.name === 'main') ?? find(doc, (n) => n.name === 'body') ?? doc;
  const all = find(doc, (n) => n.name === 'body') ?? doc;
  const text = collapse(textOf(main));
  const headings = findAll(all, (n) => /^h[1-6]$/.test(n.name)).map((n) => ({ level: Number(n.name[1]), text: collapse(textOf(n)) }));
  const metas = findAll(doc, (n) => n.name === 'meta');
  const jsonLd: unknown[] = [];
  for (const s of findAll(doc, (n) => n.name === 'script' && (n.attrs.type ?? '').toLowerCase() === 'application/ld+json')) {
    try {
      jsonLd.push(JSON.parse(s.children.join('')));
    } catch {
      jsonLd.push({ invalid: true });
    }
  }
  return {
    h1: headings.filter((h) => h.level === 1).map((h) => h.text),
    headings,
    images: findAll(all, (n) => n.name === 'img').map((n) => ({ src: n.attrs.src ?? '', alt: 'alt' in n.attrs ? n.attrs.alt : null })),
    links: findAll(all, (n) => n.name === 'a' && !!n.attrs.href).map((n: Node) => ({ href: n.attrs.href, text: collapse(textOf(n)) })),
    words: wordCount(text),
    intro: text.slice(0, 600),
    text,
    hasViewport: metas.some((m) => m.attrs.name === 'viewport'),
    hasCharset: metas.some((m) => 'charset' in m.attrs) || /<meta[^>]+charset/i.test(html.slice(0, 2048)),
    jsonLd,
    nosnippet: findAll(all, (n) => 'data-nosnippet' in n.attrs).length,
  };
}
