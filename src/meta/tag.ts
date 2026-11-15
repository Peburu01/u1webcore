// One <head> tag as data, and the helpers that build them. Shared by meta and social tags.
export type HeadTag = { tag: 'title' | 'meta' | 'link' | 'script'; attrs: Record<string, string>; content?: string };

export const meta = (key: 'name' | 'property', id: string, content: string | number | undefined): HeadTag | null =>
  content === undefined || content === '' ? null : { tag: 'meta', attrs: { [key]: id, content: String(content) } };

export const link = (attrs: Record<string, string | undefined>): HeadTag | null =>
  attrs.href ? { tag: 'link', attrs: Object.fromEntries(Object.entries(attrs).filter(([, v]) => v !== undefined)) as Record<string, string> } : null;
