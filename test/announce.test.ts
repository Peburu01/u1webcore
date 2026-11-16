import { expect, test } from 'bun:test';
import { announceBody, renderPage } from '../src/index';

const html = '<!doctype html><html><head><title>x</title></head><body><h1>Hi</h1></body></html>';

test('announcements: script only with an API origin and site key, safe to embed', () => {
  expect(announceBody(null)).toBe('');
  expect(announceBody({ api: 'https://api.example.com' })).toBe('');
  const s = announceBody({ api: 'https://api.example.com/', key: 'sk_</script>' });
  expect(s).toContain('"api":"https://api.example.com"');
  expect(s).not.toContain('sk_</script>');
  // The runtime is embedded whole: it must not reach for anything outside itself.
  expect(() => new Function(s.replace(/^<script>|<\/script>\n$/g, '').replace(/^\(/, 'return (').replace(/\)\(\{[\s\S]*\);$/, ')'))()).not.toThrow();
});

test('announcements: injected before </body>; the site settings can turn them off', () => {
  const announce = { api: 'https://api.example.com', key: 'sk_1' };
  const on = renderPage({ site: {}, path: '/', html, announce, tags: false }).html;
  expect(on).toMatch(/__u1a[\s\S]*<\/body>/);
  const off = renderPage({ site: { announcements: { enabled: false } }, path: '/', html, announce }).html;
  expect(off).not.toContain('__u1a');
});
