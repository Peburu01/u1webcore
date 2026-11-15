// `u1webcore audit [dist]`: the whole-site audit on a built site. Reads every .html file, follows internal links
// against the built files and the site's redirects, prints the issues and exits 1 when there are errors (for CI).
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { analyze } from './checker/analyze';
import { auditSite, internalPath, type AuditLink } from './checker/audit';
import { sitePage, type SitePage } from './shared/pages';
import type { SiteSettings } from './shared/types';
import { SITE_FILE, pageKey } from './shared/util';

function htmlFiles(dir: string, base = dir): string[] {
  return readdirSync(dir).flatMap((name) => {
    const abs = path.join(dir, name);
    if (statSync(abs).isDirectory()) return htmlFiles(abs, base);
    return name.endsWith('.html') ? [path.relative(base, abs)] : [];
  });
}

/** dist file → page path: index.html → /, a/index.html → /a, a.html → /a */
const routeOf = (file: string) => pageKey(`/${file.split(path.sep).join('/').replace(/(^|\/)index\.html$/, '').replace(/\.html$/, '')}`);

function main(argv: string[]) {
  const [cmd, dir = 'dist'] = argv;
  if (cmd !== 'audit') {
    console.log('Usage: u1webcore audit [dist]');
    return cmd ? 1 : 0;
  }
  const out = path.resolve(dir);
  if (!existsSync(out)) {
    console.error(`No ${dir}/ folder. Build the site first.`);
    return 1;
  }
  let site: SiteSettings = {};
  try {
    site = JSON.parse(readFileSync(SITE_FILE, 'utf-8'));
  } catch {
    /* no site settings: audit what the pages render */
  }
  const siteUrl = site.identity?.url ?? '';
  const redirects = new Map((site.redirects ?? []).map((r) => [pageKey(r.from), r.to]));

  const pages: SitePage[] = [];
  const links: AuditLink[] = [];
  const known = new Set<string>();
  const files = htmlFiles(out);
  for (const f of files) known.add(routeOf(f));
  for (const f of files) {
    const route = routeOf(f);
    const html = readFileSync(path.join(out, f), 'utf-8');
    // Astro writes redirects as small HTML pages with a meta refresh; they are not content.
    if (/<meta[^>]+http-equiv=["']?refresh/i.test(html) && html.length < 2000) continue;
    pages.push(sitePage({ site, path: route, html, siteUrl }));
    for (const l of analyze(html).links) {
      const to = internalPath(l.href, route, [siteUrl]);
      if (to === null) continue;
      const key = pageKey(to);
      const location = redirects.get(key);
      links.push({ from: route, to, status: location ? 301 : known.has(key) || existsSync(path.join(out, to)) ? 200 : 404, location });
    }
  }

  const result = auditSite({ site, pages, links, siteUrl });
  const icon = { error: '✖', warning: '▲', info: '·' } as const;
  console.log(`u1webcore audit: ${result.pages} pages, ${result.links} internal links\n`);
  for (const i of result.issues) {
    console.log(`${icon[i.level]} ${i.message}`);
    if (i.notes) for (const p of i.pages.slice(0, 5)) console.log(`    ${p}: ${i.notes[p] ?? ''}`);
    else console.log(`    ${i.pages.slice(0, 5).join(', ')}`);
    if (i.pages.length > 5) console.log(`    +${i.pages.length - 5} more`);
  }
  const errors = result.issues.filter((i) => i.level === 'error').length;
  console.log(`\n${errors} errors, ${result.issues.filter((i) => i.level === 'warning').length} warnings, ${result.issues.filter((i) => i.level === 'info').length} notes`);
  return errors ? 1 : 0;
}

process.exitCode = main(process.argv.slice(2));
