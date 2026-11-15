// Settings shapes. Both live as JSON in the site repo and are edited by the dashboard:
//   src/site.u1wc.json            SiteSettings, site-wide
//   src/pages/<page>.u1wc.json    PageSettings, next to the page file (contact.astro → contact.u1wc.json);
//                                 for a dynamic route ([slug].astro) one entry per URL: { "/projects/a": {...} }
// Every field is optional: missing values fall back to defaults, then to what the page itself renders.

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
export type JsonLdNode = { '@type': string | string[]; '@id'?: string; [key: string]: unknown };

export type RobotsDirectives = {
  index?: boolean;
  follow?: boolean;
  /** No text snippet or video preview (also keeps the page out of AI Overviews' quoted text). */
  nosnippet?: boolean;
  /** Characters; 0 = no snippet, -1 = no limit. */
  maxSnippet?: number;
  maxImagePreview?: 'none' | 'standard' | 'large';
  /** Seconds; 0 = static image only, -1 = no limit. */
  maxVideoPreview?: number;
  noimageindex?: boolean;
  notranslate?: boolean;
  /** Index content embedded via iframe even though the page is noindex. */
  indexifembedded?: boolean;
  /** ISO date; the page drops out of results after it. */
  unavailableAfter?: string;
  /** Bing only (Google ignores it). */
  noarchive?: boolean;
};

export type RobotsPreset = 'open' | 'no-training' | 'search-only' | 'closed';

export type RobotsRule = { agents: string[]; allow?: string[]; disallow?: string[]; crawlDelay?: number };

export type Address = {
  streetAddress?: string;
  addressLocality?: string;
  addressRegion?: string;
  postalCode?: string;
  /** ISO 3166-1 alpha-2, e.g. "IN", "GB". */
  addressCountry?: string;
};

export type ContactPoint = { contactType: string; telephone?: string; email?: string; areaServed?: string; availableLanguage?: string[] };

export type OrganizationSettings = {
  /** Organization, Corporation, LocalBusiness or any subtype (Restaurant, Dentist, OnlineStore…). */
  type?: string;
  name?: string;
  alternateName?: string;
  legalName?: string;
  description?: string;
  /** Square-ish, ≥112×112, readable on white. */
  logo?: string;
  image?: string;
  email?: string;
  /** With country code: +91 80 1234 5678. */
  telephone?: string;
  address?: Address;
  geo?: { latitude?: number; longitude?: number };
  /** Schema.org format: "Mo-Fr 09:00-18:00". */
  openingHours?: string[];
  priceRange?: string;
  areaServed?: string[];
  foundingDate?: string;
  numberOfEmployees?: number;
  contactPoints?: ContactPoint[];
  /** iso6523Code is preferred by Google over duns/leiCode. */
  identifiers?: { vatID?: string; taxID?: string; iso6523Code?: string; duns?: string; leiCode?: string; naics?: string; globalLocationNumber?: string };
  founders?: string[];
};

export type Locale = {
  /** BCP 47, used for hreflang and lang: "en", "fr", "en-GB". */
  code: string;
  /** URL prefix; "" for the unprefixed default. Defaults to "/<code>". */
  prefix?: string;
  /** Open Graph locale: "en_US". */
  ogLocale?: string;
  label?: string;
};

export type TagKind = 'gtm' | 'ga4' | 'meta' | 'linkedin' | 'tiktok' | 'clarity' | 'hotjar' | 'plausible' | 'fathom' | 'umami' | 'custom';
export type ConsentCategory = 'necessary' | 'analytics' | 'marketing' | 'preferences';

export type TagSettings = {
  id: string;
  kind: TagKind;
  label?: string;
  enabled?: boolean;
  /** Container / measurement / pixel / site id, or the domain for plausible. */
  value?: string;
  /** Script URL for umami / custom. */
  src?: string;
  /** Raw HTML for custom tags. */
  html?: string;
  consent?: ConsentCategory;
  placement?: 'head' | 'body-start' | 'body-end';
  /** Google Tag Manager only: first-party server container URL (e.g. https://tags.example.com). Loads gtm.js from there. */
  serverUrl?: string;
  /** Only load on these paths (prefix match, "/" = all). Empty = everywhere. `exclude` wins. */
  paths?: { include?: string[]; exclude?: string[] };
};

/** A dataLayer event pushed when something happens on the page. GTM tags listen for `name`. */
export type TagTrigger = {
  id: string;
  /** dataLayer event name, e.g. "cta_click". */
  name: string;
  /** click: element matching `selector` clicked. submit: form matching `selector` submitted. view: element matching `selector` first seen on screen. */
  on: 'click' | 'submit' | 'view';
  selector: string;
  /** Extra string fields pushed with the event, e.g. { "location": "hero" }. */
  params?: Record<string, string>;
};

export type ConsentSettings = {
  enabled?: boolean;
  /** Bump to ask everyone again. */
  version?: string;
  expiryDays?: number;
  /** Emit Google Consent Mode v2 defaults (denied) before any tag. */
  googleConsentMode?: boolean;
  /**
   * advanced: Google tags load right away and send cookieless pings until consent (Google's recommendation).
   * basic: Google tags wait for consent like every other tag.
   */
  googleMode?: 'advanced' | 'basic';
  /** ISO 3166 codes ("GB", "US-CA") where defaults are denied; elsewhere granted. Empty = denied everywhere. */
  regions?: string[];
  /** Treat the browser's Global Privacy Control signal as "reject marketing". */
  respectGpc?: boolean;
  position?: 'bottom' | 'bottom-left' | 'bottom-right';
  text?: {
    title?: string;
    message?: string;
    accept?: string;
    reject?: string;
    customize?: string;
    save?: string;
    analytics?: string;
    marketing?: string;
    preferences?: string;
  };
  policyUrl?: string;
};

export type RedirectRule = { from: string; to: string; status?: 301 | 302 | 307 | 308 };

export type FeedSettings = { path: string; title?: string; description?: string; /** Route prefix whose pages become items, e.g. "/blog/". */ include: string; format?: 'rss' | 'atom' | 'json' };

export type LlmsLink = { title: string; url: string; notes?: string };
export type LlmsSection = { title: string; links: LlmsLink[] };

export type SiteSettings = {
  $schema?: string;
  identity?: {
    name?: string;
    /** Shorter names / acronyms Google may use as the site name. */
    alternateName?: string[];
    /** Public origin: https://example.com */
    url?: string;
    language?: string;
    ogLocale?: string;
    /** "%s · Acme". "%s" is the page title. */
    titleTemplate?: string;
    description?: string;
    trailingSlash?: 'always' | 'never' | 'ignore';
    themeColor?: string;
    themeColorDark?: string;
  };
  social?: {
    /** Default share image, 1200×630. */
    image?: string;
    imageAlt?: string;
    imageWidth?: number;
    imageHeight?: number;
    twitterSite?: string;
    twitterCreator?: string;
    /** Profile URLs (LinkedIn, X, Instagram, Wikipedia, Wikidata…): Organization sameAs. */
    profiles?: string[];
    /** Facebook app ID (fb:app_id), for Facebook's sharing insights. */
    facebookAppId?: string;
    /** Mastodon / fediverse author handle (fediverse:creator), e.g. @acme@mastodon.social. */
    fediverseCreator?: string;
    /** Generated share cards (1200×630 PNG with the page title) for pages without their own share image. */
    card?: { enabled?: boolean; background?: string; color?: string; accent?: string };
  };
  icons?: {
    favicon?: string;
    svg?: string;
    appleTouchIcon?: string;
    icon192?: string;
    icon512?: string;
    maskable?: string;
  };
  manifest?: {
    enabled?: boolean;
    shortName?: string;
    backgroundColor?: string;
    display?: 'standalone' | 'minimal-ui' | 'browser' | 'fullscreen';
    startUrl?: string;
  };
  organization?: OrganizationSettings;
  verification?: { google?: string; bing?: string; yandex?: string; baidu?: string; naver?: string; pinterest?: string; facebook?: string };
  robots?: {
    /** Site-wide kill switch: noindex everything (staging). */
    indexable?: boolean;
    defaults?: RobotsDirectives;
    preset?: RobotsPreset;
    /** Extra blocked paths for every bot. */
    disallow?: string[];
    rules?: RobotsRule[];
    /** Cloudflare Content Signals line. */
    contentSignals?: { search?: boolean; aiInput?: boolean; aiTrain?: boolean };
    /** IETF AIPREF Content-Usage line, e.g. "train-ai=n". */
    contentUsage?: string;
  };
  sitemap?: { enabled?: boolean; exclude?: string[]; images?: boolean; lastmod?: boolean };
  llms?: {
    enabled?: boolean;
    /** Blockquote summary under the H1. */
    summary?: string;
    /** Paragraphs explaining the site. */
    details?: string;
    sections?: LlmsSection[];
    /** Also publish llms-full.txt (every page's markdown). */
    full?: boolean;
    /** Publish /page.md markdown versions and link them. */
    markdownPages?: boolean;
  };
  languages?: { locales?: Locale[]; defaultLocale?: string; xDefault?: string };
  feeds?: FeedSettings[];
  redirects?: RedirectRule[];
  security?: {
    txt?: { contact?: string[]; expires?: string; encryption?: string; policy?: string; acknowledgments?: string; preferredLanguages?: string; hiring?: string };
    headers?: { enabled?: boolean; hsts?: boolean; csp?: string; referrerPolicy?: string; permissionsPolicy?: string; frameOptions?: 'DENY' | 'SAMEORIGIN' | '' };
  };
  ads?: { adsTxt?: string[]; appAdsTxt?: string[] };
  indexNow?: { enabled?: boolean; key?: string };
  tags?: TagSettings[];
  /** dataLayer events for clicks, form submits and views. Runs for every page, before any tag. */
  tagManager?: { triggers?: TagTrigger[] };
  consent?: ConsentSettings;
  legal?: { privacy?: string; terms?: string; cookies?: string; imprint?: string };
  hints?: { preconnect?: string[]; dnsPrefetch?: string[] };
  /** Site-wide custom JSON-LD nodes, added to every page's graph. */
  schema?: { extra?: JsonLdNode[] };
};

export type Person = { name: string; url?: string; jobTitle?: string; description?: string; image?: string; sameAs?: string[]; knowsAbout?: string[] };
export type Entity = { name: string; sameAs?: string; type?: string };
export type FaqItem = { question: string; answer: string };
export type Breadcrumb = { name: string; url: string };

export type PageSettings = {
  $schema?: string;
  /** Pushed to the dataLayer on this page before the tag manager loads, e.g. { pageType: "product", sku: "A1" }. */
  dataLayer?: Record<string, string | number | boolean>;
  title?: string;
  /** Use the title as-is, without the site template. */
  absoluteTitle?: boolean;
  description?: string;
  canonical?: string;
  keywords?: string[];
  robots?: RobotsDirectives;
  og?: {
    type?: 'website' | 'article' | 'profile' | 'product' | 'book' | 'video.other';
    title?: string;
    description?: string;
    image?: string;
    imageAlt?: string;
    imageWidth?: number;
    imageHeight?: number;
    /** false: no generated share card on this page (when the site generates them). */
    card?: boolean;
    /** This page's locale when it differs from the site's (translated pages), e.g. ta_IN. */
    locale?: string;
    /** Video shown inline in the share card (og:video), an https URL to an .mp4 or a player. */
    video?: string;
    article?: { section?: string; tags?: string[]; /** Author's profile URL; defaults to the Answers author. */ author?: string };
    /** Price for product/listing pages (product:price:*), read by Facebook and Pinterest. */
    product?: { price?: number; currency?: string };
    /** false: <meta name="pinterest" content="nopin">, so Pinterest won't save this page's images. */
    pinterest?: boolean;
  };
  twitter?: {
    card?: 'summary' | 'summary_large_image';
    title?: string;
    description?: string;
    image?: string;
    imageAlt?: string;
    /** This page's author on X (twitter:creator); defaults to the site's. */
    creator?: string;
    /** Up to two label/value pairs Slack and X show under the card, e.g. "Price" / "₹25 lakh". */
    label1?: string;
    data1?: string;
    label2?: string;
    data2?: string;
  };
  /** This page's own location or branch. Its fields replace the site organization on this page only (multi-location clients). */
  organization?: Partial<OrganizationSettings>;
  schema?: {
    /** Page type, or primary entity type (Article, Product…). See schema/types.ts. */
    type?: string;
    /** Type-specific schema.org properties, dotted paths allowed ("offers.price"). */
    data?: Record<string, Json>;
    /** false hides them; a list overrides the ones derived from the URL. */
    breadcrumbs?: boolean | Breadcrumb[];
    /** CSS selectors read aloud by assistants. */
    speakable?: string[];
    extra?: JsonLdNode[];
  };
  aeo?: {
    /** Answer-first summary (40–60 words). */
    summary?: string;
    faq?: FaqItem[];
    author?: Person;
    datePublished?: string;
    dateModified?: string;
    about?: Entity[];
    mentions?: Entity[];
    citations?: string[];
  };
  sitemap?: { include?: boolean; lastmod?: string };
  llms?: { include?: boolean; section?: string; title?: string; notes?: string };
  /** Explicit alternates: hreflang → URL. Overrides the ones derived from languages. */
  alternates?: Record<string, string>;
};

/** What the rendered page already contains, read from its HTML. Fallbacks when settings are empty. */
export type Detected = {
  title?: string;
  description?: string;
  lang?: string;
  canonical?: string;
  ogImage?: string;
  favicon?: string;
  themeColor?: string;
};

/** Content facts read from the rendered HTML, for checks and the AEO score. */
export type PageAnalysis = {
  h1: string[];
  headings: { level: number; text: string }[];
  images: { src: string; alt: string | null }[];
  links: { href: string; text: string }[];
  words: number;
  /** First ~600 characters of main text. */
  intro: string;
  /** Visible text of <main> (or body), for structured-data consistency checks. */
  text: string;
  hasViewport: boolean;
  hasCharset: boolean;
  jsonLd: unknown[];
  nosnippet: number;
};
