// Astro integration. One line in astro.config: integrations: [u1webcore()].
//   - middleware rewrites every HTML response's <head> (dev and static build)
//   - dev: serves robots.txt, sitemaps, llms.txt, .md pages, manifest, security.txt… from the live pages
//   - build: writes the same files into dist/, with lastmod from git history
//   - redirects from the site settings become Astro redirects
//   - share cards (/og/<page>.png) for pages without their own image, when the site turns them on
//   - dev: GET /_u1webcore/audit crawls the running site and returns the whole-site audit (for the dashboard)
// Settings are JSON in the site: src/site.u1wc.json (site-wide) and a <page>.u1wc.json next to each page file
// (src/pages/contact.astro → src/pages/contact.u1wc.json), exposed to the middleware as a virtual module.
import { toAnnouncement, type AnnounceConfig } from '../announce/types';
import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { siteFiles, type OutFile } from '../crawl/index';
import { sitePage, type SitePage } from '../shared/pages';
import { checkRedirects, toAstro } from '../edge/redirects';
import { fromAstroI18n, type Languages } from '../shared/i18n';
import type { SiteSettings } from '../shared/types';
import { SITE_FILE, cardPath, isRecord, markdownPath, pageKey, pageSettings, routeFor, sidecarFor, type PageRoute } from '../shared/util';
import { cardEnabled } from '../shared/resolve';
import { analyze } from '../checker/analyze';
import { auditSite, internalPath, type AuditLink } from '../checker/audit';
import { renderCard } from '../og/card';
import { lastmodFor } from './lastmod';

export type U1webcoreOptions = {
  /** Load third-party tags and the consent banner in `astro dev` too. */
  tagsInDev?: boolean;
  /** Embed page facts for the CMS editor in dev (default true). */
  editor?: boolean;
  /** Write robots.txt, sitemaps, llms.txt… at build (default true). */
  files?: boolean;
  /**
   * Announcements come from src/site.u1wc.json (`announcements`). false turns them off. The API origin and site key
   * (else PUBLIC_UNI1_API_URL / PUBLIC_UNI1_SITE_KEY) are optional: only to count views, clicks and closes.
   */
  announcements?: false | { api?: string; siteKey?: string };
};

export type U1webcoreData = {
  site: SiteSettings;
  /** Contents of each page settings file, by path from the project root. */
  pages: Record<string, Record<string, unknown>>;
  routes: PageRoute[];
  config: {
    siteUrl: string;
    base: string;
    dev: boolean;
    tags: boolean;
    editor: boolean;
    /** The announcements that are on, and where to count them; null = none. */
    announce: AnnounceConfig | null;
    lastmod: { re: string; at: string }[];
  };
};

const VIRTUAL = 'virtual:u1webcore/data';
/** Live settings for the middleware when it runs in this process (Astro caches the middleware module). */
export const LIVE = Symbol.for('u1webcore.live');
const RESOLVED = `\0${VIRTUAL}`;

type Route = { pattern: string; pathname?: string; patternRegex: RegExp; entrypoint: string; type: string; origin: string; isPrerendered: boolean };
type Logger = { info: (m: string) => void; warn: (m: string) => void };
type SetupParams = {
  command: 'dev' | 'build' | 'preview' | 'sync';
  config: { root: URL; site?: string; base?: string; publicDir: URL };
  updateConfig: (config: Record<string, unknown>) => unknown;
  addMiddleware: (m: { order: 'pre' | 'post'; entrypoint: string | URL }) => void;
  logger: Logger;
};
type ViteServer = {
  middlewares: { use: (fn: (req: { url?: string; method?: string; headers: Record<string, string | string[] | undefined> }, res: ServerRes, next: () => void) => void) => void };
  watcher: { add: (p: string) => void; on: (e: string, fn: (file: string) => void) => void };
  moduleGraph: ModuleGraph;
  environments?: Record<string, { moduleGraph: ModuleGraph }>;
  ws: { send: (p: { type: 'full-reload' }) => void };
  resolvedUrls?: { local: string[] } | null;
  httpServer?: { address: () => unknown } | null;
};
type ModuleGraph = { getModuleById: (id: string) => unknown; invalidateModule: (m: unknown) => void };
type ServerRes = { statusCode: number; setHeader: (k: string, v: string) => void; end: (b?: string | Uint8Array) => void };

function readJson(file: string): Record<string, unknown> {
  try {
    const v = JSON.parse(readFileSync(file, 'utf-8'));
    return isRecord(v) ? v : {};
  } catch {
    return {};
  }
}

/** Site settings and every page route's settings file (missing files are left out). */
export function readSettings(root: string, routes: PageRoute[]): { site: SiteSettings; pages: U1webcoreData['pages'] } {
  const pages: U1webcoreData['pages'] = {};
  for (const r of routes) if (existsSync(path.join(root, r.file))) pages[r.file] = readJson(path.join(root, r.file));
  return { site: readJson(path.join(root, SITE_FILE)) as SiteSettings, pages };
}

/** Latest commit date per file under the given folders, from one `git log`. */
function gitDates(root: string, folders: string[]): Promise<Map<string, string>> {
  return new Promise((resolve) => {
    execFile('git', ['log', '--format=@%cI', '--name-only', '--no-renames', '--', ...folders], { cwd: root, maxBuffer: 64 * 1024 * 1024 }, (err, stdout) => {
      const map = new Map<string, string>();
      if (err) return resolve(map);
      let date = '';
      for (const line of stdout.split('\n')) {
        if (line.startsWith('@')) date = line.slice(1);
        else if (line && !map.has(line)) map.set(line, date);
      }
      resolve(map);
    });
  });
}

/** Drops a module from every module graph, so the next import runs it again. */
function invalidate(server: ViteServer, id: string) {
  // Vite 6+: one module graph per environment (client, ssr…); older: a single graph.
  const graphs = server.environments ? Object.values(server.environments).map((e) => e.moduleGraph) : [server.moduleGraph];
  for (const g of graphs) {
    const mod = g?.getModuleById(id);
    if (mod) g.invalidateModule(mod);
  }
}

export default function u1webcore(options: U1webcoreOptions = {}) {
  let root = '';
  let siteUrl = '';
  let base = '/';
  let publicDir = '';
  let dev = false;
  let routes: Route[] = [];
  let lastmod: U1webcoreData['config']['lastmod'] = [];
  let logger: Logger;
  /** Locales from Astro's final `i18n` config (set by the site or an i18n integration such as wuchale). */
  let astroLanguages: Languages | undefined;
  let stats: { api: string; key: string } | null = null;

  /** The settings files, with the locales Astro routes by when the site settings name none. */
  const settingsOf = (files: PageRoute[]) => {
    const { site: own, pages } = readSettings(root, files);
    const site = own.languages?.locales?.length || !astroLanguages ? own : { ...own, languages: { ...astroLanguages, ...own.languages, locales: astroLanguages.locales } };
    return { site, pages };
  };

  let cached: U1webcoreData | null = null;
  const data = (): U1webcoreData => {
    if (cached && !dev) return cached;
    const files = fileRoutes();
    const { site, pages } = settingsOf(files);
    const on = options.announcements === false ? [] : (site.announcements ?? []).filter((a) => a.status === 'on').map(toAnnouncement);
    const announce = on.length ? { items: on, ...(dev && { frames: true }), ...(stats && { api: stats.api, key: stats.key }) } : null;
    return (cached = {
      site,
      pages,
      routes: files,
      config: { siteUrl, base, dev, tags: !dev || !!options.tagsInDev, editor: dev && options.editor !== false, lastmod, announce },
    });
  };

  const pageRoutes = () => routes.filter((r) => r.type === 'page' && r.origin === 'project');
  const fileRoutes = (): PageRoute[] =>
    pageRoutes().map((r) => ({ pattern: r.pattern, re: r.patternRegex.source, file: sidecarFor(r.entrypoint), dynamic: r.entrypoint.includes('[') }));
  /** Settings for one built or served page. */
  const settingsFor = (pages: U1webcoreData['pages'], p: string) => pageSettings(pages, routeFor(fileRoutes(), p), p);

  async function computeLastmod() {
    const dates = await gitDates(root, ['src']);
    if (!dates.size) return;
    lastmod = pageRoutes()
      .map((r) => {
        const files = [r.entrypoint, sidecarFor(r.entrypoint)];
        const at = files.map((f) => dates.get(f)).filter((d): d is string => !!d).sort().pop();
        return at ? { re: r.patternRegex.source, at } : null;
      })
      .filter((x): x is { re: string; at: string } => !!x);
  }

  const ownedByPublic = (p: string) => !!publicDir && existsSync(path.join(publicDir, p));

  return {
    name: 'u1webcore',
    hooks: {
      'astro:config:setup': async ({ command, config, updateConfig, addMiddleware, logger: l }: SetupParams) => {
        logger = l;
        dev = command === 'dev';
        root = fileURLToPath(config.root);
        siteUrl = config.site ?? '';
        base = config.base ?? '/';
        publicDir = fileURLToPath(config.publicDir);
        cached = null;
        (globalThis as Record<symbol, unknown>)[LIVE] = { data };
        const site = readSettings(root, []).site;
        stats = await announceFrom(options, command === 'dev' ? 'development' : 'production', root);
        if (site.redirects?.length) {
          const { rules, issues } = checkRedirects(site.redirects);
          for (const i of issues) l.warn(`redirect ${i.from}: ${i.message}`);
          updateConfig({ redirects: toAstro(rules) });
        }

        updateConfig({
          vite: {
            // The middleware imports the virtual module, so Vite must bundle it even from node_modules.
            ssr: { noExternal: ['u1webcore'] },
            plugins: [
              {
                name: 'u1webcore-data',
                resolveId: (id: string) => (id === VIRTUAL ? RESOLVED : null),
                load: async (id: string) => {
                  if (id !== RESOLVED) return null;
                  if (!dev && !lastmod.length) {
                    await computeLastmod();
                    cached = null;
                  }
                  return `export default ${JSON.stringify(data())};`;
                },
                configureServer(server: ViteServer) {
                  server.watcher.add(path.join(root, SITE_FILE));
                  const changed = (file: string) => {
                    if (!file.endsWith('.u1wc.json')) return;
                    invalidate(server, RESOLVED);
                    server.ws.send({ type: 'full-reload' });
                  };
                  for (const e of ['add', 'change', 'unlink']) server.watcher.on(e, changed);
                  server.middlewares.use((req, res, next) => {
                    if (req.method !== 'GET' || !req.url) return next();
                    const p = decodeURIComponent(req.url.split('?')[0]);
                    const origin = devOrigin(server, req.headers.host);
                    const send = (type: string, body: string | Uint8Array) => {
                      res.statusCode = 200;
                      res.setHeader('content-type', type);
                      res.setHeader('cache-control', 'no-store');
                      // The dashboard calls these from its own origin.
                      res.setHeader('access-control-allow-origin', '*');
                      res.end(body);
                    };
                    const fail = (err: unknown) => {
                      logger.warn(`${p}: ${err instanceof Error ? err.message : err}`);
                      next();
                    };
                    if (p === '/_u1webcore/audit') return void devAudit(origin).then((r) => send('application/json', JSON.stringify(r)), fail);
                    if (/^\/og\/.+\.png$/.test(p) && !ownedByPublic(p)) {
                      return void devCard(origin, p).then((png) => (png ? send('image/png', png) : next()), fail);
                    }
                    if (!isSiteFile(p, readSettings(root, []).site) || ownedByPublic(p)) return next();
                    devFile(p, origin)
                      .then((f) => {
                        if (!f) return next();
                        res.statusCode = 200;
                        res.setHeader('content-type', f.type);
                        res.setHeader('cache-control', 'no-store');
                        res.end(f.body);
                      })
                      .catch((err) => {
                        logger.warn(`${p}: ${err instanceof Error ? err.message : err}`);
                        next();
                      });
                  });
                },
              },
            ],
          },
        });

        addMiddleware({ order: 'pre', entrypoint: fileURLToPath(new URL('./middleware.mjs', import.meta.url)) });
      },

      'astro:config:done': ({ config }: { config: { i18n?: Parameters<typeof fromAstroI18n>[0] } }) => {
        astroLanguages = fromAstroI18n(config.i18n);
        cached = null;
      },
      'astro:routes:resolved': ({ routes: r }: { routes: Route[] }) => {
        routes = r;
        lastmod = [];
        cached = null;
      },
      'astro:build:start': async () => {
        await computeLastmod();
        cached = null;
      },

      'astro:build:done': async ({ dir: out, pages }: { dir: URL; pages: { pathname: string }[] }) => {
        if (options.files === false) return;
        const outDir = fileURLToPath(out);
        const { site, pages: settings } = settingsOf(fileRoutes());
        const built: SitePage[] = [];
        for (const { pathname } of pages) {
          const html = await readBuilt(outDir, pathname);
          if (html === null) continue;
          const route = `/${pathname}`.replace(/\/{2,}/g, '/');
          const page = settingsFor(settings, route);
          built.push(sitePage({ site, page, path: route, html, siteUrl, lastmod: lastmodFor(lastmod, route), markdown: true }));
        }
        const files = siteFiles({ site, pages: built, siteUrl });
        let written = 0;
        for (const f of files) {
          if (ownedByPublic(f.path)) {
            logger.warn(`${f.path} exists in public/; keeping it instead of generating one.`);
            continue;
          }
          const dest = path.join(outDir, f.path);
          await mkdir(path.dirname(dest), { recursive: true });
          await writeFile(dest, f.body);
          written++;
        }
        logger.info(`wrote ${written} files (robots, sitemaps, llms.txt, ${built.filter((p) => p.markdown).length} markdown pages…)`);

        let cards = 0;
        for (const p of built) {
          const file = cardPath(p.path);
          if (!cardEnabled(site, p.settings, p.path) || ownedByPublic(file)) continue;
          const dest = path.join(outDir, file);
          await mkdir(path.dirname(dest), { recursive: true });
          await writeFile(dest, await renderCard({ title: p.pageTitle || p.title, site, siteUrl, logo: await logoData(site) }));
          cards++;
        }
        if (cards) logger.info(`wrote ${cards} share cards`);
      },
    },
  };

  /** The site's logo from public/ as a data: URL, for share cards (PNG, JPG, WebP or SVG only). */
  async function logoData(site: SiteSettings): Promise<string | undefined> {
    const logo = site.organization?.logo;
    const type = logo && { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', svg: 'image/svg+xml' }[logo.split('.').pop()!.toLowerCase()];
    if (!logo || !type || /^[a-z]+:/i.test(logo) || !ownedByPublic(logo)) return undefined;
    return `data:${type};base64,${(await readFile(path.join(publicDir, logo))).toString('base64')}`;
  }

  /** Dev: a page's share card, drawn from its live title. */
  async function devCard(origin: string, file: string): Promise<Uint8Array | undefined> {
    const page = pageKey(file.slice('/og'.length, -'.png'.length).replace(/^\/index$/, '/'));
    const { site, pages: settings } = settingsOf(fileRoutes());
    const own = settingsFor(settings, page) ?? {};
    if (!cardEnabled(site, own, page)) return undefined;
    const res = await fetch(`${origin}${page}`, { headers: { 'x-u1webcore': 'files' } }).catch(() => null);
    if (!res?.ok) return undefined;
    const p = sitePage({ site, page: own, path: page, html: await res.text(), siteUrl });
    return renderCard({ title: p.pageTitle || p.title, site, siteUrl, logo: await logoData(site) });
  }

  /** Dev: crawls the running site from every static route, following internal links, then audits it. */
  async function devAudit(origin: string) {
    const { site, pages: settings } = settingsOf(fileRoutes());
    const queue = ['/', ...pageRoutes().flatMap((r) => (r.pathname ? [r.pathname] : []))];
    const seen = new Map<string, { status: number; location?: string }>();
    const pages: SitePage[] = [];
    const links: AuditLink[] = [];
    const LIMIT = 500;
    const visit = async (p: string) => {
      const res = await fetch(`${origin}${p}`, { redirect: 'manual', headers: { 'x-u1webcore': 'files' } }).catch(() => null);
      const status = res?.status ?? 0;
      seen.set(pageKey(p), { status, location: res?.headers.get('location') ?? undefined });
      if (!res?.ok || !(res.headers.get('content-type') ?? '').includes('text/html')) return;
      const html = await res.text();
      pages.push(sitePage({ site, page: settingsFor(settings, p), path: p, html, siteUrl }));
      for (const l of analyze(html).links) {
        const to = internalPath(l.href, p, [siteUrl, origin]);
        if (to === null) continue;
        links.push({ from: p, to, status: 0 });
        if (!seen.has(pageKey(to)) && !queue.some((q) => pageKey(q) === pageKey(to))) queue.push(to);
      }
    };
    for (let i = 0; i < queue.length && seen.size < LIMIT; ) {
      const batch = queue.slice(i, i + 6).filter((p) => !seen.has(pageKey(p)));
      i += 6;
      await Promise.all(batch.map(visit));
    }
    for (const l of links) Object.assign(l, seen.get(pageKey(l.to)) ?? { status: 200 });
    return auditSite({ site, pages, links, siteUrl });
  }

  /** Dev: build one site file from the live pages (fetched from this dev server). */
  async function devFile(p: string, origin: string): Promise<OutFile | undefined> {
    const { site, pages: settings } = settingsOf(fileRoutes());
    const needsPages = !/^\/(robots\.txt|site\.webmanifest|\.well-known\/security\.txt|app-ads\.txt|ads\.txt|[0-9a-f]{32}\.txt)$/.test(p);
    const md = p.endsWith('.md');
    let list = pageRoutes().filter((r) => r.pathname !== undefined && r.pathname !== null);
    if (md) list = list.filter((r) => markdownPath(r.pathname!) === p);
    const built: SitePage[] = [];
    if (needsPages) {
      await Promise.all(
        list.map(async (r) => {
          const res = await fetch(`${origin}${r.pathname}`, { headers: { 'x-u1webcore': 'files' } }).catch(() => null);
          if (!res?.ok || !(res.headers.get('content-type') ?? '').includes('text/html')) return;
          const page = settingsFor(settings, r.pathname!);
          built.push(sitePage({ site, page, path: r.pathname!, html: await res.text(), siteUrl, markdown: md || p === '/llms-full.txt' }));
        }),
      );
    }
    return siteFiles({ site, pages: built, siteUrl }).find((f) => f.path === p);
  }
}

function devOrigin(server: ViteServer, host: string | string[] | undefined): string {
  return server.resolvedUrls?.local[0]?.replace(/\/$/, '') ?? `http://${Array.isArray(host) ? host[0] : host ?? 'localhost:4321'}`;
}

function isSiteFile(p: string, site: SiteSettings): boolean {
  if (/^\/(robots\.txt|sitemap-index\.xml|sitemap-\d+\.xml|llms\.txt|llms-full\.txt|site\.webmanifest|ads\.txt|app-ads\.txt|_headers|\.well-known\/security\.txt)$/.test(p)) return true;
  if (p.endsWith('.md') && site.llms?.enabled !== false) return true;
  if ((site.feeds ?? []).some((f) => f.path === p)) return true;
  return !!site.indexNow?.key && p === `/${site.indexNow.key}.txt`;
}

async function readBuilt(outDir: string, pathname: string): Promise<string | null> {
  const clean = pathname.replace(/^\/+|\/+$/g, '');
  const candidates = clean ? (clean.endsWith('.html') ? [clean] : [`${clean}/index.html`, `${clean}.html`]) : ['index.html'];
  for (const c of candidates) {
    try {
      return await readFile(path.join(outDir, c), 'utf-8');
    } catch {
      /* next */
    }
  }
  return null;
}

/** The API origin and site key for announcements: the options, else the site's env (PUBLIC_UNI1_API_URL / _SITE_KEY). */
async function announceFrom(options: U1webcoreOptions, mode: string, root: string): Promise<{ api: string; key: string } | null> {
  if (options.announcements === false) return null;
  let env: Record<string, string> = { ...(process.env as Record<string, string>) };
  try {
    // Resolved from the site at run time (Astro brings Vite), not bundled.
    const vite = 'vite';
    const { loadEnv } = (await import(/* @vite-ignore */ vite)) as { loadEnv: (mode: string, dir: string, prefix: string) => Record<string, string> };
    env = { ...loadEnv(mode, root, 'PUBLIC_'), ...env };
  } catch {
    // No Vite next to the integration: process.env only.
  }
  const api = (options.announcements?.api ?? env.PUBLIC_UNI1_API_URL ?? '').replace(/\/+$/, '');
  const key = options.announcements?.siteKey ?? env.PUBLIC_UNI1_SITE_KEY ?? '';
  return api && key ? { api, key } : null;
}
