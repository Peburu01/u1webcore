// u1webcore: SEO, AEO/GEO, meta, Open Graph, JSON-LD, crawl files, tags and consent for a website.
// Pure functions only; framework adapters live in ./astro.
export * from './shared/types';
export * from './shared/util';
export * from './shared/resolve';
export * from './checker/analyze';
export * from './shared/html';
export * from './meta/head';
export * from './meta/tag';
export * from './social/social';
export * from './meta/rewrite';
export * from './schema/types';
export * from './schema/graph';
export * from './crawl/robots';
export * from './shared/pages';
export * from './crawl/sitemap';
export * from './aeo/llms';
export * from './aeo/markdown';
export * from './crawl/misc';
export * from './crawl/feeds';
export * from './edge/redirects';
export * from './edge/headers';
export * from './crawl/index';
export * from './consent/tags';
export * from './consent/consent';
export * from './checker/pixels';
export * from './checker/checks';
export * from './aeo/score';
export * from './shared/spec';
export * from './shared/page';

export * from './checker/audit';
export * from './shared/i18n';
