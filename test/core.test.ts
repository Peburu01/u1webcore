import { describe, expect, test } from 'bun:test';
import {
  aeoScore, buildGraph, checkPage, checkRedirects, hold, inject, llmsTxt, markdownPath, pageKey, pageSettings, routeFor, sidecarFor, cardPath, auditSite, internalPath, renderPage, renderTags, resolvePage,
  robotsTxt, siteFiles, sitePage, textWidth, toMarkdown, truncateTo, type SiteSettings,
} from '../src/index';

const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width">
  <title>Old title</title>
  <meta name="description" content="Old description">
  <link rel="stylesheet" href="/a.css">
  <script type="application/ld+json">{"@type":"Thing"}</script>
</head>
<body>
  <header><nav><a href="/">Home</a></nav></header>
  <main>
    <h1>Acme pricing</h1>
    <p>Acme costs <strong>₹499</strong> a month for 3 users. See <a href="https://example.org/study">the study</a>.</p>
    <h2>How do refunds work?</h2>
    <ul><li>Full refund in 30 days</li><li>Pro-rated after</li></ul>
    <img src="/hero.png">
    <pre><code class="language-js">const a = 1 &lt; 2;</code></pre>
  </main>
  <footer>© Acme</footer>
</body>
</html>`;

const site: SiteSettings = {
  identity: { name: 'Acme', url: 'https://acme.test/', titleTemplate: '%s · Acme', language: 'en' },
  organization: { name: 'Acme Inc', logo: '/logo.png' },
  social: { image: '/og.png', imageWidth: 1200, imageHeight: 630, profiles: ['https://www.linkedin.com/company/acme'] },
  llms: { summary: 'Acme makes invoicing simple.', full: true },
};

describe('head', () => {
  test('replaces title/description, keeps other tags, sets lang', () => {
    const out = renderPage({ site, page: { title: 'Pricing', description: 'Plans and prices.' }, path: '/pricing/', html }).html;
    expect(out).toContain('<html lang="en">');
    expect(out).toContain('<title>Pricing · Acme</title>');
    expect(out).not.toContain('Old title');
    expect(out).not.toContain('Old description');
    expect(out).toContain('<link rel="stylesheet" href="/a.css">');
    expect(out).toContain('{"@type":"Thing"}');
    expect(out).toContain('<link rel="canonical" href="https://acme.test/pricing/">');
    expect(out).toContain('property="og:image" content="https://acme.test/og.png"');
    expect(out).toContain('rel="alternate" type="text/markdown" href="https://acme.test/pricing.md"');
    expect(out.indexOf('<!--u1webcore-->')).toBeGreaterThan(out.indexOf('<meta charset'));
    expect(out.match(/<title>/g)?.length).toBe(1);
  });
  test('falls back to what the page renders', () => {
    const r = resolvePage({ site: {}, path: '/x', detected: { title: 'Old title', description: 'Old description' } });
    expect(r.title).toBe('Old title');
    expect(r.description).toBe('Old description');
  });
  test('inject is idempotent on lines', () => {
    const out = inject('<html><head>\n  <title>a</title>\n</head><body></body></html>', { head: [{ tag: 'title', attrs: {}, content: 'b' }] });
    expect(out).not.toMatch(/\n\s*\n\s*<\/head>/);
    expect(out).toContain('<title>b</title>');
  });
  test('site noindex', () => {
    const r = resolvePage({ site: { robots: { indexable: false } }, path: '/' });
    expect(r.robots.content).toStartWith('noindex');
  });
});

describe('schema', () => {
  test('graph links website/org/webpage and breadcrumbs', () => {
    const r = resolvePage({ site, page: { title: 'Pricing' }, path: '/pricing/' });
    const g = buildGraph({ site, page: { title: 'Pricing' }, resolved: r });
    const types = g['@graph'].map((n) => n['@type']);
    expect(types).toContain('WebSite');
    expect(types).toContain('WebPage');
    expect(types).toContain('BreadcrumbList');
  });
  test('product needs price', () => {
    const page = { schema: { type: 'Product', data: { name: 'Widget' } } };
    const r = resolvePage({ site, page, path: '/w/' });
    const g = buildGraph({ site, page, resolved: r });
    const checks = checkPage({ site, page, resolved: r, graph: g });
    expect(checks.some((c) => c.level === 'error' && c.group === 'schema')).toBe(true);
  });
});

describe('files', () => {
  const pages = [
    sitePage({ site, path: '/', html, markdown: true, lastmod: '2026-10-01T00:00:00Z' }),
    sitePage({ site, path: '/pricing/', page: { title: 'Pricing', llms: { notes: 'Plans' } }, html, markdown: true }),
    sitePage({ site, path: '/secret/', page: { robots: { index: false } }, html }),
    sitePage({ site, path: '/404', html }),
  ];
  test('robots default blocks training only', () => {
    const txt = robotsTxt(site, '');
    expect(txt).toContain('User-agent: GPTBot');
    expect(txt).toContain('Sitemap: https://acme.test/sitemap-index.xml');
    expect(txt).not.toContain('User-agent: OAI-SearchBot');
  });
  test('sitemap excludes noindex and 404, has lastmod', () => {
    const files = siteFiles({ site, pages, siteUrl: '' });
    const sm = files.find((f) => f.path === '/sitemap-0.xml')!.body;
    expect(sm).toContain('<loc>https://acme.test/</loc>');
    expect(sm).toContain('<lastmod>2026-10-01T00:00:00.000Z</lastmod>');
    expect(sm).not.toContain('secret');
    expect(sm).not.toContain('404');
    expect(sm).not.toContain('priority');
    expect(files.some((f) => f.path === '/pricing.md')).toBe(true);
  });
  test('llms.txt follows the spec', () => {
    const txt = llmsTxt(site, pages);
    expect(txt).toStartWith('# Acme\n\n> Acme makes invoicing simple.');
    expect(txt).toContain('- [Pricing](https://acme.test/pricing.md): Plans');
    expect(txt).not.toContain('secret');
  });
  test('markdown', () => {
    const md = toMarkdown(html, { base: 'https://acme.test' });
    expect(md).toContain('# Acme pricing');
    expect(md).toContain('**₹499**');
    expect(md).toContain('[the study](https://example.org/study)');
    expect(md).toContain('## How do refunds work?');
    expect(md).toContain('- Full refund in 30 days');
    expect(md).toContain('```js\nconst a = 1 < 2;\n```');
    expect(md).not.toContain('© Acme');
    expect(markdownPath('/')).toBe('/index.md');
    expect(pageKey('/blog/a/')).toBe('/blog/a');
    expect(pageKey('/')).toBe('/');
  });
  test('page settings sit next to the page file', () => {
    expect(sidecarFor('src/pages/contact.astro')).toBe('src/pages/contact.u1wc.json');
    const routes = [
      { pattern: '/projects/oasis', re: '^\\/projects\\/oasis\\/?$', file: 'src/pages/projects/oasis.u1wc.json', dynamic: false },
      { pattern: '/projects/[slug]', re: '^\\/projects\\/([^/]+?)\\/?$', file: 'src/pages/projects/[slug].u1wc.json', dynamic: true },
    ];
    const files = {
      'src/pages/projects/oasis.u1wc.json': { title: 'Oasis' },
      'src/pages/projects/[slug].u1wc.json': { '/projects/new-town': { title: 'New Town' } },
    };
    expect(pageSettings(files, routeFor(routes, '/projects/oasis/'), '/projects/oasis/')?.title).toBe('Oasis');
    expect(pageSettings(files, routeFor(routes, '/projects/new-town'), '/projects/new-town')?.title).toBe('New Town');
    expect(pageSettings(files, routeFor(routes, '/x', '/projects/[slug]'), '/projects/other')).toBeUndefined();
  });
  test('share cards', () => {
    expect(cardPath('/')).toBe('/og/index.png');
    expect(cardPath('/projects/oasis/')).toBe('/og/projects/oasis.png');
    const on = { identity: { url: 'https://acme.test' }, social: { card: { enabled: true } } };
    expect(resolvePage({ site: on, page: {}, path: '/a', siteUrl: 'https://acme.test' }).og.image?.url).toBe('https://acme.test/og/a.png');
    expect(resolvePage({ site: on, page: { og: { card: false } }, path: '/a', siteUrl: 'https://acme.test' }).og.image).toBeUndefined();
    expect(resolvePage({ site: on, page: {}, path: '/404', siteUrl: 'https://acme.test' }).og.image).toBeUndefined();
  });
  test('site audit', () => {
    expect(internalPath('/a#x', '/', [])).toBe('/a');
    expect(internalPath('b', '/docs/a', [])).toBe('/docs/b');
    expect(internalPath('https://acme.test/c?q=1', '/', ['https://acme.test'])).toBe('/c');
    expect(internalPath('https://other.test/c', '/', ['https://acme.test'])).toBeNull();
    expect(internalPath('/file.pdf', '/', [])).toBeNull();
    const site = { identity: { url: 'https://acme.test' } };
    const page = (path: string, title: string) => sitePage({ site, path, siteUrl: 'https://acme.test', html: `<html lang="en"><head><title>${title}</title></head><body><h1>${title}</h1><img src="http://cdn.test/x.png" alt="x"></body></html>` });
    const r = auditSite({ site, siteUrl: 'https://acme.test', pages: [page('/', 'Home'), page('/a', 'Same'), page('/b', 'Same')], links: [{ from: '/', to: '/a', status: 200 }, { from: '/', to: '/gone', status: 404 }, { from: '/a', to: '/old', status: 301, location: '/new' }] });
    const ids = r.issues.map((i) => i.id);
    expect(ids).toContain('link.broken:/gone');
    expect(ids).toContain('link.redirect:/old');
    expect(ids).toContain('mixed:http://cdn.test/x.png');
    expect(r.issues.find((i) => i.id === 'orphan')?.pages).toEqual(['/b']);
    expect(r.issues.find((i) => i.id.startsWith('title.duplicate'))?.pages.sort()).toEqual(['/a', '/b']);
    expect(r.issues[0].level).toBe('error');
  });
  test('redirects flatten chains and catch loops', () => {
    const { rules, issues } = checkRedirects([{ from: '/a', to: '/b' }, { from: '/b', to: '/c' }, { from: '/x', to: '/y' }, { from: '/y', to: '/x' }]);
    expect(rules.find((r) => r.from === '/a')?.to).toBe('/c');
    expect(issues.filter((i) => i.message.startsWith('Redirect loop')).length).toBe(2);
  });
});

describe('tags & consent', () => {
  test('gated tags are inert until consent', () => {
    const t = renderTags({ consent: { enabled: true }, tags: [{ id: '1', kind: 'meta', value: '123456789012' }, { id: '2', kind: 'gtm', value: 'GTM-ABC' }] });
    expect(t.headStart).toContain("gtag('consent','default'");
    expect(t.headStart.indexOf("'consent','default'")).toBeLessThan(t.headStart.indexOf('gtm.js'));
    expect(t.headStart).toContain('type="text/plain" data-u1-consent="marketing"');
    expect(t.headStart).not.toContain('data-u1-consent="analytics"'); // GTM loads under advanced consent mode
    expect(t.bodyEnd).toContain('u1consent');
  });
  test('hold leaves JSON scripts alone', () => {
    expect(hold('<script type="application/ld+json">{}</script>', 'analytics')).toContain('application/ld+json');
    expect(hold('<script src="x.js"></script>', 'analytics')).toBe('<script type="text/plain" data-u1-consent="analytics" src="x.js"></script>');
  });
});

describe('checks', () => {
  test('pixel widths', () => {
    expect(textWidth('iiii', 20)).toBeLessThan(textWidth('WWWW', 20));
    const t = truncateTo('A very long title that keeps going and going well past the point where Google cuts it off', 20, 600);
    expect(t.cut).toBe(true);
    expect(t.text.endsWith('…')).toBe(true);
  });
  test('aeo score rewards answers', () => {
    const r = resolvePage({ site, path: '/pricing/' });
    const low = aeoScore({ site, page: {}, resolved: r }).score;
    const high = aeoScore({ site, page: { aeo: { summary: Array(45).fill('word').join(' '), faq: [1, 2, 3].map((i) => ({ question: `Q${i}?`, answer: 'A' })), author: { name: 'A', url: 'https://a.test' }, dateModified: new Date().toISOString() } }, resolved: r }).score;
    expect(high).toBeGreaterThan(low);
  });
});
