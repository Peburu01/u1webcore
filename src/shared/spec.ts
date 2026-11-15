// Field definitions the dashboard renders its forms from. Keys are dotted paths into PageSettings / SiteSettings.
import { PRESETS } from '../crawl/robots';
import type { FieldType } from '../schema/types';
import { TAG_PRESETS } from '../consent/tags';

export type SpecType =
  | FieldType
  | 'color'
  | 'faq'
  | 'person'
  | 'entities'
  | 'redirects'
  | 'tags'
  | 'locales'
  | 'llmsSections'
  | 'robotsRules'
  | 'feeds'
  | 'contactPoints'
  | 'json'
  | 'schemaType'
  | 'schemaData';

export type SpecField = {
  key: string;
  label: string;
  type: SpecType;
  help?: string;
  placeholder?: string;
  options?: { value: string; label: string }[];
  /** SERP width meter. */
  pixels?: 'title' | 'description';
  /** Soft character guidance. */
  chars?: [number, number];
  /** Value shown as a hint when empty (computed from the page). */
  fallback?: string;
  /** Effective value when unset. */
  default?: boolean | string | number;
  /** Starts a tab in the group; it runs until the next field with a tab. Groups without tabs are one page. */
  tab?: string;
  /** Starts a titled sub-section (within its tab); it runs until the next field with a section or tab. */
  section?: string;
  /** Image fields: the size to aim for, checked against the loaded image. */
  image?: ImageSpec;
  /** Soft word-count guidance (instead of characters). */
  words?: [number, number];
  /** Boolean with three states: unset (say nothing), yes, no. Shown as a choice, not a switch. */
  tristate?: boolean;
  /** Shape the value should have; see checkFormat. */
  format?: Format;
};

/** Recommended image size. `exact` for icons that must be that size; `anyRatio` when several shapes are fine. */
export type ImageSpec = { size?: [number, number]; min?: [number, number]; exact?: boolean; anyRatio?: boolean; formats: string };

export const IMAGES = {
  share: { size: [1200, 630], min: [600, 315], formats: 'JPG, PNG or WebP, under 5 MB' },
  x: { size: [1200, 600], min: [300, 157], formats: 'JPG, PNG or WebP, under 5 MB' },
  logo: { size: [512, 512], min: [112, 112], anyRatio: true, formats: 'PNG, SVG or WebP on a plain background' },
  schema: { size: [1200, 675], min: [696, 0], anyRatio: true, formats: 'JPG, PNG or WebP; 16:9, 4:3 or 1:1' },
  favicon: { size: [48, 48], formats: '.ico holding 16, 32 and 48 px' },
  svg: { formats: 'SVG with a square viewBox' },
  apple: { size: [180, 180], exact: true, formats: 'PNG, no transparency' },
  icon192: { size: [192, 192], exact: true, formats: 'PNG' },
  icon512: { size: [512, 512], exact: true, formats: 'PNG' },
  maskable: { size: [512, 512], exact: true, formats: 'PNG; keep the logo inside the centre 80%' },
} satisfies Record<string, ImageSpec>;

/** Checks the loaded image against its spec; returns a warning or null. */
export function checkImage(spec: ImageSpec, width: number, height: number): string | null {
  const [w, h] = spec.size ?? [0, 0];
  if (spec.exact && w && (width !== w || height !== h)) return `Should be exactly ${w} × ${h} px.`;
  if (spec.min && (width < spec.min[0] || height < spec.min[1])) return `Too small: at least ${spec.min[0]}${spec.min[1] ? ` × ${spec.min[1]}` : ' px wide'}${spec.min[1] ? ' px' : ''}.`;
  if (w && h && !spec.anyRatio && Math.abs(width / height - w / h) > 0.05 * (w / h)) return `Shape is ${(width / height).toFixed(2)}:1; apps crop to ${(w / h).toFixed(2)}:1.`;
  return null;
}

export type Format = 'url' | 'absoluteUrl' | 'email' | 'phone' | 'handle' | 'lang' | 'ogLocale' | 'country' | 'color';

const FORMATS: Record<Format, [RegExp, string]> = {
  url: [/^(https?:\/\/[^\s]+|\/[^\s]*)$/, 'Use a full URL (https://…) or a path starting with /.'],
  absoluteUrl: [/^https:\/\/[^\s/]+(\/[^\s]*)?$/, 'Use a full https:// URL.'],
  email: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Not an email address.'],
  phone: [/^\+[\d\s().-]{6,}$/, 'Use international format, e.g. +91 80 1234 5678.'],
  handle: [/^(@?\w{1,15}|https:\/\/(www\.)?(x|twitter)\.com\/\w{1,15})$/, 'An X handle such as @accord (up to 15 letters, digits or _).'],
  lang: [/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/, 'A language code such as en, en-IN or fr.'],
  ogLocale: [/^[a-z]{2,3}_[A-Z]{2}$/, 'Language_TERRITORY, e.g. en_US or en_IN.'],
  country: [/^[A-Z]{2}$/, 'Two capital letters (ISO 3166), e.g. IN.'],
  color: [/^#([\da-f]{3}|[\da-f]{6})$/i, 'A hex color such as #2d368e.'],
};

/** Inline format hint for a typed value; null when it fits (or is empty). */
export function checkFormat(format: Format, value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null;
  const [re, message] = FORMATS[format];
  return re.test(value.trim()) ? null : message;
}

/** `help` is the one-line description shown under the group's title. */
export type SpecGroup = { id: string; label: string; help?: string; fields: SpecField[] };

/** A group's fields split into its tabs; a single untitled tab when it has none. */
export function tabsOf(fields: SpecField[]): { label: string; fields: SpecField[] }[] {
  const tabs: { label: string; fields: SpecField[] }[] = [];
  for (const f of fields) {
    if (f.tab || !tabs.length) tabs.push({ label: f.tab ?? '', fields: [f] });
    else tabs[tabs.length - 1].fields.push(f);
  }
  return tabs;
}

const opts = (...list: string[]) => list.map((v) => ({ value: v, label: v }));

export const PAGE_SPEC: SpecGroup[] = [
  {
    id: 'search',
    label: 'Search',
    help: 'How this page appears in search results.',
    fields: [
      { key: 'title', label: 'Title', type: 'text', pixels: 'title', fallback: 'pageTitle', help: 'The site title template is added automatically.', chars: [30, 60] },
      { key: 'absoluteTitle', label: 'Use title as-is', type: 'boolean', help: 'Skip the site title template on this page.' },
      { key: 'description', label: 'Description', type: 'textarea', pixels: 'description', chars: [120, 155], fallback: 'description' },
      { key: 'canonical', label: 'Canonical URL', type: 'url', section: 'Advanced', help: 'Only when this page duplicates another URL.', fallback: 'url', format: 'url' },
      { key: 'keywords', label: 'Keywords', type: 'list', help: 'Ignored by Google; some site search tools use them.' },
    ],
  },
  {
    id: 'social',
    label: 'Social',
    help: 'What people see when this page is shared.',
    fields: [
      { key: 'og.title', tab: 'Share card', label: 'Share title', type: 'text', fallback: 'og.title', chars: [30, 90] },
      { key: 'og.description', label: 'Share description', type: 'textarea', fallback: 'og.description', chars: [55, 200] },
      { key: 'og.image', label: 'Share image', type: 'image', fallback: 'og.image.url', placeholder: '/images/share.jpg', image: IMAGES.share },
      { key: 'og.card', label: 'Use the generated card', type: 'boolean', default: true, help: 'When the site generates share cards and this page has no image of its own.' },
      { key: 'og.imageAlt', label: 'Image alt text', type: 'text', fallback: 'og.image.alt', help: 'Describes the image for screen readers and when it fails to load.', chars: [10, 125] },
      { key: 'og.imageWidth', label: 'Image width', type: 'number', placeholder: '1200' },
      { key: 'og.imageHeight', label: 'Image height', type: 'number', placeholder: '630' },
      { key: 'twitter.card', tab: 'X', label: 'Card size', type: 'select', help: 'Large when there is an image, else small.', options: [{ value: 'summary_large_image', label: 'Large image' }, { value: 'summary', label: 'Small image' }] },
      { key: 'twitter.title', label: 'Title', type: 'text', fallback: 'twitter.title', chars: [10, 70] },
      { key: 'twitter.description', label: 'Description', type: 'textarea', fallback: 'twitter.description', chars: [50, 200] },
      { key: 'twitter.image', label: 'Image', type: 'image', fallback: 'twitter.image.url', image: IMAGES.x, help: 'Small card: square, at least 144 × 144 px.' },
      { key: 'twitter.imageAlt', label: 'Image alt text', type: 'text', fallback: 'twitter.image.alt', chars: [10, 125] },
      { key: 'twitter.creator', label: 'Author on X', type: 'text', placeholder: '@author', help: 'Credits the writer; defaults to the site’s creator.', format: 'handle' },
      { key: 'og.type', tab: 'More', label: 'Content type', type: 'select', options: opts('website', 'article', 'profile', 'product', 'book', 'video.other'), help: 'Article adds published and updated dates from Answers → Author.' },
      { key: 'og.locale', label: 'Locale', type: 'text', placeholder: 'ta_IN', help: 'Only when this page’s language differs from the site’s.', format: 'ogLocale' },
      { key: 'og.article.author', label: 'Author profile URL', type: 'url', section: 'Article', help: 'Used when the content type is article. Defaults to the Answers author.', format: 'url' },
      { key: 'og.article.section', label: 'Section', type: 'text', placeholder: 'Guides' },
      { key: 'og.article.tags', label: 'Tags', type: 'list' },
      { key: 'og.product.price', label: 'Price', type: 'number', section: 'Product or listing', placeholder: '2500000', help: 'Shown by Facebook and Pinterest.' },
      { key: 'og.product.currency', label: 'Currency', type: 'text', placeholder: 'INR' },
      { key: 'og.video', label: 'Video URL', type: 'url', section: 'Video', placeholder: 'https://…/tour.mp4', help: 'Plays inline in Facebook and Discord cards.', format: 'url' },
      { key: 'twitter.label1', label: 'Label 1', type: 'text', section: 'Extra details', placeholder: 'Price', help: 'Slack and X show up to two of these under the card.' },
      { key: 'twitter.data1', label: 'Value 1', type: 'text', placeholder: '₹25 lakh onwards' },
      { key: 'twitter.label2', label: 'Label 2', type: 'text', placeholder: 'Location' },
      { key: 'twitter.data2', label: 'Value 2', type: 'text', placeholder: 'ECR, Chennai' },
      { key: 'og.pinterest', label: 'Allow saving to Pinterest', type: 'boolean', default: true, section: 'Pinterest' },
    ],
  },
  {
    id: 'schema',
    label: 'Schema',
    help: 'Structured data that describes this page to search engines.',
    fields: [
      { key: 'schema.type', label: 'Page type', type: 'schemaType' },
      { key: 'schema.data', label: 'Details', type: 'schemaData' },
      { key: 'schema.breadcrumbs', label: 'Breadcrumbs', type: 'boolean', default: true, help: 'Built from the URL.' },
      { key: 'schema.speakable', label: 'Speakable selectors', type: 'list', section: 'Advanced', placeholder: '.summary, h1', help: 'Parts voice assistants may read aloud.' },
      { key: 'schema.extra', label: 'Custom JSON-LD nodes', type: 'json' },
    ],
  },
  {
    id: 'location',
    label: 'Location',
    help: 'A branch with its own address; replaces the site organization on this page.',
    fields: [
      { key: 'organization.name', tab: 'Branch', label: 'Branch name', type: 'text', placeholder: 'Accord Hospital, Whitefield' },
      { key: 'organization.type', label: 'Type', type: 'select', options: opts('Organization', 'LocalBusiness', 'Hospital', 'MedicalClinic', 'Dentist', 'Store', 'Restaurant', 'RealEstateAgent') },
      { key: 'organization.telephone', label: 'Phone', type: 'text', placeholder: '+91 80 1234 5678', format: 'phone' },
      { key: 'organization.email', label: 'Email', type: 'text', format: 'email' },
      { key: 'organization.address.streetAddress', tab: 'Address', label: 'Street', type: 'text' },
      { key: 'organization.address.addressLocality', label: 'City', type: 'text' },
      { key: 'organization.address.addressRegion', label: 'Region', type: 'text' },
      { key: 'organization.address.postalCode', label: 'Postal code', type: 'text' },
      { key: 'organization.address.addressCountry', label: 'Country (ISO)', type: 'text', placeholder: 'IN', format: 'country' },
      { key: 'organization.geo.latitude', label: 'Latitude', type: 'number' },
      { key: 'organization.geo.longitude', label: 'Longitude', type: 'number' },
      { key: 'organization.openingHours', tab: 'Hours', label: 'Opening hours', type: 'list', placeholder: 'Mo-Sa 08:00-20:00' },
    ],
  },
  {
    id: 'answers',
    label: 'Answers',
    help: 'What answer engines (AEO/GEO) quote and cite.',
    fields: [
      { key: 'aeo.summary', tab: 'Answer', label: 'Answer summary', type: 'textarea', words: [40, 60], help: 'A direct answer to the page’s main question. Shown to engines as the page abstract.' },
      { key: 'aeo.faq', label: 'Questions & answers', type: 'faq', help: 'Must also be visible on the page.' },
      { key: 'aeo.author', tab: 'Author', label: 'Author', type: 'person' },
      { key: 'aeo.datePublished', label: 'Published', type: 'date' },
      { key: 'aeo.dateModified', label: 'Updated', type: 'date', help: 'Defaults to the last git change.' },
      { key: 'aeo.about', tab: 'Entities', label: 'About', type: 'entities', help: 'Link to Wikipedia or Wikidata.' },
      { key: 'aeo.mentions', label: 'Mentions', type: 'entities' },
      { key: 'aeo.citations', label: 'Citations', type: 'list', placeholder: 'https://…' },
    ],
  },
  {
    id: 'indexing',
    label: 'Indexing',
    help: 'Search visibility, sitemap and llms.txt for this page.',
    fields: [
      { key: 'robots.index', tab: 'Robots', label: 'Show in search results', type: 'boolean', default: true },
      { key: 'robots.follow', label: 'Follow links', type: 'boolean', default: true },
      { key: 'robots.nosnippet', label: 'No snippet', type: 'boolean', help: 'Also hides the page from AI Overviews.' },
      { key: 'robots.noimageindex', label: 'Keep images out of image search', type: 'boolean' },
      { key: 'robots.maxSnippet', label: 'Max snippet length', type: 'number', placeholder: '-1', help: 'Characters; -1 = no limit, 0 = no snippet.' },
      { key: 'robots.maxImagePreview', label: 'Image preview', type: 'select', default: 'large', options: opts('large', 'standard', 'none') },
      { key: 'robots.unavailableAfter', label: 'Remove from results after', type: 'date' },
      { key: 'sitemap.include', tab: 'Sitemap', label: 'Include in sitemap', type: 'boolean', default: true },
      { key: 'sitemap.lastmod', label: 'Last modified (override)', type: 'date' },
      { key: 'llms.include', tab: 'llms.txt', label: 'Include in llms.txt', type: 'boolean', default: true },
      { key: 'llms.section', label: 'Section', type: 'text', placeholder: 'Docs, Optional…' },
      { key: 'llms.title', label: 'Link title', type: 'text' },
      { key: 'llms.notes', label: 'Note', type: 'text' },
    ],
  },
];

export const SITE_SPEC: SpecGroup[] = [
  {
    id: 'identity',
    label: 'Identity',
    help: 'Name, address and defaults for every page.',
    fields: [
      { key: 'identity.name', label: 'Site name', type: 'text' },
      { key: 'identity.url', label: 'Site URL', type: 'url', placeholder: 'https://example.com', format: 'absoluteUrl' },
      { key: 'identity.alternateName', label: 'Other names', type: 'list', help: 'Acronyms or short names Google may show.' },
      { key: 'identity.titleTemplate', label: 'Title template', type: 'text', placeholder: '%s · Acme', help: '%s is replaced by the page title.' },
      { key: 'identity.description', label: 'Default description', type: 'textarea', chars: [120, 155] },
      { key: 'identity.language', label: 'Language', type: 'text', placeholder: 'en', section: 'Locale', format: 'lang' },
      { key: 'identity.ogLocale', label: 'Open Graph locale', type: 'text', placeholder: 'en_US', format: 'ogLocale' },
      { key: 'identity.trailingSlash', label: 'Trailing slash', type: 'select', default: 'ignore', options: opts('ignore', 'always', 'never') },
      { key: 'identity.themeColor', label: 'Theme color', type: 'color', section: 'Browser colors' },
      { key: 'identity.themeColorDark', label: 'Theme color (dark)', type: 'color' },
    ],
  },
  {
    id: 'organization',
    label: 'Organization',
    help: 'Who runs the site; shown in full on the home, about and contact pages.',
    fields: [
      { key: 'organization.type', tab: 'Details', label: 'Type', type: 'select', default: 'Organization', options: opts('Organization', 'Corporation', 'LocalBusiness', 'ProfessionalService', 'Store', 'OnlineStore', 'Restaurant', 'MedicalBusiness', 'RealEstateAgent', 'EducationalOrganization', 'NGO', 'Person') },
      { key: 'organization.name', label: 'Name', type: 'text' },
      { key: 'organization.legalName', label: 'Legal name', type: 'text' },
      { key: 'organization.description', label: 'Description', type: 'textarea' },
      { key: 'organization.logo', label: 'Logo', type: 'image', placeholder: '/logo.png', image: IMAGES.logo, help: 'Google needs at least 112 × 112 px, readable on white.' },
      { key: 'organization.email', tab: 'Contact', label: 'Email', type: 'text', format: 'email' },
      { key: 'organization.telephone', label: 'Phone', type: 'text', placeholder: '+91 80 1234 5678', format: 'phone' },
      { key: 'organization.contactPoints', label: 'Contact points', type: 'contactPoints' },
      { key: 'organization.address.streetAddress', tab: 'Address', label: 'Street', type: 'text' },
      { key: 'organization.address.addressLocality', label: 'City', type: 'text' },
      { key: 'organization.address.addressRegion', label: 'Region', type: 'text' },
      { key: 'organization.address.postalCode', label: 'Postal code', type: 'text' },
      { key: 'organization.address.addressCountry', label: 'Country (ISO)', type: 'text', placeholder: 'IN', format: 'country' },
      { key: 'organization.geo.latitude', label: 'Latitude', type: 'number' },
      { key: 'organization.geo.longitude', label: 'Longitude', type: 'number' },
      { key: 'organization.openingHours', tab: 'Business', label: 'Opening hours', type: 'list', placeholder: 'Mo-Fr 09:00-18:00' },
      { key: 'organization.areaServed', label: 'Areas served', type: 'list' },
      { key: 'organization.priceRange', label: 'Price range', type: 'text', placeholder: '₹₹' },
      { key: 'organization.foundingDate', label: 'Founded', type: 'date' },
      { key: 'organization.numberOfEmployees', label: 'Employees', type: 'number' },
      { key: 'organization.founders', label: 'Founders', type: 'list' },
      { key: 'organization.identifiers.iso6523Code', tab: 'Identifiers', label: 'ISO 6523 code', type: 'text', help: 'Preferred by Google, e.g. 0060:123456789.' },
      { key: 'organization.identifiers.vatID', label: 'VAT / GST ID', type: 'text' },
      { key: 'organization.identifiers.leiCode', label: 'LEI', type: 'text' },
      { key: 'organization.identifiers.duns', label: 'DUNS', type: 'text' },
    ],
  },
  {
    id: 'social',
    label: 'Social',
    help: 'Default share card and social profiles.',
    fields: [
      { key: 'social.image', tab: 'Share image', label: 'Default share image', type: 'image', placeholder: '/images/share.jpg', help: 'For pages without their own image, unless share cards are generated.', image: IMAGES.share },
      { key: 'social.imageAlt', label: 'Image alt text', type: 'text', chars: [10, 125] },
      { key: 'social.imageWidth', label: 'Width', type: 'number', placeholder: '1200' },
      { key: 'social.imageHeight', label: 'Height', type: 'number', placeholder: '630' },
      { key: 'social.card.enabled', tab: 'Generated cards', label: 'Generate share cards', type: 'boolean', help: 'Pages without their own share image get a 1200 × 630 card with their title, site name and domain.' },
      { key: 'social.card.background', label: 'Background', type: 'color', help: 'Defaults to the theme color.' },
      { key: 'social.card.color', label: 'Text', type: 'color', help: 'Defaults to black or white, whichever reads best.' },
      { key: 'social.card.accent', label: 'Accent', type: 'color' },
      { key: 'social.twitterSite', tab: 'Accounts', label: 'X account', type: 'text', placeholder: '@acme', format: 'handle' },
      { key: 'social.twitterCreator', label: 'X creator', type: 'text', format: 'handle' },
      { key: 'social.facebookAppId', label: 'Facebook App ID', type: 'text', help: 'For Facebook’s sharing insights.' },
      { key: 'social.fediverseCreator', label: 'Mastodon author', type: 'text', placeholder: '@acme@mastodon.social', help: 'Credits shared links on Mastodon.' },
      { key: 'social.profiles', label: 'Profiles (sameAs)', type: 'list', placeholder: 'https://www.linkedin.com/company/…', help: 'LinkedIn, X, Instagram, YouTube, Wikipedia, Wikidata…' },
    ],
  },
  {
    id: 'icons',
    label: 'Icons & app',
    help: 'Favicons, home-screen icons and the web app manifest.',
    fields: [
      { key: 'icons.favicon', tab: 'Icons', label: 'favicon.ico', type: 'image', placeholder: '/favicon.ico', image: IMAGES.favicon },
      { key: 'icons.svg', label: 'SVG icon', type: 'image', placeholder: '/icon.svg', image: IMAGES.svg, help: 'Sharp at any size; modern browsers prefer it.' },
      { key: 'icons.appleTouchIcon', label: 'Apple touch icon', type: 'image', placeholder: '/apple-touch-icon.png', image: IMAGES.apple },
      { key: 'icons.icon192', label: 'Android icon', type: 'image', placeholder: '/icon-192.png', image: IMAGES.icon192 },
      { key: 'icons.icon512', label: 'Large icon', type: 'image', placeholder: '/icon-512.png', help: 'Install prompts and splash screens.', image: IMAGES.icon512 },
      { key: 'icons.maskable', label: 'Maskable icon', type: 'image', placeholder: '/icon-maskable.png', help: 'Android crops it to a circle or squircle.', image: IMAGES.maskable },
      { key: 'manifest.enabled', tab: 'App manifest', label: 'Publish site.webmanifest', type: 'boolean' },
      { key: 'manifest.shortName', label: 'Short name', type: 'text' },
      { key: 'manifest.display', label: 'Display', type: 'select', default: 'standalone', options: opts('standalone', 'minimal-ui', 'browser', 'fullscreen') },
      { key: 'manifest.backgroundColor', label: 'Background color', type: 'color' },
    ],
  },
  {
    id: 'verification',
    label: 'Verification',
    help: 'Ownership codes from webmaster tools.',
    fields: [
      { key: 'verification.google', label: 'Google Search Console', type: 'text' },
      { key: 'verification.bing', label: 'Bing Webmaster', type: 'text' },
      { key: 'verification.yandex', label: 'Yandex', type: 'text' },
      { key: 'verification.baidu', label: 'Baidu', type: 'text' },
      { key: 'verification.naver', label: 'Naver', type: 'text' },
      { key: 'verification.pinterest', label: 'Pinterest', type: 'text' },
      { key: 'verification.facebook', label: 'Facebook domain', type: 'text' },
    ],
  },
  {
    id: 'crawlers',
    label: 'Crawlers & AI',
    help: 'robots.txt, crawler policy and AI usage signals.',
    fields: [
      { key: 'robots.indexable', tab: 'Access', label: 'Site can be indexed', type: 'boolean', default: true, help: 'Turn off for staging: noindex everywhere.' },
      { key: 'robots.preset', label: 'Crawler policy', type: 'select', default: 'no-training', options: Object.entries(PRESETS).map(([value, p]) => ({ value, label: p.label })) },
      { key: 'robots.disallow', label: 'Blocked paths', type: 'list', placeholder: '/admin/' },
      { key: 'robots.rules', label: 'Custom rules', type: 'robotsRules' },
      { key: 'robots.defaults.maxSnippet', tab: 'Snippets', label: 'Max snippet', type: 'number', placeholder: '-1', help: '-1 = no limit, 0 = no snippet.' },
      { key: 'robots.defaults.maxImagePreview', label: 'Image preview', type: 'select', options: opts('large', 'standard', 'none') },
      { key: 'robots.contentSignals.search', tab: 'AI signals', label: 'Search', type: 'boolean', tristate: true },
      { key: 'robots.contentSignals.aiInput', label: 'AI answers', type: 'boolean', tristate: true },
      { key: 'robots.contentSignals.aiTrain', label: 'AI training', type: 'boolean', tristate: true, help: 'Content-Signal line in robots.txt; unset says nothing.' },
      { key: 'robots.contentUsage', label: 'Content-Usage (IETF AIPREF)', type: 'text', placeholder: 'train-ai=n' },
    ],
  },
  {
    id: 'files',
    label: 'Sitemap & llms.txt',
    help: 'Generated discovery files.',
    fields: [
      { key: 'sitemap.enabled', tab: 'Sitemap', label: 'Publish sitemap', type: 'boolean', default: true },
      { key: 'sitemap.images', label: 'Include images', type: 'boolean', default: true },
      { key: 'sitemap.lastmod', label: 'Last modified from git', type: 'boolean', default: true },
      { key: 'sitemap.exclude', label: 'Exclude paths', type: 'list', placeholder: '/drafts/**' },
      { key: 'llms.enabled', tab: 'llms.txt', label: 'Publish llms.txt', type: 'boolean', default: true },
      { key: 'llms.full', label: 'Publish llms-full.txt', type: 'boolean' },
      { key: 'llms.markdownPages', label: 'Publish .md copies of pages', type: 'boolean', default: true },
      { key: 'llms.summary', label: 'Summary', type: 'textarea', help: 'One or two sentences; the blockquote under the title.', chars: [50, 300] },
      { key: 'llms.details', label: 'Details', type: 'textarea' },
      { key: 'llms.sections', label: 'Extra sections', type: 'llmsSections' },
      { key: 'indexNow.enabled', tab: 'IndexNow', label: 'IndexNow (Bing, Yandex)', type: 'boolean' },
      { key: 'indexNow.key', label: 'Key', type: 'text' },
      { key: 'ads.adsTxt', tab: 'Ads', label: 'ads.txt lines', type: 'list' },
      { key: 'ads.appAdsTxt', label: 'app-ads.txt lines', type: 'list' },
    ],
  },
  {
    id: 'languages',
    label: 'Languages',
    help: 'Locales, hreflang and the default language.',
    fields: [
      { key: 'languages.locales', label: 'Locales', type: 'locales' },
      { key: 'languages.defaultLocale', label: 'Default locale', type: 'text', format: 'lang' },
      { key: 'languages.xDefault', label: 'x-default locale', type: 'text', format: 'lang' },
    ],
  },
  { id: 'feeds', label: 'Feeds', help: 'RSS, Atom and JSON feeds.', fields: [{ key: 'feeds', label: 'Feeds', type: 'feeds' }] },
  { id: 'redirects', label: 'Redirects', help: 'Old URLs and where they go.', fields: [{ key: 'redirects', label: 'Redirects', type: 'redirects' }] },
  {
    id: 'tags',
    label: 'Tags & consent',
    help: 'Analytics and marketing tags, and the cookie banner.',
    fields: [
      { key: 'tags', tab: 'Tags', label: 'Tags', type: 'tags', help: `Presets: ${TAG_PRESETS.map((p) => p.label).join(', ')}.` },
      { key: 'consent.enabled', tab: 'Consent', label: 'Cookie consent', type: 'boolean' },
      { key: 'consent.googleConsentMode', label: 'Google Consent Mode v2', type: 'boolean', default: true },
      { key: 'consent.respectGpc', label: 'Honor Global Privacy Control', type: 'boolean', default: true },
      { key: 'consent.googleMode', label: 'Google tags before consent', type: 'select', default: 'advanced', options: [{ value: 'advanced', label: 'Load, cookieless pings (advanced)' }, { value: 'basic', label: 'Wait for consent (basic)' }] },
      { key: 'consent.regions', label: 'Consent regions', type: 'list', placeholder: 'GB, DE, FR…', help: 'Empty = ask everywhere.' },
      { key: 'consent.version', label: 'Policy version', type: 'text', help: 'Change it to ask everyone again.' },
      { key: 'consent.expiryDays', label: 'Remember for (days)', type: 'number', placeholder: '180' },
      { key: 'consent.position', tab: 'Banner', label: 'Position', type: 'select', default: 'bottom', options: opts('bottom', 'bottom-left', 'bottom-right') },
      { key: 'consent.text.title', label: 'Title', type: 'text' },
      { key: 'consent.text.message', label: 'Text', type: 'textarea' },
      { key: 'consent.policyUrl', label: 'Policy link', type: 'url', format: 'url' },
    ],
  },
  {
    id: 'security',
    label: 'Security & legal',
    help: 'security.txt, response headers and legal pages.',
    fields: [
      { key: 'security.txt.contact', tab: 'security.txt', label: 'Contacts', type: 'list', placeholder: 'security@example.com' },
      { key: 'security.txt.expires', label: 'Expires', type: 'date', help: 'Required; defaults to a year from each build.' },
      { key: 'security.txt.policy', label: 'Disclosure policy', type: 'url', format: 'url' },
      { key: 'security.headers.enabled', tab: 'Headers', label: 'Security headers (_headers)', type: 'boolean' },
      { key: 'security.headers.hsts', label: 'HSTS', type: 'boolean' },
      { key: 'security.headers.referrerPolicy', label: 'Referrer-Policy', type: 'text', placeholder: 'strict-origin-when-cross-origin' },
      { key: 'security.headers.csp', label: 'Content-Security-Policy', type: 'textarea' },
      { key: 'legal.privacy', tab: 'Legal pages', label: 'Privacy policy', type: 'url', format: 'url' },
      { key: 'legal.terms', label: 'Terms', type: 'url', format: 'url' },
      { key: 'legal.cookies', label: 'Cookie policy', type: 'url', format: 'url' },
      { key: 'legal.imprint', label: 'Imprint', type: 'url', format: 'url' },
    ],
  },
  {
    id: 'advanced',
    label: 'Advanced',
    help: 'Resource hints and custom JSON-LD.',
    fields: [
      { key: 'hints.preconnect', label: 'Preconnect', type: 'list', placeholder: 'https://fonts.gstatic.com' },
      { key: 'hints.dnsPrefetch', label: 'DNS prefetch', type: 'list' },
      { key: 'schema.extra', label: 'Site-wide JSON-LD nodes', type: 'json' },
    ],
  },
];

export function getPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((v, k) => (v && typeof v === 'object' ? (v as Record<string, unknown>)[k] : undefined), obj);
}

/** Immutable set; empty strings / empty arrays / undefined remove the key and prune empty parents. */
export function setPath<T>(obj: T, path: string, value: unknown): T {
  const [head, ...rest] = path.split('.');
  const src = (obj && typeof obj === 'object' ? obj : {}) as Record<string, unknown>;
  const out: Record<string, unknown> = { ...src };
  const next = rest.length ? setPath(src[head], rest.join('.'), value) : value;
  const empty = next === undefined || next === '' || (Array.isArray(next) && !next.length) || (next && typeof next === 'object' && !Array.isArray(next) && !Object.keys(next).length);
  if (empty) delete out[head];
  else out[head] = next;
  return out as T;
}
