// Text width in pixels, the way Google's result page measures it (Arial). Titles cut at ~600px (20px font),
// descriptions at ~920px desktop / ~680px mobile (14px font). Lengths in characters are a poor proxy.

// Arial advance widths in 1/1000 em for ASCII 32..126.
const ARIAL = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];

const wide = /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/;

export function textWidth(text: string, fontPx: number): number {
  let units = 0;
  for (const ch of text) {
    const c = ch.codePointAt(0)!;
    if (c >= 32 && c <= 126) units += ARIAL[c - 32];
    else if (wide.test(ch)) units += 1000;
    else if (c > 0x1f000) units += 1000;
    else units += 556;
  }
  return Math.round((units / 1000) * fontPx);
}

export const SERP = {
  title: { font: 20, max: 600 },
  description: { font: 14, max: 920, mobile: 680 },
};

/** Text as Google would show it: cut on a word boundary with "…" once it passes the width. */
export function truncateTo(text: string, fontPx: number, maxPx: number): { text: string; cut: boolean } {
  if (textWidth(text, fontPx) <= maxPx) return { text, cut: false };
  const ell = textWidth(' …', fontPx);
  let out = '';
  for (const ch of text) {
    if (textWidth(out + ch, fontPx) + ell > maxPx) break;
    out += ch;
  }
  const word = out.replace(/\s+\S*$/, '');
  return { text: `${(word.length > out.length * 0.6 ? word : out).trimEnd()} …`, cut: true };
}
