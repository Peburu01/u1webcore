// A small, forgiving HTML reader for built/rendered pages: tokens, a light tree, entity decoding.
// Not a spec parser; good enough for head rewriting, page analysis and markdown export.

export type Attrs = Record<string, string>;
export type Token =
  | { type: 'open'; name: string; attrs: Attrs; start: number; end: number; selfClosing: boolean }
  | { type: 'close'; name: string; start: number; end: number }
  | { type: 'text'; text: string; start: number; end: number }
  | { type: 'comment'; start: number; end: number };

export const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const RAW = new Set(['script', 'style', 'textarea', 'title']);

const TAG = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<![^>]*>|<\/([a-zA-Z][\w:-]*)\s*>|<([a-zA-Z][\w:-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*(\/?)>/g;
const ATTR = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

export function parseAttrs(src: string): Attrs {
  const out: Attrs = {};
  for (const m of src.matchAll(ATTR)) out[m[1].toLowerCase()] = decode(m[2] ?? m[3] ?? m[4] ?? '');
  return out;
}

export function* tokens(html: string, from = 0, to = html.length): Generator<Token> {
  TAG.lastIndex = from;
  let pos = from;
  for (let m = TAG.exec(html); m && m.index < to; m = TAG.exec(html)) {
    if (m.index > pos) yield { type: 'text', text: html.slice(pos, m.index), start: pos, end: m.index };
    pos = TAG.lastIndex;
    if (m[1]) {
      yield { type: 'close', name: m[1].toLowerCase(), start: m.index, end: pos };
    } else if (m[2]) {
      const name = m[2].toLowerCase();
      yield { type: 'open', name, attrs: parseAttrs(m[3] ?? ''), start: m.index, end: pos, selfClosing: !!m[4] || VOID.has(name) };
      if (RAW.has(name) && !m[4]) {
        const close = html.toLowerCase().indexOf(`</${name}`, pos);
        const stop = close === -1 ? html.length : close;
        if (stop > pos) yield { type: 'text', text: html.slice(pos, stop), start: pos, end: stop };
        pos = stop;
        TAG.lastIndex = stop;
      }
    } else {
      yield { type: 'comment', start: m.index, end: pos };
    }
  }
  if (pos < to) yield { type: 'text', text: html.slice(pos, to), start: pos, end: to };
}

const NAMED: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', hellip: '…', rsquo: '’', lsquo: '‘',
  ldquo: '“', rdquo: '”', copy: '©', reg: '®', trade: '™', middot: '·', times: '×', euro: '€', pound: '£', rarr: '→', larr: '←', bull: '•', deg: '°',
};

export const decode = (s: string) =>
  s.includes('&')
    ? s.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (all, e: string) => {
        if (e[0] === '#') {
          const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
          return Number.isFinite(code) ? String.fromCodePoint(code) : all;
        }
        return NAMED[e.toLowerCase()] ?? all;
      })
    : s;

// ---- light tree ---------------------------------------------------------------

export type Node = { name: string; attrs: Attrs; children: (Node | string)[] };

/** Closing one of these implicitly closes open children (unclosed <p>, <li>…). */
export function tree(html: string, from = 0, to = html.length): Node {
  const root: Node = { name: '#root', attrs: {}, children: [] };
  const stack: Node[] = [root];
  for (const t of tokens(html, from, to)) {
    const top = stack[stack.length - 1];
    if (t.type === 'text') top.children.push(decode(t.text));
    else if (t.type === 'open') {
      if ((t.name === 'li' || t.name === 'p') && top.name === t.name) stack.pop();
      const node: Node = { name: t.name, attrs: t.attrs, children: [] };
      stack[stack.length - 1].children.push(node);
      if (!t.selfClosing) stack.push(node);
    } else if (t.type === 'close') {
      const at = stack.map((n) => n.name).lastIndexOf(t.name);
      if (at > 0) stack.length = at;
    }
  }
  return root;
}

export function find(node: Node, test: (n: Node) => boolean): Node | undefined {
  for (const c of node.children) {
    if (typeof c === 'string') continue;
    if (test(c)) return c;
    const hit = find(c, test);
    if (hit) return hit;
  }
  return undefined;
}

export function findAll(node: Node, test: (n: Node) => boolean, out: Node[] = []): Node[] {
  for (const c of node.children) {
    if (typeof c === 'string') continue;
    if (test(c)) out.push(c);
    findAll(c, test, out);
  }
  return out;
}

const INVISIBLE = new Set(['script', 'style', 'noscript', 'template', 'svg', 'head']);

export function textOf(node: Node | string): string {
  if (typeof node === 'string') return node;
  if (INVISIBLE.has(node.name) || 'hidden' in node.attrs || node.attrs['aria-hidden'] === 'true') return '';
  const inner = node.children.map(textOf).join('');
  return /^(p|div|section|article|li|h[1-6]|br|tr|td|th|header|footer|main|nav|aside|blockquote|figcaption)$/.test(node.name) ? ` ${inner} ` : inner;
}

/** Start/end offsets of the element's inner HTML (first match of `name`). */
export function innerRange(html: string, name: string): [number, number] | null {
  let open = -1;
  let depth = 0;
  for (const t of tokens(html)) {
    if (t.type === 'open' && t.name === name && !t.selfClosing) {
      if (open === -1) open = t.end;
      depth++;
    } else if (t.type === 'close' && t.name === name && open !== -1 && --depth === 0) return [open, t.start];
  }
  return null;
}
