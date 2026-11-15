// Route → last change date, from the integration's git scan (patterns are route regex sources).
export function lastmodFor(list: { re: string; at: string }[], route: string): string | undefined {
  for (const l of list) {
    try {
      if (new RegExp(l.re).test(route) || new RegExp(l.re).test(route.replace(/\/$/, '')) || new RegExp(l.re).test(`${route.replace(/\/$/, '')}/`)) return l.at;
    } catch {
      /* bad pattern */
    }
  }
  return undefined;
}
