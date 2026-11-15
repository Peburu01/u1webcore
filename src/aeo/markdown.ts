// Rendered page → clean Markdown (for /page.md, llms-full.txt and AI agents).
// Reads <main> when there is one; otherwise <body> without site chrome (header, nav, footer, aside).
import { find, tree, type Node } from '../shared/html';
import { absolute, collapse } from '../shared/util';

const SKIP = new Set(['script', 'style', 'noscript', 'template', 'svg', 'canvas', 'iframe', 'form', 'button', 'select', 'input', 'textarea', 'dialog', 'head']);
const CHROME = new Set(['header', 'nav', 'footer', 'aside']);
const FORMAT = new Set(['strong', 'b', 'em', 'i', 'code', 's', 'del', 'sup', 'sub', 'small', 'mark', 'abbr', 'br']);

export type MarkdownOptions = { base?: string; title?: string; url?: string };

export function toMarkdown(html: string, opts: MarkdownOptions = {}): string {
  const doc = tree(html);
  const main = find(doc, (n) => n.name === 'main' || n.attrs.role === 'main');
  const root = main ?? find(doc, (n) => n.name === 'body') ?? doc;
  const ctx: Ctx = { base: opts.base ?? '', chrome: !main };
  let body = block(root, ctx).replace(/\n{3,}/g, '\n\n').trim();
  if (opts.title && !/^# /m.test(body.split('\n').slice(0, 3).join('\n'))) body = `# ${opts.title}\n\n${body}`;
  if (opts.url) body = `${body}\n\nSource: ${opts.url}`;
  return `${body.trim()}\n`;
}

type Ctx = { base: string; chrome: boolean; list?: { ordered: boolean; n: number; depth: number }; pre?: boolean };

const hidden = (n: Node) => 'hidden' in n.attrs || n.attrs['aria-hidden'] === 'true' || 'data-u1-skip' in n.attrs || /display\s*:\s*none/.test(n.attrs.style ?? '');

function block(node: Node, ctx: Ctx): string {
  let out = '';
  let line = '';
  const flush = () => {
    const t = collapse(line);
    if (t) out += `${t}\n\n`;
    line = '';
  };
  let prevEl = false;
  for (const c of node.children) {
    if (typeof c === 'string') {
      line += c;
      prevEl = false;
      continue;
    }
    if (SKIP.has(c.name) || hidden(c) || (ctx.chrome && CHROME.has(c.name))) continue;
    const kind = KIND[c.name];
    if (!kind) {
      // Minified HTML glues sibling buttons/badges together ("Start freeSee how"); keep them apart.
      if (prevEl && !FORMAT.has(c.name) && line && !/\s$/.test(line)) line += ' ';
      line += inline(c, ctx);
      prevEl = !FORMAT.has(c.name);
      continue;
    }
    prevEl = false;
    flush();
    out += kind(c, ctx);
  }
  flush();
  return out;
}

const KIND: Record<string, (n: Node, ctx: Ctx) => string> = {
  ...Object.fromEntries([1, 2, 3, 4, 5, 6].map((l) => [`h${l}`, (n: Node, ctx: Ctx) => {
    const t = collapse(inline(n, ctx));
    return t ? `${'#'.repeat(l)} ${t}\n\n` : '';
  }])),
  p: (n, ctx) => para(inline(n, ctx)),
  blockquote: (n, ctx) => {
    const inner = block(n, ctx).trim();
    return inner ? `${inner.split('\n').map((l) => (l ? `> ${l}` : '>')).join('\n')}\n\n` : '';
  },
  pre: (n) => {
    const code = find(n, (c) => c.name === 'code');
    const lang = /(?:^|\s)(?:language|lang)-(\S+)/.exec(code?.attrs.class ?? '')?.[1] ?? '';
    const text = raw(code ?? n).replace(/^\n+|\s+$/g, '');
    return `\`\`\`${lang}\n${text}\n\`\`\`\n\n`;
  },
  ul: (n, ctx) => list(n, ctx, false),
  ol: (n, ctx) => list(n, ctx, true),
  hr: () => '---\n\n',
  table: (n, ctx) => table(n, ctx),
  figure: (n, ctx) => block(n, ctx),
  figcaption: (n, ctx) => para(`*${collapse(inline(n, ctx))}*`),
  dl: (n, ctx) => {
    let out = '';
    for (const c of n.children) {
      if (typeof c === 'string') continue;
      if (c.name === 'dt') out += `**${collapse(inline(c, ctx))}**\n`;
      if (c.name === 'dd') out += `: ${collapse(inline(c, ctx))}\n\n`;
    }
    return out;
  },
  ...Object.fromEntries(['div', 'section', 'article', 'main', 'header', 'footer', 'nav', 'aside', 'details', 'summary', 'address', 'li', 'body'].map((k) => [k, (n: Node, ctx: Ctx) => block(n, ctx)])),
};

const para = (s: string) => {
  const t = s.replace(/[ \t]*\n[ \t]*/g, '  \n').replace(/[ \t]+/g, ' ').trim();
  return t ? `${t}\n\n` : '';
};

function list(n: Node, ctx: Ctx, ordered: boolean): string {
  const depth = (ctx.list?.depth ?? -1) + 1;
  let i = Number(n.attrs.start) || 1;
  let out = '';
  for (const c of n.children) {
    if (typeof c === 'string' || c.name !== 'li' || hidden(c)) continue;
    const marker = ordered ? `${i++}.` : '-';
    const inner = block(c, { ...ctx, list: { ordered, n: i, depth } }).trim().replace(/\n{2,}/g, '\n');
    const [first, ...rest] = inner.split('\n');
    const pad = ' '.repeat(marker.length + 1);
    out += `${'  '.repeat(depth)}${marker} ${first ?? ''}\n${rest.map((l) => (/^\s*(?:-|\d+\.) /.test(l) ? l : `${'  '.repeat(depth)}${pad}${l}`)).join('\n')}${rest.length ? '\n' : ''}`;
  }
  return depth === 0 ? `${out}\n` : out;
}

function table(n: Node, ctx: Ctx): string {
  const rows: string[][] = [];
  const walk = (x: Node) => {
    for (const c of x.children) {
      if (typeof c === 'string') continue;
      if (c.name === 'tr') rows.push(c.children.filter((d): d is Node => typeof d !== 'string' && (d.name === 'td' || d.name === 'th')).map((d) => collapse(inline(d, ctx)).replace(/\|/g, '\\|')));
      else walk(c);
    }
  };
  walk(n);
  if (!rows.length) return '';
  const width = Math.max(...rows.map((r) => r.length));
  const fill = (r: string[]) => `| ${[...r, ...Array(width - r.length).fill('')].join(' | ')} |`;
  return `${[fill(rows[0]), `|${' --- |'.repeat(width)}`, ...rows.slice(1).map(fill)].join('\n')}\n\n`;
}

function inline(node: Node | string, ctx: Ctx): string {
  if (typeof node === 'string') return node.replace(/[ \t\r\n]+/g, ' ');
  if (SKIP.has(node.name) || hidden(node)) return '';
  const inner = () => node.children.map((c) => inline(c, ctx)).join('');
  switch (node.name) {
    case 'br':
      return '\n';
    case 'strong':
    case 'b':
      return wrap(inner(), '**');
    case 'em':
    case 'i':
      return wrap(inner(), '*');
    case 's':
    case 'del':
      return wrap(inner(), '~~');
    case 'code':
      return `\`${raw(node).replace(/`/g, '\\`')}\``;
    case 'a': {
      const text = collapse(inner());
      const href = node.attrs.href;
      if (!href || href.startsWith('#') || /^javascript:/i.test(href)) return text;
      const url = absolute(href, ctx.base) ?? href;
      return text ? `[${text}](${url})` : '';
    }
    case 'img': {
      const src = node.attrs.src;
      if (!src || src.startsWith('data:')) return '';
      return `![${collapse(node.attrs.alt ?? '')}](${absolute(src, ctx.base) ?? src})`;
    }
    case 'picture':
      return inline(find(node, (c) => c.name === 'img') ?? '', ctx);
    default:
      return KIND[node.name] ? ` ${collapse(block(node, ctx))} ` : inner();
  }
}

const wrap = (s: string, m: string) => {
  const t = s.trim();
  if (!t) return s;
  const lead = s.match(/^\s*/)?.[0] ? ' ' : '';
  const trail = s.match(/\s*$/)?.[0] ? ' ' : '';
  return `${lead}${m}${t}${m}${trail}`;
};

const raw = (n: Node | string): string => (typeof n === 'string' ? n : n.name === 'br' ? '\n' : n.children.map(raw).join(''));
