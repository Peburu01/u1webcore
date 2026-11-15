// One redirect list → checked (chains flattened, loops found) → Astro config, _redirects, vercel.json, nginx.
import type { RedirectRule } from '../shared/types';

export type RedirectIssue = { level: 'error' | 'warning'; from: string; message: string };

const clean = (p: string) => p.trim().replace(/\s+/g, '');

export function checkRedirects(rules: RedirectRule[] = []): { rules: Required<RedirectRule>[]; issues: RedirectIssue[] } {
  const issues: RedirectIssue[] = [];
  const map = new Map<string, Required<RedirectRule>>();
  for (const r of rules) {
    const from = clean(r.from);
    const to = clean(r.to);
    if (!from || !to) {
      issues.push({ level: 'error', from, message: 'Redirect needs both a source and a destination.' });
      continue;
    }
    if (!from.startsWith('/')) issues.push({ level: 'error', from, message: 'Source must be a path starting with "/".' });
    if (from === to) {
      issues.push({ level: 'error', from, message: 'Redirects to itself.' });
      continue;
    }
    if (map.has(from)) issues.push({ level: 'warning', from, message: 'Duplicate source; the last rule wins.' });
    map.set(from, { from, to, status: r.status ?? 301 });
  }
  // Flatten chains: a → b → c becomes a → c (one hop is what search engines and users want).
  const out: Required<RedirectRule>[] = [];
  for (const r of map.values()) {
    const seen = new Set([r.from]);
    let to = r.to;
    let hops = 0;
    while (map.has(to) && !seen.has(to)) {
      seen.add(to);
      to = map.get(to)!.to;
      hops++;
    }
    if (seen.has(to)) {
      issues.push({ level: 'error', from: r.from, message: `Redirect loop: ${[...seen].join(' → ')} → ${to}` });
      continue;
    }
    if (hops) issues.push({ level: 'warning', from: r.from, message: `Chain of ${hops + 1} hops, flattened to ${r.from} → ${to}.` });
    out.push({ ...r, to });
  }
  return { rules: out, issues };
}

/** Astro `redirects` config. Dynamic segments ([slug]) pass through unchanged. */
export const toAstro = (rules: Required<RedirectRule>[]) => Object.fromEntries(rules.map((r) => [r.from, { status: r.status, destination: r.to }]));

/** Netlify / Cloudflare Pages `_redirects`. */
export const toRedirectsFile = (rules: Required<RedirectRule>[]) => `${rules.map((r) => `${r.from} ${r.to} ${r.status}`).join('\n')}\n`;

export const toVercel = (rules: Required<RedirectRule>[]) => ({ redirects: rules.map((r) => ({ source: r.from, destination: r.to, permanent: r.status === 301 || r.status === 308, statusCode: r.status })) });

export const toNginx = (rules: Required<RedirectRule>[]) =>
  `${rules
    .filter((r) => !r.from.includes('*') && !r.from.includes('['))
    .map((r) => `location = ${r.from} { return ${r.status} ${r.to}; }`)
    .join('\n')}\n`;
