// robots.txt with a registry of crawlers grouped by what they do with your pages.
// Vendors split their bots by purpose (Nov 2026 docs): blocking a *training* bot keeps you out of model
// training; blocking a *search* bot removes you from that vendor's AI answers. User-fetch agents act for a
// person who asked about your page (some don't follow robots.txt at all, e.g. ChatGPT-User).
import type { RobotsPreset, RobotsRule, SiteSettings } from '../shared/types';
import { origin } from '../shared/util';

export type BotPurpose = 'search' | 'ai-search' | 'ai-user' | 'ai-training' | 'seo-tool' | 'social';
export type Bot = { agent: string; owner: string; purpose: BotPurpose; note?: string };

export const BOTS: Bot[] = [
  { agent: 'Googlebot', owner: 'Google', purpose: 'search', note: 'Search, including AI Overviews and AI Mode' },
  { agent: 'Bingbot', owner: 'Microsoft', purpose: 'search', note: 'Bing and Copilot answers' },
  { agent: 'Applebot', owner: 'Apple', purpose: 'search', note: 'Siri and Spotlight' },
  { agent: 'DuckDuckBot', owner: 'DuckDuckGo', purpose: 'search' },
  { agent: 'YandexBot', owner: 'Yandex', purpose: 'search' },
  { agent: 'Baiduspider', owner: 'Baidu', purpose: 'search' },
  { agent: 'OAI-SearchBot', owner: 'OpenAI', purpose: 'ai-search', note: 'ChatGPT search results' },
  { agent: 'Claude-SearchBot', owner: 'Anthropic', purpose: 'ai-search', note: 'Claude search answers' },
  { agent: 'PerplexityBot', owner: 'Perplexity', purpose: 'ai-search' },
  { agent: 'ChatGPT-User', owner: 'OpenAI', purpose: 'ai-user', note: 'Fetches a page a user asked about; may ignore robots.txt' },
  { agent: 'Claude-User', owner: 'Anthropic', purpose: 'ai-user', note: 'Fetches a page a user asked about' },
  { agent: 'Perplexity-User', owner: 'Perplexity', purpose: 'ai-user' },
  { agent: 'MistralAI-User', owner: 'Mistral', purpose: 'ai-user' },
  { agent: 'GPTBot', owner: 'OpenAI', purpose: 'ai-training' },
  { agent: 'ClaudeBot', owner: 'Anthropic', purpose: 'ai-training' },
  { agent: 'Google-Extended', owner: 'Google', purpose: 'ai-training', note: 'Token only: Gemini training and grounding. Does not affect Search' },
  { agent: 'Applebot-Extended', owner: 'Apple', purpose: 'ai-training', note: 'Token only: Apple Intelligence training' },
  { agent: 'CCBot', owner: 'Common Crawl', purpose: 'ai-training', note: 'Open dataset used by many model builders' },
  { agent: 'Meta-ExternalAgent', owner: 'Meta', purpose: 'ai-training' },
  { agent: 'Bytespider', owner: 'ByteDance', purpose: 'ai-training' },
  { agent: 'Amazonbot', owner: 'Amazon', purpose: 'ai-training' },
  { agent: 'cohere-ai', owner: 'Cohere', purpose: 'ai-training' },
  { agent: 'Diffbot', owner: 'Diffbot', purpose: 'ai-training' },
  { agent: 'AhrefsBot', owner: 'Ahrefs', purpose: 'seo-tool' },
  { agent: 'SemrushBot', owner: 'Semrush', purpose: 'seo-tool' },
  { agent: 'facebookexternalhit', owner: 'Meta', purpose: 'social', note: 'Link previews; keep allowed' },
  { agent: 'Twitterbot', owner: 'X', purpose: 'social', note: 'Link previews; keep allowed' },
  { agent: 'LinkedInBot', owner: 'LinkedIn', purpose: 'social', note: 'Link previews; keep allowed' },
];

export const PRESETS: Record<RobotsPreset, { label: string; help: string; block: BotPurpose[] }> = {
  open: { label: 'Open', help: 'Every crawler, including AI training.', block: [] },
  'no-training': { label: 'Search + AI answers, no training', help: 'Show up in Google, Bing, ChatGPT, Claude and Perplexity answers; opt out of model training.', block: ['ai-training'] },
  'search-only': { label: 'Search engines only', help: 'Classic search only. Also hides you from AI assistants’ answers.', block: ['ai-training', 'ai-search', 'ai-user'] },
  closed: { label: 'Closed', help: 'Block everything (staging sites).', block: [] },
};

export function robotsTxt(site: SiteSettings, siteUrl: string, extra: { sitemap?: boolean } = {}): string {
  const r = site.robots ?? {};
  const preset = r.preset ?? 'no-training';
  const lines: string[] = [];
  const base = origin(site.identity?.url || siteUrl);
  const closed = preset === 'closed' || r.indexable === false;

  const signals = r.contentSignals;
  if (signals && Object.values(signals).some((v) => v !== undefined)) {
    lines.push('# Content signals: search = indexing and links, ai-input = AI answers, ai-train = model training.');
  }

  const group = (agents: string[], body: string[]) => {
    lines.push(...agents.map((a) => `User-agent: ${a}`), ...body, '');
  };

  const everyone = closed ? ['Disallow: /'] : [...(r.disallow ?? []).map((p) => `Disallow: ${p}`), (r.disallow ?? []).length ? '' : 'Allow: /'].filter(Boolean);
  if (signals && !closed) {
    const parts = [
      signals.search !== undefined && `search=${signals.search ? 'yes' : 'no'}`,
      signals.aiInput !== undefined && `ai-input=${signals.aiInput ? 'yes' : 'no'}`,
      signals.aiTrain !== undefined && `ai-train=${signals.aiTrain ? 'yes' : 'no'}`,
    ].filter(Boolean);
    if (parts.length) everyone.unshift(`Content-Signal: ${parts.join(', ')}`);
  }
  if (r.contentUsage && !closed) everyone.unshift(`Content-Usage: ${r.contentUsage}`);
  group(['*'], everyone);

  if (!closed) {
    const blocked = BOTS.filter((b) => PRESETS[preset].block.includes(b.purpose)).map((b) => b.agent);
    if (blocked.length) group(blocked, ['Disallow: /']);
    for (const rule of r.rules ?? []) group(rule.agents, ruleBody(rule));
  }

  if (extra.sitemap !== false && site.sitemap?.enabled !== false && base && !closed) lines.push(`Sitemap: ${base}/sitemap-index.xml`);
  return `${lines.join('\n').trim()}\n`;
}

function ruleBody(rule: RobotsRule): string[] {
  const body = [...(rule.allow ?? []).map((p) => `Allow: ${p}`), ...(rule.disallow ?? []).map((p) => `Disallow: ${p}`)];
  if (rule.crawlDelay) body.push(`Crawl-delay: ${rule.crawlDelay}`);
  return body.length ? body : ['Allow: /'];
}

/** Which registry bots end up blocked from "/" (for the dashboard and checks). */
export function blockedBots(site: SiteSettings): Bot[] {
  const r = site.robots ?? {};
  if (r.preset === 'closed' || r.indexable === false) return BOTS;
  const block = PRESETS[r.preset ?? 'no-training'].block;
  const custom = new Set((r.rules ?? []).filter((x) => x.disallow?.includes('/')).flatMap((x) => x.agents.map((a) => a.toLowerCase())));
  return BOTS.filter((b) => block.includes(b.purpose) || custom.has(b.agent.toLowerCase()));
}
