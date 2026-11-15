import { expect, test } from 'bun:test';
import { buildGraph, resolvePage } from '../src/index';
test('branch page overrides org fields only on that page', () => {
  const site = { identity: { name: 'Acme', url: 'https://acme.test' }, organization: { type: 'Hospital', name: 'Acme Health', telephone: '+91 1', address: { addressLocality: 'Bengaluru' } } } as any;
  const page = { organization: { name: 'Acme Whitefield', address: { addressLocality: 'Whitefield' }, telephone: '+91 2' } } as any;
  const resolved = resolvePage({ site, page, path: '/whitefield/', siteUrl: 'https://acme.test' } as any);
  const g = buildGraph({ site, page, resolved, text: 'x' } as any);
  const org = g['@graph'].find((n: any) => n['@type'] === 'Hospital') as any;
  expect(org.name).toBe('Acme Whitefield');
  expect(org.telephone).toBe('+91 2');
  expect(org.address.addressLocality).toBe('Whitefield');
  const other = buildGraph({ site, page: {}, resolved: resolvePage({ site, path: '/', siteUrl: 'https://acme.test' } as any), text: 'x' } as any);
  expect((other['@graph'].find((n: any) => n['@type'] === 'Hospital') as any).name).toBe('Acme Health');
});
