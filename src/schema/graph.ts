// One JSON-LD @graph per page: WebSite, Organization, the WebPage, its main entity, breadcrumbs, FAQ, extras.
// Nodes are linked by @id (site#website, site#organization, page#webpage, page#primary, page#breadcrumb).
import type { ResolvedPage } from '../shared/resolve';
import type { Entity, Json, JsonLdNode, PageSettings, Person, SiteSettings } from '../shared/types';
import { absolute, humanize, isRecord, merge, nonEmpty, wordCount } from '../shared/util';
import { ENUMS, NESTED, schemaType } from './types';

export type GraphInput = {
  site: SiteSettings;
  page?: PageSettings;
  resolved: ResolvedPage;
  /** Visible text of the page, for wordCount. */
  text?: string;
};

export type Graph = { '@context': 'https://schema.org'; '@graph': JsonLdNode[] };

const ORG_FULL_PAGES = new Set(['AboutPage', 'ContactPage']);

export const ids = (r: ResolvedPage) => {
  const root = r.siteUrl ? `${r.siteUrl}/` : '';
  const url = r.url || root;
  return {
    website: `${root}#website`,
    organization: `${root}#organization`,
    webpage: `${url}#webpage`,
    primary: `${url}#primary`,
    breadcrumb: `${url}#breadcrumb`,
    faq: `${url}#faq`,
    author: `${url}#author`,
  };
};

/** The site organization, with this page's location fields laid over it (this page only). */
function organizationFor(site: SiteSettings, page: PageSettings): SiteSettings {
  if (!page.organization) return site;
  return { ...site, organization: merge(site.organization ?? {}, page.organization) };
}

export function buildGraph({ site, page = {}, resolved: r, text }: GraphInput): Graph {
  const id = ids(r);
  const t = schemaType(page.schema?.type) ?? schemaType('WebPage')!;
  const pageType = t.kind === 'page' ? t.type : t.pageType ?? 'WebPage';
  // A branch page always gets the full organization node, so its address and hours are in the graph.
  const org = organization(organizationFor(site, page), r, r.isHome || ORG_FULL_PAGES.has(pageType) || !!page.organization);
  const graph: JsonLdNode[] = [website(site, r, org !== null), ...(org ? [org] : [])];

  const author = r.author?.name ? person(r.author, absolute(r.author.url, r.siteUrl) ? undefined : id.author, r.siteUrl) : undefined;
  const image = r.og.image ? { '@type': 'ImageObject', url: r.og.image.url, ...(r.og.image.width ? { width: r.og.image.width, height: r.og.image.height } : {}) } : undefined;
  const crumbs = breadcrumbs(page, r);
  const faq = (page.aeo?.faq ?? []).filter((f) => f.question?.trim() && f.answer?.trim());

  const webpage: JsonLdNode = clean({
    '@type': pageType,
    '@id': id.webpage,
    url: r.url || undefined,
    name: r.pageTitle,
    description: r.description || undefined,
    isPartOf: { '@id': id.website },
    inLanguage: r.lang,
    datePublished: r.datePublished,
    dateModified: r.dateModified,
    primaryImageOfPage: image,
    breadcrumb: crumbs ? { '@id': id.breadcrumb } : undefined,
    about: entities(page.aeo?.about),
    mentions: entities(page.aeo?.mentions),
    abstract: page.aeo?.summary?.trim() || undefined,
    citation: page.aeo?.citations?.length ? page.aeo.citations : undefined,
    speakable: page.schema?.speakable?.length ? { '@type': 'SpeakableSpecification', cssSelector: page.schema.speakable } : undefined,
    ...(org ? (pageType === 'AboutPage' || pageType === 'ContactPage' ? { mainEntity: { '@id': id.organization } } : {}) : {}),
  });
  graph.push(webpage);

  if (pageType === 'FAQPage' && faq.length) webpage.mainEntity = faq.map(question);
  else if (faq.length) graph.push({ '@type': 'FAQPage', '@id': id.faq, isPartOf: { '@id': id.webpage }, mainEntity: faq.map(question) });

  if (t.kind === 'page' && t.type === 'ProfilePage') {
    const main = expand(page.schema?.data ?? {}, '').mainEntity;
    if (isRecord(main) && main.name) webpage.mainEntity = clean({ '@type': 'Person', ...main });
    else if (author) webpage.mainEntity = author;
  }

  if (t.kind === 'entity') {
    const entity = primaryEntity(t.type, page, r, { id, org: org ? id.organization : undefined, author, image, text });
    graph.push(entity);
    webpage.mainEntity = { '@id': id.primary };
  } else if (author && !webpage.mainEntity) {
    webpage.author = author;
  }

  if (crumbs) graph.push(crumbs);
  for (const node of [...(site.schema?.extra ?? []), ...(page.schema?.extra ?? [])]) if (isRecord(node) && node['@type']) graph.push(node);
  return { '@context': 'https://schema.org', '@graph': graph };
}

function website(site: SiteSettings, r: ResolvedPage, hasOrg: boolean): JsonLdNode {
  const id = ids(r);
  const base = { '@type': 'WebSite', '@id': id.website, url: r.siteUrl ? `${r.siteUrl}/` : undefined, name: r.siteName || undefined };
  // Site-name signals (name, alternateName) belong on the home page; elsewhere a light reference is enough.
  if (!r.isHome) return clean(base);
  return clean({
    ...base,
    alternateName: site.identity?.alternateName?.length ? site.identity.alternateName : undefined,
    description: site.identity?.description,
    inLanguage: r.lang,
    publisher: hasOrg ? { '@id': id.organization } : undefined,
  });
}

function organization(site: SiteSettings, r: ResolvedPage, full: boolean): JsonLdNode | null {
  const o = site.organization ?? {};
  const name = o.name || r.siteName;
  if (!name) return null;
  const logo = absolute(o.logo ?? site.icons?.icon512, r.siteUrl);
  const light = { '@type': o.type || 'Organization', '@id': ids(r).organization, name, url: r.siteUrl ? `${r.siteUrl}/` : undefined, logo: logo ? { '@type': 'ImageObject', url: logo, contentUrl: logo } : undefined };
  if (!full) return clean(light);
  const address = clean({ '@type': 'PostalAddress', ...(o.address ?? {}) });
  return clean({
    ...light,
    alternateName: o.alternateName,
    legalName: o.legalName,
    description: o.description ?? site.identity?.description,
    image: absolute(o.image, r.siteUrl),
    email: o.email,
    telephone: o.telephone,
    address: Object.keys(address).length > 1 ? address : undefined,
    geo: o.geo?.latitude !== undefined && o.geo.longitude !== undefined ? { '@type': 'GeoCoordinates', latitude: o.geo.latitude, longitude: o.geo.longitude } : undefined,
    openingHours: o.openingHours?.length ? o.openingHours : undefined,
    priceRange: o.priceRange,
    areaServed: o.areaServed?.length ? o.areaServed : undefined,
    foundingDate: o.foundingDate,
    numberOfEmployees: o.numberOfEmployees ? { '@type': 'QuantitativeValue', value: o.numberOfEmployees } : undefined,
    founder: o.founders?.length ? o.founders.map((n) => ({ '@type': 'Person', name: n })) : undefined,
    contactPoint: o.contactPoints?.length ? o.contactPoints.map((c) => clean({ '@type': 'ContactPoint', ...c })) : undefined,
    sameAs: site.social?.profiles?.length ? site.social.profiles : undefined,
    ...(o.identifiers ?? {}),
  });
}

function person(p: Person, id: string | undefined, siteUrl: string): JsonLdNode {
  return clean({
    '@type': 'Person',
    '@id': id,
    name: p.name,
    url: absolute(p.url, siteUrl),
    jobTitle: p.jobTitle,
    description: p.description,
    image: absolute(p.image, siteUrl),
    sameAs: p.sameAs?.length ? p.sameAs : undefined,
    knowsAbout: p.knowsAbout?.length ? p.knowsAbout : undefined,
  });
}

const question = (f: { question: string; answer: string }) => ({ '@type': 'Question', name: f.question.trim(), acceptedAnswer: { '@type': 'Answer', text: f.answer.trim() } });

function entities(list: Entity[] | undefined) {
  const out = (list ?? []).filter((e) => e.name?.trim()).map((e) => clean({ '@type': e.type || 'Thing', name: e.name.trim(), sameAs: e.sameAs || undefined }));
  return out.length ? out : undefined;
}

function breadcrumbs(page: PageSettings, r: ResolvedPage): JsonLdNode | null {
  const setting = page.schema?.breadcrumbs;
  if (setting === false || (r.isHome && !Array.isArray(setting))) return null;
  let items: { name: string; url: string }[];
  if (Array.isArray(setting)) {
    items = setting.map((c) => ({ name: c.name, url: absolute(c.url, r.siteUrl) ?? c.url }));
  } else {
    if (!r.siteUrl) return null;
    const parts = r.path.split('/').filter(Boolean);
    const slash = r.path.endsWith('/') ? '/' : '';
    items = [{ name: 'Home', url: `${r.siteUrl}/` }];
    parts.forEach((part, i) => {
      const last = i === parts.length - 1;
      items.push({ name: last ? r.pageTitle : humanize(part), url: last ? r.url : `${r.siteUrl}/${parts.slice(0, i + 1).join('/')}${slash}` });
    });
  }
  if (items.length < 2) return null;
  return {
    '@type': 'BreadcrumbList',
    '@id': ids(r).breadcrumb,
    itemListElement: items.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: c.url })),
  };
}

type Ctx = { id: ReturnType<typeof ids>; org?: string; author?: JsonLdNode; image?: object; text?: string };

function primaryEntity(type: string, page: PageSettings, r: ResolvedPage, ctx: Ctx): JsonLdNode {
  const data = expand(page.schema?.data ?? {}, '');
  const node: JsonLdNode = { '@type': type, '@id': ctx.id.primary, ...data };
  const orgRef = ctx.org ? { '@id': ctx.org } : undefined;
  const img = r.og.image?.url;
  const fill = (key: string, value: unknown) => {
    if (node[key] === undefined || node[key] === '' || (isRecord(node[key]) && !Object.keys(node[key] as object).some((k) => k !== '@type'))) {
      if (value !== undefined && value !== '') node[key] = value;
    }
  };
  const dates = () => {
    fill('datePublished', r.datePublished);
    fill('dateModified', r.dateModified);
  };

  switch (type) {
    case 'Article':
    case 'BlogPosting':
    case 'NewsArticle':
      fill('headline', r.pageTitle.slice(0, 110));
      fill('description', r.description);
      fill('image', img ? [img] : undefined);
      fill('author', ctx.author ?? orgRef);
      fill('publisher', orgRef);
      fill('mainEntityOfPage', { '@id': ctx.id.webpage });
      fill('inLanguage', r.lang);
      fill('wordCount', ctx.text ? wordCount(ctx.text) : undefined);
      dates();
      break;
    case 'Product':
      fill('name', r.pageTitle);
      fill('description', r.description);
      fill('image', img ? [img] : undefined);
      if (isRecord(node.offers)) fill2(node.offers, 'url', r.url);
      break;
    case 'Service':
      fill('name', r.pageTitle);
      fill('description', r.description);
      fill('provider', orgRef);
      fill('url', r.url);
      fill('image', img);
      break;
    case 'LocalBusiness':
      fill('name', r.pageTitle);
      fill('url', r.url);
      fill('image', img);
      fill('parentOrganization', orgRef);
      break;
    case 'Event':
      fill('name', r.pageTitle);
      fill('description', r.description);
      fill('image', img ? [img] : undefined);
      fill('url', r.url);
      fill('organizer', orgRef);
      if (isRecord(node.offers)) fill2(node.offers, 'url', r.url);
      break;
    case 'Course':
      fill('name', r.pageTitle);
      fill('description', r.description);
      fill('provider', orgRef);
      if (isRecord(node.hasCourseInstance) && !node.hasCourseInstance.courseMode) delete node.hasCourseInstance;
      break;
    case 'JobPosting':
      fill('title', r.pageTitle);
      fill('description', r.description);
      fill('hiringOrganization', orgRef);
      fill('datePosted', r.datePublished);
      fill('url', r.url);
      break;
    case 'Recipe':
      fill('name', r.pageTitle);
      fill('description', r.description);
      fill('image', img ? [img] : undefined);
      fill('author', ctx.author ?? orgRef);
      if (Array.isArray(node.recipeInstructions)) node.recipeInstructions = node.recipeInstructions.map((s) => ({ '@type': 'HowToStep', text: s }));
      dates();
      break;
    case 'SoftwareApplication':
      fill('name', r.pageTitle);
      fill('description', r.description);
      fill('image', img);
      fill('url', r.url);
      break;
    case 'VideoObject':
      fill('name', r.pageTitle);
      fill('description', r.description);
      fill('thumbnailUrl', img ? [img] : undefined);
      fill('uploadDate', r.datePublished);
      break;
    case 'HowTo':
      fill('name', r.pageTitle);
      fill('description', r.description);
      fill('image', img);
      if (Array.isArray(node.step)) node.step = node.step.map((s, i) => ({ '@type': 'HowToStep', position: i + 1, text: s }));
      break;
  }
  return clean(node);
}

function fill2(obj: Record<string, unknown>, key: string, value: unknown) {
  if (obj[key] === undefined && value) obj[key] = value;
}

/** {"offers.price": 10, "offers.priceCurrency": "INR"} → { offers: { "@type": "Offer", price: 10, … } }, enums → schema URLs. */
export function expand(data: Record<string, Json>, prefix: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(data)) {
    if (raw === '' || raw === null || (Array.isArray(raw) && !raw.length)) continue;
    const parts = key.split('.');
    let node = out;
    let path = prefix;
    for (let i = 0; i < parts.length - 1; i++) {
      path = path ? `${path}.${parts[i]}` : parts[i];
      const nested = NESTED[path] ?? NESTED[parts[i]];
      node[parts[i]] ??= nested ? { '@type': nested } : {};
      node = node[parts[i]] as Record<string, unknown>;
    }
    const leaf = parts[parts.length - 1];
    node[leaf] = typeof raw === 'string' && ENUMS[leaf] && raw && !raw.startsWith('http') ? `${ENUMS[leaf]}${raw}` : Array.isArray(raw) ? nonEmpty(raw as string[]) : raw;
  }
  return out;
}

/** Drops undefined/empty values (recursively for plain objects). */
function clean<T extends Record<string, unknown>>(obj: T): T & JsonLdNode {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === '') continue;
    if (isRecord(v) && !('@id' in v && Object.keys(v).length === 1)) {
      const c = clean(v);
      if (Object.keys(c).some((key) => key !== '@type')) out[k] = c;
      continue;
    }
    out[k] = v;
  }
  return out as T & JsonLdNode;
}

export type SchemaIssue = { level: 'error' | 'warning'; field: string; message: string };

/** Google's required/recommended properties for the page's chosen type, checked on the built node. */
export function checkSchema(graph: Graph, page: PageSettings = {}): SchemaIssue[] {
  const t = schemaType(page.schema?.type);
  if (!t || !t.fields.length) return [];
  const node = t.kind === 'entity' ? graph['@graph'].find((n) => typeof n['@id'] === 'string' && n['@id'].endsWith('#primary')) : graph['@graph'].find((n) => typeof n['@id'] === 'string' && n['@id'].endsWith('#webpage'));
  if (!node) return [];
  const issues: SchemaIssue[] = [];
  for (const f of t.fields) {
    if (!f.required && !f.recommended) continue;
    if (t.type === 'JobPosting' && f.key.startsWith('jobLocation') && get(node, 'jobLocationType') === 'TELECOMMUTE') continue;
    const v = get(node, f.key);
    const empty = v === undefined || v === '' || (Array.isArray(v) && !v.length);
    if (empty) issues.push({ level: f.required ? 'error' : 'warning', field: f.key, message: `${t.label}: ${f.label} is ${f.required ? 'required' : 'recommended'}` });
  }
  if ((t.type === 'Product' || t.type === 'SoftwareApplication') && !get(node, 'offers.price') && !get(node, 'aggregateRating.ratingValue') && !get(node, 'review')) {
    issues.push({ level: 'error', field: 'offers.price', message: `${t.label}: needs a price, a rating or a review` });
  }
  return dedupe(issues);
}

const dedupe = (issues: SchemaIssue[]) => issues.filter((i, n) => issues.findIndex((j) => j.field === i.field) === n);

function get(node: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((v, k) => (isRecord(v) ? v[k] : undefined), node);
}
