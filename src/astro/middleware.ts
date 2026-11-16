// Astro middleware: every HTML response gets the managed <head> (title, meta, OG, JSON-LD, tags, consent).
// Runs in `astro dev` and while prerendering static pages, so built HTML is final.
import data from 'virtual:u1webcore/data';
import type { U1webcoreData } from './integration';
import { renderPage } from '../shared/page';
import { SITE_FILE, clip, entryKey, pageSettings, routeFor, scriptJson } from '../shared/util';
import { lastmodFor } from './lastmod';

type Ctx = { url: URL; request: Request; routePattern?: string; isPrerendered?: boolean };

// Same process as the integration (dev, static build): live settings. Otherwise the bundled snapshot.
const current = (): U1webcoreData => ((globalThis as Record<symbol, { data?: () => U1webcoreData } | undefined>)[Symbol.for('u1webcore.live')]?.data?.() ?? (data as U1webcoreData));

export const onRequest = async (ctx: Ctx, next: () => Promise<Response>): Promise<Response> => {
  const d = current();
  const path = stripBase(ctx.url.pathname, d.config.base);
  const res = await next();
  if (!(res.headers.get('content-type') ?? '').includes('text/html')) return res;
  if (path.startsWith('/_') || path.startsWith('/@')) return res;

  const html = await res.text();
  const route = routeFor(d.routes, path, ctx.routePattern);
  const page = pageSettings(d.pages, route, path);
  let out: string;
  try {
    const r = renderPage({ site: d.site, page, path, html, siteUrl: d.config.siteUrl, lastmod: lastmodFor(d.config.lastmod, path), tags: d.config.tags, announce: !ctx.isPrerendered && ctx.request.headers.get('x-u1webcore') ? null : d.config.announce });
    out = r.html;
    if (d.config.editor && route && !ctx.request.headers.get('x-u1webcore')) {
      // Page facts for the CMS editor: it computes everything else from the settings it edits.
      // `file` is this page's settings file; `key` its entry in it when the route is dynamic.
      const payload = {
        path,
        file: route.file,
        key: entryKey(route, path) || undefined,
        siteFile: SITE_FILE,
        siteUrl: d.config.siteUrl,
        detected: r.detected,
        analysis: { ...r.analysis, text: clip(r.analysis.text, 20_000) },
      };
      const tag = `<script type="application/json" data-u1cms-ext="u1webcore">${scriptJson(payload)}</script>`;
      const at = out.lastIndexOf('</body>');
      out = at === -1 ? out + tag : out.slice(0, at) + tag + out.slice(at);
    }
  } catch (err) {
    console.error(`[u1webcore] ${path}:`, err);
    out = html;
  }
  const headers = new Headers(res.headers);
  headers.delete('content-length');
  return new Response(out, { status: res.status, statusText: res.statusText, headers });
};

function stripBase(pathname: string, base: string): string {
  const b = base.replace(/\/+$/, '');
  return b && pathname.startsWith(b) ? pathname.slice(b.length) || '/' : pathname;
}
