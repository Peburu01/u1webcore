// Every site-level file for a set of built pages.
import type { SiteSettings } from '../shared/types';
import { markdownPath } from '../shared/util';
import { feed, feedType } from './feeds';
import { headersFile } from '../edge/headers';
import { llmsFullTxt, llmsTxt } from '../aeo/llms';
import { adsTxt, indexNowFile, securityTxt, webManifest } from './misc';
import { inLlms, type SitePage } from '../shared/pages';
import { robotsTxt } from './robots';
import { sitemaps, type OutFile } from './sitemap';

export type { OutFile };

export type SiteFilesInput = { site: SiteSettings; pages: SitePage[]; siteUrl: string; now?: Date };

const text = 'text/plain; charset=utf-8';

export function siteFiles({ site, pages, siteUrl, now }: SiteFilesInput): OutFile[] {
  const out: OutFile[] = [{ path: '/robots.txt', type: text, body: robotsTxt(site, siteUrl) }, ...sitemaps(site, pages, siteUrl)];
  if (site.llms?.enabled !== false) {
    out.push({ path: '/llms.txt', type: text, body: llmsTxt(site, pages) });
    if (site.llms?.full) out.push({ path: '/llms-full.txt', type: text, body: llmsFullTxt(site, pages) });
    if (site.llms?.markdownPages !== false) for (const p of pages) if (p.markdown && inLlms(p, site)) out.push({ path: markdownPath(p.path), type: 'text/markdown; charset=utf-8', body: p.markdown });
  }
  if (site.manifest?.enabled) out.push({ path: '/site.webmanifest', type: 'application/manifest+json', body: webManifest(site) });
  const sec = securityTxt(site, siteUrl, now);
  if (sec) out.push({ path: '/.well-known/security.txt', type: text, body: sec });
  const ads = adsTxt(site.ads?.adsTxt);
  if (ads) out.push({ path: '/ads.txt', type: text, body: ads });
  const appAds = adsTxt(site.ads?.appAdsTxt);
  if (appAds) out.push({ path: '/app-ads.txt', type: text, body: appAds });
  for (const f of site.feeds ?? []) out.push({ path: f.path, type: `${feedType(f)}; charset=utf-8`, body: feed(site, f, pages, siteUrl) });
  if (site.indexNow?.enabled && site.indexNow.key) out.push({ ...indexNowFile(site.indexNow.key), type: text });
  if (site.security?.headers?.enabled) out.push({ path: '/_headers', type: text, body: headersFile(site, pages) });
  return out;
}
