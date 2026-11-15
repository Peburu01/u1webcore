import { describe, expect, test } from 'bun:test';
import { renderPage, renderTags, tagApplies, type SiteSettings } from '../src/index';

const site = (extra: Partial<SiteSettings> = {}): SiteSettings => ({ identity: { name: 'Acme', url: 'https://acme.test' }, ...extra });

describe('tag rules by path', () => {
  test('no rules means every page; exclude wins; include narrows', () => {
    expect(tagApplies(undefined, '/anything')).toBe(true);
    expect(tagApplies({ include: ['/shop'] }, '/shop/cart')).toBe(true);
    expect(tagApplies({ include: ['/shop'] }, '/about')).toBe(false);
    expect(tagApplies({ include: ['/'] }, '/about')).toBe(true);
    expect(tagApplies({ exclude: ['/admin'] }, '/admin/x')).toBe(false);
    expect(tagApplies({ include: ['/shop'], exclude: ['/shop/cart'] }, '/shop/cart')).toBe(false);
  });

  test('a prefix does not match a longer word', () => {
    expect(tagApplies({ include: ['/shop'] }, '/shopping')).toBe(false);
  });
});

describe('tag manager output', () => {
  test('server-side GTM serves the loader and iframe from the site domain', () => {
    const t = renderTags(site({ tags: [{ id: 'g', kind: 'gtm', value: 'GTM-ABC123', serverUrl: 'https://tags.acme.test/' }] }));
    expect(t.headStart).toContain('https://tags.acme.test/gtm.js');
    expect(t.headStart).not.toContain('www.googletagmanager.com');
    expect(t.bodyStart).toContain('https://tags.acme.test/ns.html?id=GTM-ABC123');
  });

  test('a tag limited to other paths is not rendered on this page', () => {
    const tags = [{ id: 'p', kind: 'meta' as const, value: '123456789012', paths: { include: ['/shop'] } }];
    expect(renderTags(site({ tags }), { path: '/about' }).headStart).toBe('');
    expect(renderTags(site({ tags }), { path: '/shop' }).headStart).toContain('fbq');
  });

  test('page dataLayer is pushed before the tags', () => {
    const t = renderTags(site({ tags: [{ id: 'g', kind: 'gtm', value: 'GTM-ABC123' }] }), { page: { dataLayer: { pageType: 'product', sku: 'A1' } } });
    expect(t.headStart.indexOf('"pageType":"product"')).toBeGreaterThan(-1);
    expect(t.headStart.indexOf('"pageType":"product"')).toBeLessThan(t.headStart.indexOf('gtm.js'));
  });

  test('triggers push events for clicks, submits and views', () => {
    const t = renderTags(site({ tagManager: { triggers: [{ id: 'c', name: 'cta_click', on: 'click', selector: '.cta', params: { location: 'hero' } }, { id: 'v', name: 'pricing_view', on: 'view', selector: '#pricing' }] } }));
    expect(t.bodyEnd).toContain('"name":"cta_click"');
    expect(t.bodyEnd).toContain('"on":"view"');
    expect(t.bodyEnd).toContain('IntersectionObserver');
  });

  test('a page with a trigger script still renders and the trigger JSON cannot break out of the script tag', () => {
    const out = renderPage({
      site: site({ tagManager: { triggers: [{ id: 'x', name: '</script><b>', on: 'click', selector: '.a' }] } }),
      path: '/',
      html: '<!doctype html><html><head><title>Home</title></head><body><main>Hi</main></body></html>',
      siteUrl: 'https://acme.test',
    });
    expect(out.html).not.toContain('</script><b>');
    expect(out.html).toContain('\\u003c/script>');
  });
});
