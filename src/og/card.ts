// Generated share cards: 1200×630 PNG with the page title, site name and domain, in the site's colors.
// satori lays the card out as SVG, resvg (WebAssembly, so it also runs in a WebContainer) turns it into a PNG.
// Node only; the wasm and fonts sit next to the built integration (dist/astro/).
import { readFile } from 'node:fs/promises';
import satori from 'satori';
import { Resvg, initWasm } from '@resvg/resvg-wasm';
import type { SiteSettings } from '../shared/types';

export type CardInput = { title: string; site: SiteSettings; siteUrl: string; /** Logo as a data: URL, when the site has one in public/. */ logo?: string };

const asset = (name: string) => readFile(new URL(`./${name}`, import.meta.url));

let setup: Promise<{ regular: Buffer; bold: Buffer }> | null = null;
function init() {
  return (setup ??= (async () => {
    const [wasm, regular, bold] = await Promise.all([asset('resvg.wasm'), asset('inter-400.woff'), asset('inter-700.woff')]);
    await initWasm(wasm);
    return { regular, bold };
  })());
}

/** Black or white text, whichever reads better on `hex`. */
function contrast(hex: string): string {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex);
  if (!m) return '#ffffff';
  const [r, g, b] = m.slice(1).map((h) => {
    const c = parseInt(h, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? '#0b0b0f' : '#ffffff';
}

const hex = (v: string | undefined) => (v && /^#[\da-f]{6}$/i.test(v) ? v : undefined);

/** Plain objects in the shape satori reads (what JSX would compile to). */
type Node = { type: string; props: { style?: Record<string, unknown>; children?: Node | Node[] | string; src?: string; width?: number; height?: number } };
const el = (type: string, style: Record<string, unknown>, children?: Node['props']['children']): Node => ({ type, props: { style, children } });

export async function renderCard({ title, site, siteUrl, logo }: CardInput): Promise<Uint8Array> {
  const fonts = await init();
  const card = site.social?.card ?? {};
  const bg = hex(card.background) ?? hex(site.identity?.themeColor) ?? '#111318';
  const fg = hex(card.color) ?? contrast(bg);
  const accent = hex(card.accent) ?? fg;
  const name = site.identity?.name ?? site.organization?.name ?? '';
  const domain = siteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const size = title.length > 70 ? 56 : title.length > 40 ? 64 : 76;

  const svg = await satori(
    el('div', { width: 1200, height: 630, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 80, boxSizing: 'border-box', background: bg, color: fg, fontFamily: 'Inter' }, [
      el('div', { display: 'flex', alignItems: 'center', gap: 20, fontSize: 30, fontWeight: 700 }, [
        ...(logo ? [{ type: 'img', props: { src: logo, width: 64, height: 64, style: { objectFit: 'contain', borderRadius: 12 } } } as Node] : []),
        el('div', { display: 'flex' }, name),
      ]),
      el('div', { display: 'block', fontSize: size, fontWeight: 700, lineHeight: 1.12, letterSpacing: -1.5, lineClamp: 3 }, title),
      el('div', { display: 'flex', alignItems: 'center', gap: 16, fontSize: 26, opacity: 0.75 }, [el('div', { width: 40, height: 6, borderRadius: 3, background: accent }), el('div', { display: 'flex' }, domain)]),
    ]) as Parameters<typeof satori>[0], // satori takes plain {type, props} objects; its types say ReactNode
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: 'Inter', data: fonts.regular, weight: 400, style: 'normal' },
        { name: 'Inter', data: fonts.bold, weight: 700, style: 'normal' },
      ],
    },
  );
  return new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
}
