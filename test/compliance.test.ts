import { expect, test } from 'bun:test';
import { checkSite } from '../src/checker/checks';

const ids = (site: any) => checkSite(site, []).map((c) => c.id);

test('tracking without consent, privacy or cookie policy is flagged', () => {
  const found = ids({ identity: { name: 'A', url: 'https://a.test' }, tags: [{ id: 'g', kind: 'gtm', value: 'GTM-1', enabled: true }] });
  expect(found).toContain('legal.privacy');
  expect(found).toContain('consent.off');
  expect(found).toContain('legal.cookies');
});

test('a fully set up site passes the error-level checks', () => {
  const site = {
    identity: { name: 'A', url: 'https://a.test' },
    organization: { email: 'hi@a.test' },
    legal: { privacy: '/privacy', cookies: '/cookies', terms: '/terms' },
    consent: { enabled: true, googleConsentMode: true, respectGpc: true },
    tags: [{ id: 'g', kind: 'gtm', value: 'GTM-1', enabled: true }],
  } as any;
  const errors = checkSite(site, []).filter((c) => c.group === 'compliance' && c.level === 'error');
  expect(errors).toEqual([]);
});
