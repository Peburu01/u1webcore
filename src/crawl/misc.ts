// Small site files: web manifest, security.txt, ads.txt, IndexNow.
import type { SiteSettings } from '../shared/types';
import { absolute, isoDate, origin } from '../shared/util';

export function webManifest(site: SiteSettings): string {
  const id = site.identity ?? {};
  const m = site.manifest ?? {};
  const icons = site.icons ?? {};
  const list = [
    icons.icon192 && { src: icons.icon192, sizes: '192x192', type: mime(icons.icon192) },
    icons.icon512 && { src: icons.icon512, sizes: '512x512', type: mime(icons.icon512) },
    icons.maskable && { src: icons.maskable, sizes: '512x512', type: mime(icons.maskable), purpose: 'maskable' },
    !icons.icon192 && !icons.icon512 && icons.svg && { src: icons.svg, sizes: 'any', type: 'image/svg+xml' },
  ].filter(Boolean);
  const out = {
    name: id.name || site.organization?.name,
    short_name: m.shortName || id.alternateName?.[0] || id.name,
    description: id.description,
    lang: id.language,
    start_url: m.startUrl ?? '/',
    scope: '/',
    display: m.display ?? 'standalone',
    background_color: m.backgroundColor ?? '#ffffff',
    theme_color: id.themeColor,
    icons: list,
  };
  return `${JSON.stringify(out, (_k, v) => (v === undefined || v === '' ? undefined : v), 2)}\n`;
}

const mime = (src: string) => (/\.svg/i.test(src) ? 'image/svg+xml' : /\.webp/i.test(src) ? 'image/webp' : /\.jpe?g/i.test(src) ? 'image/jpeg' : 'image/png');

/** RFC 9116. Contact and Expires are required; Expires defaults to one year from `now` (keep it under a year). */
export function securityTxt(site: SiteSettings, siteUrl: string, now = new Date()): string | null {
  const t = site.security?.txt;
  const contacts = (t?.contact ?? []).map((c) => (c.includes(':') ? c : c.includes('@') ? `mailto:${c}` : c)).filter(Boolean);
  if (!contacts.length) return null;
  const base = origin(site.identity?.url || siteUrl);
  const expires = isoDate(t?.expires) ?? new Date(now.getTime() + 365 * 864e5).toISOString().replace(/\.\d{3}Z$/, '.000Z');
  const lines = [
    ...contacts.map((c) => `Contact: ${c}`),
    `Expires: ${expires}`,
    t?.encryption && `Encryption: ${t.encryption}`,
    t?.acknowledgments && `Acknowledgments: ${t.acknowledgments}`,
    t?.policy && `Policy: ${t.policy}`,
    t?.hiring && `Hiring: ${t.hiring}`,
    t?.preferredLanguages && `Preferred-Languages: ${t.preferredLanguages}`,
    base && `Canonical: ${base}/.well-known/security.txt`,
  ].filter(Boolean);
  return `${lines.join('\n')}\n`;
}

/** ads.txt / app-ads.txt: "domain, publisher id, DIRECT|RESELLER[, cert id]" one per line. */
export const adsTxt = (lines: string[] | undefined) => (lines?.length ? `${lines.map((l) => l.trim()).filter(Boolean).join('\n')}\n` : null);

// IndexNow (Bing, Yandex, Naver, Seznam; not Google). The key file lives at /<key>.txt.
export function indexNowKey(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const indexNowFile = (key: string) => ({ path: `/${key}.txt`, body: key });

/** Request for https://api.indexnow.org/indexnow. Up to 10,000 URLs per call, same host only. */
export function indexNowRequest(site: SiteSettings, siteUrl: string, urls: string[]) {
  const key = site.indexNow?.key;
  const base = origin(site.identity?.url || siteUrl);
  if (!site.indexNow?.enabled || !key || !base) return null;
  const host = new URL(base).host;
  const list = urls.map((u) => absolute(u, base)!).filter((u) => u && new URL(u).host === host).slice(0, 10_000);
  if (!list.length) return null;
  return {
    url: 'https://api.indexnow.org/indexnow',
    init: { method: 'POST', headers: { 'content-type': 'application/json; charset=utf-8' }, body: JSON.stringify({ host, key, keyLocation: `${base}/${key}.txt`, urlList: list }) },
  };
}
