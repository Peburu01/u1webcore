// Translated sites: which locale a path is in, the same page in the other locales (hreflang), and the locales Astro's
// own `i18n` config declares (what i18n libraries like wuchale set), used when the site settings name none.
import type { Locale, SiteSettings } from './types';

export type Languages = NonNullable<SiteSettings['languages']>;
export type Alternate = { hreflang: string; path: string; ogLocale?: string };

/** A locale's URL prefix without a trailing slash: "/fr", or "" for an unprefixed default. */
export const prefixOf = (l: Locale) => (l.prefix ?? `/${l.code}`).replace(/\/+$/, '');

/** The locale a path belongs to: the longest matching prefix, else the unprefixed one. */
export function localeOf(path: string, langs?: Languages): Locale | undefined {
  const all = langs?.locales ?? [];
  const hit = all
    .filter((l) => prefixOf(l) && (path === prefixOf(l) || path.startsWith(`${prefixOf(l)}/`)))
    .sort((a, b) => prefixOf(b).length - prefixOf(a).length)[0];
  return hit ?? all.find((l) => !prefixOf(l));
}

/** The same page in another locale: `/fr/pricing/` → `/de/pricing/`. */
export function localizedPath(path: string, from: Locale | undefined, to: Locale): string {
  const rest = from && prefixOf(from) ? path.slice(prefixOf(from).length) : path;
  const out = `${prefixOf(to)}${rest.startsWith('/') ? rest : `/${rest}`}`;
  return out || '/';
}

/**
 * hreflang alternates for a page: every locale's version of it, plus x-default (`xDefault`, else the default locale).
 * Empty unless the site has two or more locales and the path is in one of them.
 */
export function alternatePaths(path: string, langs?: Languages): Alternate[] {
  const all = langs?.locales ?? [];
  const here = localeOf(path, langs);
  if (all.length < 2 || !here) return [];
  const out: Alternate[] = all.map((l) => ({ hreflang: l.code, path: localizedPath(path, here, l), ogLocale: ogLocaleOf(l) }));
  const x = all.find((l) => l.code === (langs?.xDefault || langs?.defaultLocale)) ?? all[0];
  out.push({ hreflang: 'x-default', path: localizedPath(path, here, x) });
  return out;
}

/** Open Graph form of a locale: "en_GB", or the language alone ("fr"). */
export const ogLocaleOf = (l: Locale) => l.ogLocale ?? l.code.replace('-', '_');

type AstroI18n = { locales?: (string | { path: string; codes: string[] })[]; defaultLocale?: string; routing?: unknown };

/** Languages from Astro's `i18n` config: `/<locale>` prefixes, the default unprefixed unless `prefixDefaultLocale`. */
export function fromAstroI18n(i18n: AstroI18n | undefined): Languages | undefined {
  if (!i18n?.locales?.length) return undefined;
  const routing = i18n.routing && typeof i18n.routing === 'object' ? (i18n.routing as { prefixDefaultLocale?: boolean }) : {};
  const locales: Locale[] = i18n.locales.map((l) => {
    const path = typeof l === 'string' ? l : l.path;
    const code = typeof l === 'string' ? l : (l.codes[0] ?? l.path);
    return { code, prefix: path === i18n.defaultLocale && !routing.prefixDefaultLocale ? '' : `/${path}` };
  });
  const def = locales.find((_, i) => (typeof i18n.locales![i] === 'string' ? i18n.locales![i] : (i18n.locales![i] as { path: string }).path) === i18n.defaultLocale);
  return { locales, defaultLocale: def?.code ?? locales[0].code };
}
