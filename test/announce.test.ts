import { expect, test } from 'bun:test';
import { announceBody, renderPage, toAnnouncement } from '../src/index';

const html = '<!doctype html><html><head><title>x</title></head><body><h1>Hi</h1></body></html>';

const item = toAnnouncement({ id: 'a1', name: 'News', kind: 'bar', status: 'on', content: { title: '</script>' }, appearance: { tone: 'brand', dismissible: true }, trigger: { on: 'load' }, pages: { mode: 'all' }, frequency: { mode: 'until-closed' } });

test('announcements: script only when one is on, safe to embed', () => {
  expect(announceBody(null)).toBe('');
  expect(announceBody({ api: 'https://api.example.com', key: 'sk_1' })).toBe('');
  const s = announceBody({ api: 'https://api.example.com/', key: 'sk_</script>', items: [item] });
  expect(s).toContain('"api":"https://api.example.com"');
  expect(s).not.toContain('sk_</script>');
  // The runtime is embedded whole: it must not reach for anything outside itself.
  expect(() => new Function(s.replace(/^<script>|<\/script>\n$/g, '').replace(/^\(/, 'return (').replace(/\)\(\{[\s\S]*\);$/, ')'))()).not.toThrow();
});

test('announcements: injected before </body> when one is on, nothing otherwise', () => {
  const a = toAnnouncement({ id: 'a1', name: 'News', kind: 'bar', status: 'on', content: { title: 'Hi' }, appearance: { tone: 'brand', dismissible: true }, trigger: { on: 'load' }, pages: { mode: 'all' }, frequency: { mode: 'until-closed' } });
  const on = renderPage({ site: {}, path: '/', html, announce: { items: [a] }, tags: false }).html;
  expect(on).toMatch(/__u1a[\s\S]*<\/body>/);
  expect(renderPage({ site: {}, path: '/', html, announce: null }).html).not.toContain('__u1a');
});
