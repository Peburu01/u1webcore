import { expect, test } from 'bun:test';
import { alternatePaths, buildHead, fromAstroI18n, localeOf, renderHead, resolvePage, sitePage, sitemaps } from '../src';

const langs = fromAstroI18n({ locales: ['en', 'fr'], defaultLocale: 'en', routing: { prefixDefaultLocale: true } })!;

test('languages from Astro i18n (wuchale: prefixed default)', () => {
  expect(langs).toEqual({ locales: [{ code: 'en', prefix: '/en' }, { code: 'fr', prefix: '/fr' }], defaultLocale: 'en' });
  const unprefixed = fromAstroI18n({ locales: ['en', { path: 'french', codes: ['fr-FR'] }], defaultLocale: 'en' })!;
  expect(unprefixed.locales).toEqual([{ code: 'en', prefix: '' }, { code: 'fr-FR', prefix: '/french' }]);
  expect(localeOf('/pricing/', unprefixed)?.code).toBe('en');
  expect(localeOf('/french/pricing/', unprefixed)?.code).toBe('fr-FR');
});

test('alternates: every locale plus x-default', () => {
  expect(alternatePaths('/fr/pricing/', langs).map((a) => `${a.hreflang} ${a.path}`)).toEqual(['en /en/pricing/', 'fr /fr/pricing/', 'x-default /en/pricing/']);
  expect(alternatePaths('/fr/', langs).map((a) => a.path)).toEqual(['/en/', '/fr/', '/en/']);
  expect(alternatePaths('/x/', { locales: [{ code: 'en' }] })).toEqual([]);
});

test('head: lang, og:locale and hreflang links per locale', () => {
  const site = { identity: { url: 'https://acme.dev', name: 'Acme' }, languages: langs };
  const page = resolvePage({ site, path: '/fr/' });
  expect(page.lang).toBe('fr');
  expect(page.ogLocale).toBe('fr');
  const html = renderHead(buildHead(page, site));
  expect(html).toContain('<link rel="alternate" hreflang="en" href="https://acme.dev/en/">');
  expect(html).toContain('<link rel="alternate" hreflang="x-default" href="https://acme.dev/en/">');
  expect(html).toContain('<meta property="og:locale:alternate" content="en">');
});

test('sitemap: xhtml alternates for listed pages', () => {
  const site = { identity: { url: 'https://acme.dev' }, languages: langs };
  const xml = sitemaps(site, ['/en/', '/fr/'].map((path) => sitePage({ site, path })), 'https://acme.dev')[1].body;
  expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
  expect(xml).toContain('<xhtml:link rel="alternate" hreflang="fr" href="https://acme.dev/fr/"/>');
});
