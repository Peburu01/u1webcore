// Small shared helpers: escaping, URLs, text, settings files.
import type { PageSettings } from './types';

export const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const escapeXml = (s: string) => escapeHtml(s).replace(/'/g, '&apos;');

/** JSON for inside <script>: no "</script>" breakouts, no U+2028/9 surprises. */
export const scriptJson = (value: unknown, indent?: number) =>
  JSON.stringify(value, null, indent)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

export const isAbsolute = (url: string) => /^[a-z][a-z\d+.-]*:/i.test(url) || url.startsWith('//');

/** "https://x.com/" → "https://x.com" */
export const origin = (url: string | undefined) => (url ? url.trim().replace(/\/+$/, '') : '');

export function absolute(url: string | undefined, base: string): string | undefined {
  const u = url?.trim();
  if (!u) return undefined;
  if (isAbsolute(u)) return u.startsWith('//') ? `https:${u}` : u;
  if (!base) return undefined;
  return `${origin(base)}${u.startsWith('/') ? '' : '/'}${u}`;
}

/** Applies the trailing-slash policy to a path (files like /a.xml are left alone). */
export function normalizePath(path: string, policy: 'always' | 'never' | 'ignore' = 'ignore'): string {
  let p = path.split(/[?#]/)[0] || '/';
  if (!p.startsWith('/')) p = `/${p}`;
  p = p.replace(/\/{2,}/g, '/');
  if (p === '/' || policy === 'ignore' || /\.[a-z0-9]+$/i.test(p)) return p;
  return policy === 'always' ? p.replace(/\/?$/, '/') : p.replace(/\/+$/, '');
}

/** Site-wide settings, relative to the project root. */
export const SITE_FILE = 'src/site.u1wc.json';

/** A page's settings file sits next to its route file: src/pages/contact.astro → src/pages/contact.u1wc.json */
export const sidecarFor = (entrypoint: string) => entrypoint.replace(/\.[a-z]+$/i, '.u1wc.json');

/** Normalized page path, the key for one URL's settings: "/" or "/a/b" (no trailing slash, query or index). */
export function pageKey(path: string): string {
  const clean = path.split(/[?#]/)[0].replace(/\.html$/, '').replace(/\/index$/, '').replace(/\/+$/, '');
  return clean.startsWith('/') ? clean || '/' : `/${clean}`;
}

/** Error pages and similar never go into sitemaps, feeds, llms.txt or share cards. */
export const isUtilityPath = (path: string) => /^\/(?:404|500|_[^/]*)(?:\/|\.html)?$/.test(path) || /\/(?:404|500)\/?$/.test(path);

/** Where a page's generated share card is served: "/" → /og/index.png, "/a/b" → /og/a/b.png */
export const cardPath = (path: string) => `/og${pageKey(path) === '/' ? '/index' : pageKey(path)}.png`;

/**
 * A page route and its settings file. A static route's file holds that page's settings; a dynamic route's
 * (projects/[slug].astro) holds one entry per URL: { "/projects/oasis": {...} }.
 */
export type PageRoute = { pattern: string; re: string; file: string; dynamic: boolean };

/** The route that renders `path`: by Astro's route pattern when known, else the first regex that matches. */
export function routeFor(routes: PageRoute[], path: string, pattern?: string): PageRoute | undefined {
  const byPattern = pattern ? routes.find((r) => r.pattern === pattern) : undefined;
  if (byPattern) return byPattern;
  const bare = path.replace(/\/+$/, '') || '/';
  return routes.find((r) => {
    try {
      const re = new RegExp(r.re);
      return re.test(path) || re.test(bare) || re.test(`${bare}/`.replace(/\/{2}$/, '/'));
    } catch {
      return false;
    }
  });
}

/** Key of `path`'s settings in its route's file: the URL for a dynamic route, else empty (the file is the page). */
export const entryKey = (route: PageRoute, path: string) => (route.dynamic ? pageKey(path) : '');

/** `path`'s settings, from the settings files' contents (by file). */
export function pageSettings(files: Record<string, Record<string, unknown>>, route: PageRoute | undefined, path: string): PageSettings | undefined {
  const file = route && files[route.file];
  if (!file) return undefined;
  const v = route.dynamic ? file[pageKey(path)] : file;
  return isRecord(v) ? (v as PageSettings) : undefined;
}

export const collapse = (s: string) => s.replace(/\s+/g, ' ').trim();

export const clip = (s: string, max: number) => (s.length <= max ? s : `${s.slice(0, max - 1).replace(/\s+\S*$/, '')}…`);

export const nonEmpty = <T>(list: (T | undefined | null | false | '')[] | undefined): T[] => (list ?? []).filter(Boolean) as T[];

export const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Deep merge for plain objects; arrays and scalars from `b` replace `a`. undefined in `b` keeps `a`. */
export function merge<T>(a: T, b: unknown): T {
  if (!isRecord(a) || !isRecord(b)) return (b === undefined ? a : b) as T;
  const out: Record<string, unknown> = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = v === undefined ? out[k] : merge(out[k], v);
  return out as T;
}

/** "about-us" → "About us" */
export const humanize = (slug: string) => {
  const s = decodeURIComponent(slug).replace(/[-_]+/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export const wordCount = (s: string) => (s.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length;

/** "/blog/*" or "/drafts/**" style patterns ("*" = one segment, "**" = anything). Plain paths match as prefixes. */
export function matchPath(pattern: string, path: string): boolean {
  if (!pattern.includes('*')) return path === pattern || path.startsWith(pattern.endsWith('/') ? pattern : `${pattern}/`);
  const re = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '\u0000').replace(/\*/g, '[^/]*').replace(/\u0000/g, '.*');
  return new RegExp(`^${re}$`).test(path);
}

/** Route path → its markdown copy: "/" → "/index.md", "/a/b/" → "/a/b.md". */
export const markdownPath = (path: string) => `${path.replace(/\/+$/, '').replace(/\.html$/, '') || '/index'}.md`;

export const isoDate = (d: string | Date | undefined) => {
  if (!d) return undefined;
  const t = new Date(d);
  return Number.isNaN(t.getTime()) ? undefined : t.toISOString();
};
