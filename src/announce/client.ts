// The announcements runtime that runs in the visitor's browser. `announceClient` must stay self-contained (no
// imports, no outside names): the page embeds it with Function#toString, and the dashboard's preview runs the
// very same code. Plain ES2017, no dependencies. Everything renders in a shadow root, so site CSS can't break it
// and it can't break the site; the site can still theme it with CSS variables (they pass into the shadow root):
//   --u1a-accent (buttons, brand tone), --u1a-bg / --u1a-fg (override the tone), --u1a-radius, --u1a-font.
// The strip goes at the top of <body>, or inside [data-u1-announcements] when the site has one, and sets
// --u1a-bar-height on <html> so a fixed header can sit under it: top: var(--u1a-bar-height, 0).
// Events go to window.dataLayer (u1_announcement_view / _click / _close) and to the dashboard's counters.
import type { AnnounceConfig, Announcement } from './types';

// oxlint-disable-next-line no-explicit-any
type Any = any;

export function announceClient(cfg: AnnounceConfig): void {
  const w = window as Any;
  const d = document;
  if (w.__u1a && !cfg.preview) return;
  w.__u1a = 1;
  // Not inside someone's frame (the CMS editor's preview), unless this is the dashboard's preview.
  if (!cfg.preview && w.self !== w.top) return;

  const NS = 'u1a:';
  const now = Date.now();
  const get = (k: string): Any => {
    try {
      return JSON.parse(localStorage.getItem(NS + k) || 'null');
    } catch (e) {
      return null;
    }
  };
  const put = (k: string, v: unknown) => {
    try {
      localStorage.setItem(NS + k, JSON.stringify(v));
    } catch (e) {
      /* private mode */
    }
  };
  const sessGet = (k: string) => {
    try {
      return sessionStorage.getItem(NS + k);
    } catch (e) {
      return null;
    }
  };
  const sessSet = (k: string) => {
    try {
      sessionStorage.setItem(NS + k, '1');
    } catch (e) {
      /* private mode */
    }
  };

  const lang = (cfg.lang || d.documentElement.lang || '').toLowerCase().split('-')[0];
  const esc = (s: string) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
  const safeUrl = (u: string) => (/^(https?:|mailto:|tel:|\/|#|\.)/i.test(u || '') ? u : '#');
  const rich = (s: string) =>
    esc(s)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m: string, t: string, u: string) => `<a href="${esc(safeUrl(u))}">${t}</a>`)
      .replace(/\n/g, '<br>');
  const text = (a: Announcement, k: 'title' | 'body' | 'ctaLabel') => {
    const t = (a.translations || {})[lang] || {};
    if (t[k]) return t[k] as string;
    return k === 'ctaLabel' ? (a.cta ? a.cta.label : '') : a[k] || '';
  };

  // ── Which ones, and when ──
  const glob = (p: string) => new RegExp(`^${p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}/?$`);
  const path = location.pathname;
  const bare = lang && path.indexOf(`/${lang}/`) === 0 ? path.slice(lang.length + 1) : path === `/${lang}` ? '/' : path;
  const onPage = (a: Announcement) => {
    const p = a.pages || { mode: 'all', paths: [] };
    if (p.mode === 'all') return true;
    const hit = (p.paths || []).some((x) => {
      const r = glob(x.trim());
      return r.test(path) || r.test(bare);
    });
    return p.mode === 'only' ? hit : !hit;
  };
  const live = (a: Announcement) => (!a.startsAt || Date.parse(a.startsAt) <= now) && (!a.endsAt || Date.parse(a.endsAt) > now);
  const rec = (a: Announcement) => {
    const r = get(a.id);
    return r && r.v === a.version ? r : { v: a.version };
  };
  const due = (a: Announcement) => {
    const r = rec(a);
    const f = a.frequency || { mode: 'until-closed' };
    if (f.mode === 'always') return true;
    if (f.mode === 'session') return !sessGet(a.id);
    if (f.mode === 'once') return !r.seen;
    if (f.mode === 'days') return !r.seen || now - r.seen > (f.days || 1) * 864e5;
    return !r.closed;
  };
  const mark = (a: Announcement, field: 'seen' | 'closed') => {
    if (cfg.preview) return;
    const r = rec(a);
    r[field] = Date.now();
    put(a.id, r);
    if (field === 'seen') sessSet(a.id);
  };

  const track = (a: Announcement, type: 'view' | 'click' | 'close') => {
    if (cfg.preview) return;
    (w.dataLayer = w.dataLayer || []).push({ event: `u1_announcement_${type}`, announcement_id: a.id, announcement_name: a.name, announcement_kind: a.kind });
    if (cfg.api && cfg.key)
      fetch(`${cfg.api}/public/v1/announcements/${a.id}/events`, { method: 'POST', keepalive: true, headers: { 'content-type': 'application/json', 'x-site-key': cfg.key }, body: JSON.stringify({ type }) }).catch(() => {});
  };

  // ── Look ──
  const TONES: Record<string, [string, string]> = {
    brand: ['var(--u1a-accent, #4f46e5)', '#fff'],
    dark: ['#111827', '#f9fafb'],
    light: ['#ffffff', '#111827'],
  };
  const colors = (a: Announcement) => {
    const ap = a.appearance || ({} as Announcement['appearance']);
    const t = ap.tone === 'custom' ? [ap.background || '#111827', ap.color || '#ffffff'] : TONES[ap.tone] || TONES.brand!;
    const accent = ap.accent || (ap.tone === 'brand' ? t[1] : 'var(--u1a-accent, #4f46e5)');
    const accentFg = ap.accent || ap.tone !== 'brand' ? '#fff' : t[0];
    return `--bg:var(--u1a-bg, ${t[0]});--fg:var(--u1a-fg, ${t[1]});--ac:${accent};--acfg:${accentFg};`;
  };
  const CSS = `:host{all:initial;font-family:var(--u1a-font,inherit)}*{box-sizing:border-box}
.w{font-family:inherit;color:var(--fg);-webkit-font-smoothing:antialiased;line-height:1.45}
a{color:inherit;text-decoration:underline;text-underline-offset:2px}
.x{appearance:none;border:0;background:transparent;color:inherit;opacity:.75;cursor:pointer;width:32px;height:32px;border-radius:8px;display:grid;place-items:center;flex:none;padding:0}
.x:hover{opacity:1;background:color-mix(in srgb,currentColor 12%,transparent)}.x:focus-visible,.b:focus-visible{outline:2px solid currentColor;outline-offset:2px}
.x svg{width:16px;height:16px}
.b{display:inline-flex;align-items:center;justify-content:center;gap:6px;border:0;cursor:pointer;font:inherit;font-weight:600;text-decoration:none;background:var(--ac);color:var(--acfg);border-radius:calc(var(--u1a-radius,12px) - 4px);padding:10px 16px;font-size:14px;white-space:nowrap}
.b:hover{filter:brightness(1.08)}
.bar{background:var(--bg);overflow:hidden;max-height:0;transition:max-height .35s ease}
.bar.in{max-height:240px}
.bar .r{display:flex;align-items:center;justify-content:center;gap:12px;padding:9px 12px 9px 16px;font-size:14px;min-height:44px;max-width:1200px;margin:0 auto}
.bar .t{flex:1;text-align:center}.bar .t strong:first-child{margin-right:6px}
.bar .b{padding:6px 12px;font-size:13px}
.ov{position:fixed;inset:0;z-index:2147483000;background:rgba(10,10,15,.55);display:flex;align-items:center;justify-content:center;padding:16px;opacity:0;transition:opacity .2s ease}
.ov.bottom{align-items:flex-end}
.ov.in{opacity:1}
.card{background:var(--bg);border-radius:var(--u1a-radius,16px);box-shadow:0 24px 64px rgba(0,0,0,.28);width:100%;max-width:440px;max-height:calc(100vh - 32px);overflow:auto;position:relative;transform:translateY(12px) scale(.98);transition:transform .25s ease}
.in .card,.toast.in{transform:none}
.card .img{display:block;width:100%;max-height:220px;object-fit:cover;border-radius:var(--u1a-radius,16px) var(--u1a-radius,16px) 0 0}
.card .p{padding:22px 22px 20px}.card h2{margin:0 0 6px;font-size:20px;line-height:1.25;font-weight:700}
.card .t{margin:0;font-size:15px;opacity:.85}.card .a{margin-top:18px;display:flex;gap:8px}.card .a .b{flex:1}
.card>.x{position:absolute;top:8px;right:8px;background:color-mix(in srgb,var(--bg) 70%,transparent)}
.toast{position:fixed;z-index:2147482990;bottom:16px;right:16px;width:min(360px,calc(100vw - 32px));background:var(--bg);border-radius:var(--u1a-radius,14px);box-shadow:0 12px 40px rgba(0,0,0,.22);display:flex;gap:12px;padding:14px 10px 14px 16px;opacity:0;transform:translateY(16px);transition:opacity .25s ease,transform .25s ease}
.toast.left{right:auto;left:16px}.toast.in{opacity:1}
.toast h2{margin:0 0 2px;font-size:15px;font-weight:700}.toast .t{margin:0;font-size:14px;opacity:.85}.toast .b{margin-top:10px;padding:7px 12px;font-size:13px}
.toast .img{width:56px;height:56px;border-radius:10px;object-fit:cover;flex:none}
@media (max-width:520px){.ov{align-items:flex-end;padding:0}.card{max-width:none;border-radius:var(--u1a-radius,16px) var(--u1a-radius,16px) 0 0}}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}`;
  const X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  const shell = (a: Announcement) => {
    const host = d.createElement('div');
    host.setAttribute('data-u1-announcement', a.kind);
    const root: Any = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
    root.innerHTML = `<style>${CSS}</style><div class="w" style="${colors(a)}"></div>`;
    return { host, box: root.querySelector('.w') as HTMLElement };
  };
  const cta = (a: Announcement) => (a.cta && a.cta.url ? `<a class="b" data-cta href="${esc(safeUrl(a.cta.url))}"${a.cta.newTab ? ' target="_blank" rel="noopener"' : ''}>${esc(text(a, 'ctaLabel'))}</a>` : '');
  const wire = (a: Announcement, el: HTMLElement, close: () => void) => {
    const c = el.querySelector('[data-cta]');
    if (c)
      c.addEventListener('click', () => {
        track(a, 'click');
        if (a.kind !== 'bar') {
          mark(a, 'closed');
          close();
        }
      });
    el.querySelectorAll('[data-x]').forEach((x) =>
      x.addEventListener('click', () => {
        track(a, 'close');
        mark(a, 'closed');
        close();
      })
    );
  };
  const shown = (a: Announcement) => {
    mark(a, 'seen');
    track(a, 'view');
  };

  // ── Strip ──
  function bar(a: Announcement) {
    const { host, box } = shell(a);
    const ap = a.appearance || ({} as Announcement['appearance']);
    const title = text(a, 'title');
    box.innerHTML = `<div class="bar" role="region" aria-label="${esc(title || 'Announcement')}"><div class="r"><div class="t">${title ? `<strong>${esc(title)}</strong>` : ''}${rich(text(a, 'body'))}</div>${cta(a)}${ap.dismissible !== false ? `<button class="x" data-x aria-label="Close">${X}</button>` : ''}</div></div>`;
    const slot = d.querySelector('[data-u1-announcements]');
    if (slot) slot.appendChild(host);
    else d.body.insertBefore(host, d.body.firstChild);
    const el = box.firstChild as HTMLElement;
    const html = d.documentElement;
    const size = () => html.style.setProperty('--u1a-bar-height', `${el.offsetHeight}px`);
    const ro = w.ResizeObserver ? new w.ResizeObserver(size) : null;
    if (ro) ro.observe(el);
    requestAnimationFrame(() => {
      el.classList.add('in');
      size();
    });
    wire(a, el, () => {
      el.classList.remove('in');
      html.style.setProperty('--u1a-bar-height', '0px');
      if (ro) ro.disconnect();
      setTimeout(() => host.remove(), 400);
    });
    shown(a);
  }

  // ── Popup ──
  let open = false;
  function popup(a: Announcement) {
    if (open) return;
    open = true;
    const { host, box } = shell(a);
    const pos = (a.appearance || ({} as Announcement['appearance'])).position === 'bottom' ? ' bottom' : '';
    const title = text(a, 'title');
    box.innerHTML = `<div class="ov${pos}"><div class="card" role="dialog" aria-modal="true" aria-label="${esc(title || 'Announcement')}" tabindex="-1">${a.image ? `<img class="img" src="${esc(safeUrl(a.image))}" alt="">` : ''}<button class="x" data-x aria-label="Close">${X}</button><div class="p">${title ? `<h2>${esc(title)}</h2>` : ''}<p class="t">${rich(text(a, 'body'))}</p>${a.cta && a.cta.url ? `<div class="a">${cta(a)}</div>` : ''}</div></div></div>`;
    d.body.appendChild(host);
    const ov = box.firstChild as HTMLElement;
    const card = ov.firstChild as HTMLElement;
    const before = d.activeElement as HTMLElement | null;
    const overflow = d.documentElement.style.overflow;
    d.documentElement.style.overflow = 'hidden';
    const focusable = () => Array.prototype.slice.call(card.querySelectorAll('a[href],button')) as HTMLElement[];
    const close = () => {
      ov.classList.remove('in');
      d.removeEventListener('keydown', key, true);
      d.documentElement.style.overflow = overflow;
      setTimeout(() => host.remove(), 250);
      if (before && before.focus) before.focus();
      open = false;
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        track(a, 'close');
        mark(a, 'closed');
        close();
      } else if (e.key === 'Tab') {
        const f = focusable();
        if (!f.length) return;
        const active = (host.shadowRoot || d).activeElement;
        const first = f[0]!;
        const last = f[f.length - 1]!;
        if (e.shiftKey && (active === first || active === card)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    d.addEventListener('keydown', key, true);
    ov.addEventListener('click', (e) => {
      if (e.target === ov) {
        track(a, 'close');
        mark(a, 'closed');
        close();
      }
    });
    wire(a, card, close);
    requestAnimationFrame(() => {
      ov.classList.add('in');
      const f = focusable();
      (f.length > 1 ? f[1]! : card).focus({ preventScroll: true } as FocusOptions);
    });
    shown(a);
  }

  // ── Toast ──
  function toast(a: Announcement) {
    const { host, box } = shell(a);
    const ap = a.appearance || ({} as Announcement['appearance']);
    const title = text(a, 'title');
    box.innerHTML = `<div class="toast${ap.position === 'bottom-left' ? ' left' : ''}" role="status">${a.image ? `<img class="img" src="${esc(safeUrl(a.image))}" alt="">` : ''}<div style="flex:1;min-width:0">${title ? `<h2>${esc(title)}</h2>` : ''}<p class="t">${rich(text(a, 'body'))}</p>${cta(a)}</div>${ap.dismissible !== false ? `<button class="x" data-x aria-label="Close">${X}</button>` : ''}</div>`;
    d.body.appendChild(host);
    const el = box.firstChild as HTMLElement;
    requestAnimationFrame(() => el.classList.add('in'));
    wire(a, el, () => {
      el.classList.remove('in');
      setTimeout(() => host.remove(), 300);
    });
    shown(a);
  }

  // ── Triggers ──
  const SHOW = { bar, popup, toast } as Record<string, (a: Announcement) => void>;
  function arm(a: Announcement) {
    const show = () => SHOW[a.kind] && SHOW[a.kind]!(a);
    const t = a.trigger || { on: 'load' };
    if (cfg.preview || t.on === 'load' || a.kind === 'bar') return show();
    if (t.on === 'delay') return void setTimeout(show, Math.max(0, t.seconds || 0) * 1000);
    if (t.on === 'scroll') {
      const at = Math.min(100, Math.max(0, t.percent == null ? 50 : t.percent)) / 100;
      const check = () => {
        const max = d.documentElement.scrollHeight - innerHeight;
        if (max <= 0 || scrollY / max >= at) {
          removeEventListener('scroll', check);
          show();
        }
      };
      addEventListener('scroll', check, { passive: true });
      return check();
    }
    if (t.on === 'exit') {
      const leave = (e: MouseEvent) => {
        if (e.clientY <= 0 && !e.relatedTarget) {
          d.removeEventListener('mouseout', leave);
          show();
        }
      };
      d.addEventListener('mouseout', leave);
    }
  }

  let ran = false;
  function run(items: Announcement[]) {
    if (ran) return;
    ran = true;
    const pick = (items || []).filter((a) => cfg.preview || (live(a) && onPage(a) && due(a)));
    // One of each kind, in the dashboard's order.
    const seen: Record<string, 1> = {};
    pick.forEach((a) => {
      if (seen[a.kind]) return;
      seen[a.kind] = 1;
      arm(a);
    });
  }
  const start = (fn: () => void) => (d.readyState === 'loading' ? d.addEventListener('DOMContentLoaded', fn) : fn());

  if (cfg.items) return start(() => run(cfg.items!));
  if (!cfg.api || !cfg.key) return;
  // Last answer first (no wait, no layout jump on the next page), then refresh it for the next page view.
  const cached = get('cache');
  if (cached && now - cached.at < 864e5) start(() => run(cached.items));
  fetch(`${cfg.api}/public/v1/announcements`, { headers: { 'x-site-key': cfg.key } })
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => {
      if (!j) return;
      put('cache', { at: Date.now(), items: j.items });
      if (!cached) start(() => run(j.items));
    })
    .catch(() => {});
}

const js = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c');

/** The <script> that shows the site's announcements. Empty without an API origin and site key. */
export function announceBody(cfg: AnnounceConfig | null | undefined): string {
  if (!cfg || ((!cfg.api || !cfg.key) && !cfg.items)) return '';
  return `<script>(${announceClient.toString()})(${js({ ...cfg, api: cfg.api?.replace(/\/+$/, '') })});</script>\n`;
}
