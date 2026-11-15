// Third-party tags: one registry of presets, placed in head/body and held back until the visitor consents.
// A held-back script is written as type="text/plain" data-u1-consent="<category>"; the consent runtime
// swaps it for a real script once that category is granted.
import type { ConsentCategory, PageSettings, SiteSettings, TagKind, TagSettings } from '../shared/types';
import { escapeHtml } from '../shared/util';
import { consentBody, consentHead } from './consent';
import { dataLayerHead, triggersBody } from './triggers';

export type TagPreset = {
  kind: TagKind;
  label: string;
  /** What the value field holds. */
  valueLabel: string;
  placeholder: string;
  pattern?: RegExp;
  consent: ConsentCategory;
  google?: boolean;
  help?: string;
};

export const TAG_PRESETS: TagPreset[] = [
  { kind: 'gtm', label: 'Google Tag Manager', valueLabel: 'Container ID', placeholder: 'GTM-XXXXXXX', pattern: /^GTM-[A-Z0-9]+$/, consent: 'analytics', google: true },
  { kind: 'ga4', label: 'Google Analytics 4', valueLabel: 'Measurement ID', placeholder: 'G-XXXXXXXXXX', pattern: /^G-[A-Z0-9]+$/, consent: 'analytics', google: true, help: 'Skip if GA4 already runs through Tag Manager.' },
  { kind: 'meta', label: 'Meta Pixel', valueLabel: 'Pixel ID', placeholder: '123456789012345', pattern: /^\d{10,20}$/, consent: 'marketing' },
  { kind: 'linkedin', label: 'LinkedIn Insight Tag', valueLabel: 'Partner ID', placeholder: '1234567', pattern: /^\d+$/, consent: 'marketing' },
  { kind: 'tiktok', label: 'TikTok Pixel', valueLabel: 'Pixel ID', placeholder: 'CXXXXXXXXXXXXXXXXXXX', consent: 'marketing' },
  { kind: 'clarity', label: 'Microsoft Clarity', valueLabel: 'Project ID', placeholder: 'abcd1234ef', consent: 'analytics' },
  { kind: 'hotjar', label: 'Hotjar', valueLabel: 'Site ID', placeholder: '1234567', pattern: /^\d+$/, consent: 'analytics' },
  { kind: 'plausible', label: 'Plausible', valueLabel: 'Domain', placeholder: 'example.com', consent: 'necessary', help: 'Cookieless; usually needs no consent. Paste your pa-….js script URL in Source if your account uses one.' },
  { kind: 'fathom', label: 'Fathom', valueLabel: 'Site ID', placeholder: 'ABCDEFGH', consent: 'necessary', help: 'Cookieless; usually needs no consent.' },
  { kind: 'umami', label: 'Umami', valueLabel: 'Website ID', placeholder: 'uuid', consent: 'necessary', help: 'Cookieless; usually needs no consent.' },
  { kind: 'custom', label: 'Custom HTML', valueLabel: 'Name', placeholder: 'Chat widget', consent: 'marketing' },
];

export const tagPreset = (kind: TagKind) => TAG_PRESETS.find((p) => p.kind === kind)!;

type Placed = { head: string; bodyStart: string; bodyEnd: string };

const js = (s: string) => JSON.stringify(s).replace(/</g, '\\u003c');

function snippet(t: TagSettings): Partial<Placed> {
  const v = (t.value ?? '').trim();
  switch (t.kind) {
    case 'gtm': {
      // Server-side: the same container served from the site's own domain, so the loader is first-party.
      const host = t.serverUrl?.trim().replace(/\/+$/, '') || 'https://www.googletagmanager.com';
      return {
        head: `<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=${js(`${host}/gtm.js?id=`)}+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer',${js(v)});</script>`,
        bodyStart: `<noscript><iframe src="${escapeHtml(host)}/ns.html?id=${encodeURIComponent(v)}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>`,
      };
    }
    case 'ga4':
      return {
        head: `<script async src="https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(v)}"></script>\n<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config',${js(v)});</script>`,
      };
    case 'meta':
      return {
        head: `<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init',${js(v)});fbq('track','PageView');</script>`,
      };
    case 'linkedin':
      return {
        bodyEnd: `<script>window._linkedin_partner_id=${js(v)};window._linkedin_data_partner_ids=window._linkedin_data_partner_ids||[];window._linkedin_data_partner_ids.push(window._linkedin_partner_id);(function(l){if(!l){window.lintrk=function(a,b){window.lintrk.q.push([a,b])};window.lintrk.q=[]}var s=document.getElementsByTagName("script")[0];var b=document.createElement("script");b.type="text/javascript";b.async=true;b.src="https://snap.licdn.com/li.lms-analytics/insight.min.js";s.parentNode.insertBefore(b,s);})(window.lintrk);</script>`,
      };
    case 'tiktok':
      return {
        head: `<script>!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=r;ttq._t=ttq._t||{};ttq._t[e]=+new Date;ttq._o=ttq._o||{};ttq._o[e]=n||{};var o=d.createElement("script");o.type="text/javascript";o.async=!0;o.src=r+"?sdkid="+e+"&lib="+t;var a=d.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load(${js(v)});ttq.page();}(window,document,'ttq');</script>`,
      };
    case 'clarity':
      return {
        head: `<script>(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script",${js(v)});</script>`,
      };
    case 'hotjar':
      return {
        head: `<script>(function(h,o,t,j,a,r){h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};h._hjSettings={hjid:${Number(v) || 0},hjsv:6};a=o.getElementsByTagName('head')[0];r=o.createElement('script');r.async=1;r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;a.appendChild(r);})(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');</script>`,
      };
    case 'plausible':
      return t.src
        ? { head: `<script async src="${escapeHtml(t.src)}"></script>\n<script>window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};plausible.init();</script>` }
        : { head: `<script defer data-domain="${escapeHtml(v)}" src="https://plausible.io/js/script.js"></script>` };
    case 'fathom':
      return { head: `<script src="${escapeHtml(t.src || 'https://cdn.usefathom.com/script.js')}" data-site="${escapeHtml(v)}" defer></script>` };
    case 'umami':
      return t.src ? { head: `<script defer src="${escapeHtml(t.src)}" data-website-id="${escapeHtml(v)}"></script>` } : {};
    case 'custom':
      return { [t.placement === 'head' ? 'head' : t.placement === 'body-start' ? 'bodyStart' : 'bodyEnd']: t.html ?? '' };
  }
}

/** Turns runnable scripts into inert ones the consent runtime activates later. */
export function hold(html: string, category: ConsentCategory): string {
  return html.replace(/<script\b([^>]*)>/gi, (all, attrs: string) => {
    const type = /\stype\s*=\s*["']?([^"'\s>]+)/i.exec(attrs)?.[1]?.toLowerCase();
    if (type && type !== 'text/javascript' && type !== 'module' && type !== 'application/javascript') return all;
    const rest = attrs.replace(/\stype\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/i, '');
    return `<script type="text/plain" data-u1-consent="${category}"${type === 'module' ? ' data-u1-type="module"' : ''}${rest}>`;
  });
}

export type RenderedTags = { headStart: string; headEnd: string; bodyStart: string; bodyEnd: string };

/** Prefix match on the page path. `exclude` wins; no rules = every page. */
export function tagApplies(paths: TagSettings['paths'], path: string | undefined): boolean {
  if (!paths || path === undefined) return true;
  const clean = (p: string) => p.replace(/\/+$/, '') || '/';
  const hit = (list?: string[]) => (list ?? []).some((p) => clean(p) === '/' || path === clean(p) || path.startsWith(`${clean(p)}/`));
  if (hit(paths.exclude)) return false;
  return !paths.include?.length || hit(paths.include);
}

export function renderTags(site: SiteSettings, ctx: { path?: string; page?: PageSettings } = {}): RenderedTags {
  const consent = site.consent ?? {};
  const consentOn = consent.enabled === true;
  const googleAdvanced = consentOn && consent.googleConsentMode !== false && (consent.googleMode ?? 'advanced') === 'advanced';
  const out: Placed = { head: '', bodyStart: '', bodyEnd: '' };
  for (const t of site.tags ?? []) {
    if (t.enabled === false || (!t.value?.trim() && t.kind !== 'custom' && !t.src)) continue;
    if (!tagApplies(t.paths, ctx.path)) continue;
    const preset = tagPreset(t.kind);
    const category = t.consent ?? preset.consent;
    const placed = snippet(t);
    const gated = consentOn && category !== 'necessary' && !(preset.google && googleAdvanced);
    for (const k of ['head', 'bodyStart', 'bodyEnd'] as const) {
      const html = placed[k];
      if (!html) continue;
      const label = `<!-- ${escapeHtml(t.label ?? preset.label).replace(/--/g, '—')} -->`;
      out[k] += `${label}\n${gated ? hold(html, category) : html}\n`;
    }
  }
  return {
    // Consent defaults first, then tags as high in <head> as possible (GTM's recommendation).
    // Consent defaults, then page variables, then tags as high in <head> as possible (GTM's recommendation).
    headStart: (consentOn ? consentHead(site) : '') + dataLayerHead(ctx.page) + out.head,
    headEnd: '',
    bodyStart: out.bodyStart,
    bodyEnd: out.bodyEnd + triggersBody(site) + (consentOn ? consentBody(site) : ''),
  };
}
