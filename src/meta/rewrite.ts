// Puts managed tags into a rendered page: drops the page's own tags we replace, inserts ours, sets <html lang>.
import { tokens } from '../shared/html';
import { escapeHtml } from '../shared/util';
import { renderTag, tagKey, type HeadTag } from './head';

export type Injection = {
  head: HeadTag[];
  lang?: string;
  /** Raw HTML placed first in <head> (consent defaults must run before any tag). */
  headStart?: string;
  /** Raw HTML placed at the end of <head>. */
  headEnd?: string;
  bodyStart?: string;
  bodyEnd?: string;
};

export const MARK = 'u1webcore';

export function inject(html: string, { head, lang, headStart = '', headEnd = '', bodyStart = '', bodyEnd = '' }: Injection): string {
  const keys = new Set(head.map((t) => tagKey(t.tag, t.attrs)).filter(Boolean));
  const cuts: [number, number][] = [];
  let headOpen = -1;
  let headClose = -1;
  let afterCharset = -1;
  let htmlTag: { start: number; end: number; lang?: string } | null = null;
  let bodyOpen = -1;
  let bodyClose = -1;
  let titleStart = -1;

  for (const t of tokens(html)) {
    if (t.type === 'open') {
      if (t.name === 'html' && !htmlTag) htmlTag = { start: t.start, end: t.end, lang: t.attrs.lang };
      else if (t.name === 'head' && headOpen === -1) headOpen = t.end;
      else if (t.name === 'body' && bodyOpen === -1) bodyOpen = t.end;
      else if (headOpen !== -1 && headClose === -1) {
        if (t.name === 'meta' && 'charset' in t.attrs) afterCharset = t.end;
        if (t.name === 'title') titleStart = t.start;
        const key = tagKey(t.name, t.attrs);
        if (key && keys.has(key) && t.name !== 'title') cuts.push([t.start, t.end]);
      }
    } else if (t.type === 'close') {
      if (t.name === 'title' && titleStart !== -1 && headClose === -1 && keys.has('title')) {
        cuts.push([titleStart, t.end]);
        titleStart = -1;
      } else if (t.name === 'head' && headClose === -1) headClose = t.start;
      else if (t.name === 'body') bodyClose = t.start;
    }
  }
  if (headOpen === -1 || headClose === -1) return html;

  const block = `\n<!--${MARK}-->\n${head.map(renderTag).join('\n')}\n<!--/${MARK}-->`;
  const edits: { at: number; end: number; text: string }[] = cuts.map(([s, e]) => wholeLine(html, s, e));
  edits.push({ at: afterCharset !== -1 ? afterCharset : headOpen, end: afterCharset !== -1 ? afterCharset : headOpen, text: headStart + block });
  if (headEnd) edits.push({ at: headClose, end: headClose, text: headEnd });
  if (bodyStart && bodyOpen !== -1) edits.push({ at: bodyOpen, end: bodyOpen, text: bodyStart });
  if (bodyEnd && bodyClose !== -1) edits.push({ at: bodyClose, end: bodyClose, text: bodyEnd });
  if (lang && htmlTag && htmlTag.lang !== lang) {
    const open = html.slice(htmlTag.start, htmlTag.end);
    const next = /\slang\s*=/i.test(open) ? open.replace(/\slang\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/i, ` lang="${escapeHtml(lang)}"`) : open.replace(/^<html/i, `<html lang="${escapeHtml(lang)}"`);
    edits.push({ at: htmlTag.start, end: htmlTag.end, text: next });
  }

  edits.sort((a, b) => b.at - a.at || b.end - a.end);
  let out = html;
  for (const e of edits) out = out.slice(0, e.at) + e.text + out.slice(e.end);
  return out;
}

/** A removed tag that sat alone on its line takes the line with it. */
function wholeLine(html: string, start: number, end: number) {
  const lineStart = html.lastIndexOf('\n', start - 1) + 1;
  const after = /^[ \t]*\r?\n/.exec(html.slice(end, end + 200));
  if (/^[ \t]*$/.test(html.slice(lineStart, start)) && after) return { at: lineStart, end: end + after[0].length, text: '' };
  return { at: start, end, text: '' };
}
