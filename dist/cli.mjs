#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
// src/shared/html.ts
const VOID = /* @__PURE__ */ new Set([
	"area",
	"base",
	"br",
	"col",
	"embed",
	"hr",
	"img",
	"input",
	"link",
	"meta",
	"source",
	"track",
	"wbr"
]);
const RAW = /* @__PURE__ */ new Set([
	"script",
	"style",
	"textarea",
	"title"
]);
const TAG = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<![^>]*>|<\/([a-zA-Z][\w:-]*)\s*>|<([a-zA-Z][\w:-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*(\/?)>/g;
const ATTR = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
function parseAttrs(src) {
	const out = {};
	for (const m of src.matchAll(ATTR)) out[m[1].toLowerCase()] = decode(m[2] ?? m[3] ?? m[4] ?? "");
	return out;
}
function* tokens(html, from = 0, to = html.length) {
	TAG.lastIndex = from;
	let pos = from;
	for (let m = TAG.exec(html); m && m.index < to; m = TAG.exec(html)) {
		if (m.index > pos) yield {
			type: "text",
			text: html.slice(pos, m.index),
			start: pos,
			end: m.index
		};
		pos = TAG.lastIndex;
		if (m[1]) yield {
			type: "close",
			name: m[1].toLowerCase(),
			start: m.index,
			end: pos
		};
		else if (m[2]) {
			const name = m[2].toLowerCase();
			yield {
				type: "open",
				name,
				attrs: parseAttrs(m[3] ?? ""),
				start: m.index,
				end: pos,
				selfClosing: !!m[4] || VOID.has(name)
			};
			if (RAW.has(name) && !m[4]) {
				const close = html.toLowerCase().indexOf(`</${name}`, pos);
				const stop = close === -1 ? html.length : close;
				if (stop > pos) yield {
					type: "text",
					text: html.slice(pos, stop),
					start: pos,
					end: stop
				};
				pos = stop;
				TAG.lastIndex = stop;
			}
		} else yield {
			type: "comment",
			start: m.index,
			end: pos
		};
	}
	if (pos < to) yield {
		type: "text",
		text: html.slice(pos, to),
		start: pos,
		end: to
	};
}
const NAMED = {
	amp: "&",
	lt: "<",
	gt: ">",
	quot: "\"",
	apos: "'",
	nbsp: "\xA0",
	mdash: "—",
	ndash: "–",
	hellip: "…",
	rsquo: "’",
	lsquo: "‘",
	ldquo: "“",
	rdquo: "”",
	copy: "©",
	reg: "®",
	trade: "™",
	middot: "·",
	times: "×",
	euro: "€",
	pound: "£",
	rarr: "→",
	larr: "←",
	bull: "•",
	deg: "°"
};
const decode = (s) => s.includes("&") ? s.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (all, e) => {
	if (e[0] === "#") {
		const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
		return Number.isFinite(code) ? String.fromCodePoint(code) : all;
	}
	return NAMED[e.toLowerCase()] ?? all;
}) : s;
/** Closing one of these implicitly closes open children (unclosed <p>, <li>…). */
function tree(html, from = 0, to = html.length) {
	const root = {
		name: "#root",
		attrs: {},
		children: []
	};
	const stack = [root];
	for (const t of tokens(html, from, to)) {
		const top = stack[stack.length - 1];
		if (t.type === "text") top.children.push(decode(t.text));
		else if (t.type === "open") {
			if ((t.name === "li" || t.name === "p") && top.name === t.name) stack.pop();
			const node = {
				name: t.name,
				attrs: t.attrs,
				children: []
			};
			stack[stack.length - 1].children.push(node);
			if (!t.selfClosing) stack.push(node);
		} else if (t.type === "close") {
			const at = stack.map((n) => n.name).lastIndexOf(t.name);
			if (at > 0) stack.length = at;
		}
	}
	return root;
}
function find(node, test) {
	for (const c of node.children) {
		if (typeof c === "string") continue;
		if (test(c)) return c;
		const hit = find(c, test);
		if (hit) return hit;
	}
}
function findAll(node, test, out = []) {
	for (const c of node.children) {
		if (typeof c === "string") continue;
		if (test(c)) out.push(c);
		findAll(c, test, out);
	}
	return out;
}
const INVISIBLE = /* @__PURE__ */ new Set([
	"script",
	"style",
	"noscript",
	"template",
	"svg",
	"head"
]);
function textOf(node) {
	if (typeof node === "string") return node;
	if (INVISIBLE.has(node.name) || "hidden" in node.attrs || node.attrs["aria-hidden"] === "true") return "";
	const inner = node.children.map(textOf).join("");
	return /^(p|div|section|article|li|h[1-6]|br|tr|td|th|header|footer|main|nav|aside|blockquote|figcaption)$/.test(node.name) ? ` ${inner} ` : inner;
}
/** Start/end offsets of the element's inner HTML (first match of `name`). */
function innerRange(html, name) {
	let open = -1;
	let depth = 0;
	for (const t of tokens(html)) if (t.type === "open" && t.name === name && !t.selfClosing) {
		if (open === -1) open = t.end;
		depth++;
	} else if (t.type === "close" && t.name === name && open !== -1 && --depth === 0) return [open, t.start];
	return null;
}
// src/shared/util.ts
const isAbsolute = (url) => /^[a-z][a-z\d+.-]*:/i.test(url) || url.startsWith("//");
/** "https://x.com/" → "https://x.com" */
const origin = (url) => url ? url.trim().replace(/\/+$/, "") : "";
function absolute(url, base) {
	const u = url?.trim();
	if (!u) return void 0;
	if (isAbsolute(u)) return u.startsWith("//") ? `https:${u}` : u;
	if (!base) return void 0;
	return `${origin(base)}${u.startsWith("/") ? "" : "/"}${u}`;
}
/** Applies the trailing-slash policy to a path (files like /a.xml are left alone). */
function normalizePath(path, policy = "ignore") {
	let p = path.split(/[?#]/)[0] || "/";
	if (!p.startsWith("/")) p = `/${p}`;
	p = p.replace(/\/{2,}/g, "/");
	if (p === "/" || policy === "ignore" || /\.[a-z0-9]+$/i.test(p)) return p;
	return policy === "always" ? p.replace(/\/?$/, "/") : p.replace(/\/+$/, "");
}
/** Site-wide settings, relative to the project root. */
const SITE_FILE = "src/site.u1wc.json";
/** Normalized page path, the key for one URL's settings: "/" or "/a/b" (no trailing slash, query or index). */
function pageKey(path) {
	const clean = path.split(/[?#]/)[0].replace(/\.html$/, "").replace(/\/index$/, "").replace(/\/+$/, "");
	return clean.startsWith("/") ? clean || "/" : `/${clean}`;
}
/** Error pages and similar never go into sitemaps, feeds, llms.txt or share cards. */
const isUtilityPath = (path) => /^\/(?:404|500|_[^/]*)(?:\/|\.html)?$/.test(path) || /\/(?:404|500)\/?$/.test(path);
/** Where a page's generated share card is served: "/" → /og/index.png, "/a/b" → /og/a/b.png */
const cardPath = (path) => `/og${pageKey(path) === "/" ? "/index" : pageKey(path)}.png`;
const collapse = (s) => s.replace(/\s+/g, " ").trim();
const nonEmpty = (list) => (list ?? []).filter(Boolean);
const isRecord = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
/** Deep merge for plain objects; arrays and scalars from `b` replace `a`. undefined in `b` keeps `a`. */
function merge(a, b) {
	if (!isRecord(a) || !isRecord(b)) return b === void 0 ? a : b;
	const out = { ...a };
	for (const [k, v] of Object.entries(b)) out[k] = v === void 0 ? out[k] : merge(out[k], v);
	return out;
}
/** "about-us" → "About us" */
const humanize = (slug) => {
	const s = decodeURIComponent(slug).replace(/[-_]+/g, " ").trim();
	return s.charAt(0).toUpperCase() + s.slice(1);
};
const wordCount = (s) => (s.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length;
// src/checker/analyze.ts
function detect(html) {
	const head = innerRange(html, "head");
	const out = {};
	for (const t of tokens(html, 0, head?.[1] ?? Math.min(html.length, 2e5))) {
		if (t.type === "open" && t.name === "html" && t.attrs.lang) out.lang = t.attrs.lang;
		if (t.type !== "open") continue;
		const a = t.attrs;
		if (t.name === "title") {
			const close = html.toLowerCase().indexOf("</title", t.end);
			out.title ??= collapse(textOf(tree(html, t.end, close === -1 ? t.end : close)));
		} else if (t.name === "meta") {
			const key = (a.name ?? a.property ?? "").toLowerCase();
			if (key === "description") out.description ??= a.content;
			if (key === "og:image") out.ogImage ??= a.content;
			if (key === "theme-color") out.themeColor ??= a.content;
		} else if (t.name === "link") {
			const rel = (a.rel ?? "").toLowerCase();
			if (rel === "canonical") out.canonical ??= a.href;
			if (/\bicon\b/.test(rel) && !out.favicon) out.favicon = a.href;
		}
	}
	return out;
}
function analyze(html) {
	const doc = tree(html);
	const main = find(doc, (n) => n.name === "main") ?? find(doc, (n) => n.name === "body") ?? doc;
	const all = find(doc, (n) => n.name === "body") ?? doc;
	const text = collapse(textOf(main));
	const headings = findAll(all, (n) => /^h[1-6]$/.test(n.name)).map((n) => ({
		level: Number(n.name[1]),
		text: collapse(textOf(n))
	}));
	const metas = findAll(doc, (n) => n.name === "meta");
	const jsonLd = [];
	for (const s of findAll(doc, (n) => n.name === "script" && (n.attrs.type ?? "").toLowerCase() === "application/ld+json")) try {
		jsonLd.push(JSON.parse(s.children.join("")));
	} catch {
		jsonLd.push({ invalid: true });
	}
	return {
		h1: headings.filter((h) => h.level === 1).map((h) => h.text),
		headings,
		images: findAll(all, (n) => n.name === "img").map((n) => ({
			src: n.attrs.src ?? "",
			alt: "alt" in n.attrs ? n.attrs.alt : null
		})),
		links: findAll(all, (n) => n.name === "a" && !!n.attrs.href).map((n) => ({
			href: n.attrs.href,
			text: collapse(textOf(n))
		})),
		words: wordCount(text),
		intro: text.slice(0, 600),
		text,
		hasViewport: metas.some((m) => m.attrs.name === "viewport"),
		hasCharset: metas.some((m) => "charset" in m.attrs) || /<meta[^>]+charset/i.test(html.slice(0, 2048)),
		jsonLd,
		nosnippet: findAll(all, (n) => "data-nosnippet" in n.attrs).length
	};
}
// src/schema/types.ts
/** Nested object types for dotted paths. */
const NESTED = {
	offers: "Offer",
	brand: "Brand",
	aggregateRating: "AggregateRating",
	location: "Place",
	"location.address": "PostalAddress",
	organizer: "Organization",
	performer: "Person",
	baseSalary: "MonetaryAmount",
	"baseSalary.value": "QuantitativeValue",
	jobLocation: "Place",
	"jobLocation.address": "PostalAddress",
	applicantLocationRequirements: "Country",
	nutrition: "NutritionInformation",
	hasCourseInstance: "CourseInstance",
	mainEntity: "Person",
	address: "PostalAddress",
	geo: "GeoCoordinates",
	provider: "Organization",
	recipient: "Organization"
};
/** Enum-valued properties written as schema.org URLs. */
const ENUMS = {
	availability: "https://schema.org/",
	itemCondition: "https://schema.org/",
	eventStatus: "https://schema.org/",
	eventAttendanceMode: "https://schema.org/"
};
const name = {
	key: "name",
	label: "Name",
	type: "text",
	required: true,
	auto: "Page title"
};
const description = {
	key: "description",
	label: "Description",
	type: "textarea",
	recommended: true,
	auto: "Page description"
};
const image = {
	key: "image",
	label: "Image",
	type: "image",
	recommended: true,
	auto: "Share image"
};
const price = (required = false) => [{
	key: "offers.price",
	label: "Price",
	type: "number",
	required,
	placeholder: "0 for free"
}, {
	key: "offers.priceCurrency",
	label: "Currency",
	type: "text",
	required,
	placeholder: "INR, USD, EUR…"
}];
const address = (required = false) => [
	{
		key: "address.streetAddress",
		label: "Street",
		type: "text",
		required
	},
	{
		key: "address.addressLocality",
		label: "City",
		type: "text",
		required
	},
	{
		key: "address.addressRegion",
		label: "Region / state",
		type: "text"
	},
	{
		key: "address.postalCode",
		label: "Postal code",
		type: "text"
	},
	{
		key: "address.addressCountry",
		label: "Country (ISO code)",
		type: "text",
		placeholder: "IN"
	}
];
const rating = [{
	key: "aggregateRating.ratingValue",
	label: "Rating",
	type: "number",
	placeholder: "4.8"
}, {
	key: "aggregateRating.reviewCount",
	label: "Review count",
	type: "number"
}];
const page = (type, label, note, rich = "no") => ({
	type,
	label,
	group: "Page",
	kind: "page",
	rich,
	note,
	fields: []
});
const SCHEMA_TYPES = [
	page("WebPage", "Web page"),
	page("AboutPage", "About page", "Also gets the full Organization node."),
	page("ContactPage", "Contact page", "Also gets the full Organization node with contact details."),
	page("CollectionPage", "Collection / listing"),
	page("ItemPage", "Item page"),
	page("SearchResultsPage", "Search results"),
	{ ...page("FAQPage", "FAQ page", "Google stopped FAQ rich results in May 2026. Still read by Bing and AI assistants. Add questions under Answers.", "retired") },
	{
		type: "ProfilePage",
		label: "Profile page",
		group: "Page",
		kind: "page",
		rich: "yes",
		note: "A page about one person (team member, author).",
		fields: [
			{
				key: "mainEntity.name",
				label: "Person name",
				type: "text",
				required: true
			},
			{
				key: "mainEntity.jobTitle",
				label: "Job title",
				type: "text"
			},
			{
				key: "mainEntity.description",
				label: "Bio",
				type: "textarea"
			},
			{
				key: "mainEntity.image",
				label: "Photo",
				type: "image"
			},
			{
				key: "mainEntity.sameAs",
				label: "Profiles (LinkedIn, X…)",
				type: "list"
			},
			{
				key: "mainEntity.knowsAbout",
				label: "Expertise",
				type: "list"
			}
		]
	},
	...[
		"Article",
		"BlogPosting",
		"NewsArticle"
	].map((type) => ({
		type,
		label: type === "Article" ? "Article" : type === "BlogPosting" ? "Blog post" : "News article",
		group: "Content",
		kind: "entity",
		rich: "yes",
		note: "Author and dates come from Answers → Author / Published.",
		fields: [
			{
				key: "headline",
				label: "Headline",
				type: "text",
				recommended: true,
				auto: "Page title",
				help: "Up to 110 characters."
			},
			description,
			image,
			{
				key: "articleSection",
				label: "Section",
				type: "text"
			},
			{
				key: "keywords",
				label: "Keywords",
				type: "list"
			},
			{
				key: "wordCount",
				label: "Word count",
				type: "number",
				auto: "Counted from the page"
			}
		]
	})),
	{
		type: "Product",
		label: "Product",
		group: "Commerce",
		kind: "entity",
		pageType: "ItemPage",
		rich: "yes",
		note: "Needs a price, a rating or a review for the product snippet; price + currency + availability for merchant listings.",
		fields: [
			name,
			description,
			image,
			{
				key: "brand.name",
				label: "Brand",
				type: "text",
				recommended: true
			},
			{
				key: "sku",
				label: "SKU",
				type: "text"
			},
			{
				key: "gtin",
				label: "GTIN / EAN / UPC",
				type: "text"
			},
			{
				key: "mpn",
				label: "MPN",
				type: "text"
			},
			...price(true),
			{
				key: "offers.availability",
				label: "Availability",
				type: "select",
				options: [
					"InStock",
					"OutOfStock",
					"PreOrder",
					"BackOrder",
					"LimitedAvailability",
					"OnlineOnly",
					"InStoreOnly",
					"SoldOut",
					"Discontinued"
				],
				recommended: true
			},
			{
				key: "offers.itemCondition",
				label: "Condition",
				type: "select",
				options: [
					"NewCondition",
					"UsedCondition",
					"RefurbishedCondition",
					"DamagedCondition"
				]
			},
			{
				key: "offers.priceValidUntil",
				label: "Price valid until",
				type: "date"
			},
			...rating
		]
	},
	{
		type: "Service",
		label: "Service",
		group: "Business",
		kind: "entity",
		rich: "no",
		note: "No rich result, but helps engines and AI understand what you offer.",
		fields: [
			name,
			description,
			{
				key: "serviceType",
				label: "Service type",
				type: "text"
			},
			{
				key: "areaServed",
				label: "Area served",
				type: "list"
			},
			...price(),
			image
		]
	},
	{
		type: "LocalBusiness",
		label: "Local business (location page)",
		group: "Business",
		kind: "entity",
		rich: "yes",
		note: "For a branch/location page. The site-wide business goes in Site settings → Organization.",
		fields: [
			name,
			{
				key: "address.streetAddress",
				label: "Street",
				type: "text",
				required: true
			},
			{
				key: "address.addressLocality",
				label: "City",
				type: "text",
				required: true
			},
			{
				key: "address.addressRegion",
				label: "Region / state",
				type: "text"
			},
			{
				key: "address.postalCode",
				label: "Postal code",
				type: "text"
			},
			{
				key: "address.addressCountry",
				label: "Country (ISO code)",
				type: "text",
				placeholder: "IN"
			},
			{
				key: "telephone",
				label: "Phone",
				type: "text",
				recommended: true
			},
			{
				key: "geo.latitude",
				label: "Latitude",
				type: "number",
				recommended: true
			},
			{
				key: "geo.longitude",
				label: "Longitude",
				type: "number",
				recommended: true
			},
			{
				key: "openingHours",
				label: "Opening hours",
				type: "list",
				placeholder: "Mo-Fr 09:00-18:00",
				recommended: true
			},
			{
				key: "priceRange",
				label: "Price range",
				type: "text",
				placeholder: "₹₹"
			},
			image
		]
	},
	{
		type: "Event",
		label: "Event",
		group: "Content",
		kind: "entity",
		rich: "yes",
		fields: [
			name,
			{
				key: "startDate",
				label: "Start",
				type: "datetime",
				required: true
			},
			{
				key: "endDate",
				label: "End",
				type: "datetime",
				recommended: true
			},
			{
				key: "eventAttendanceMode",
				label: "Attendance",
				type: "select",
				options: [
					"OfflineEventAttendanceMode",
					"OnlineEventAttendanceMode",
					"MixedEventAttendanceMode"
				]
			},
			{
				key: "eventStatus",
				label: "Status",
				type: "select",
				options: [
					"EventScheduled",
					"EventPostponed",
					"EventRescheduled",
					"EventMovedOnline",
					"EventCancelled"
				]
			},
			{
				key: "location.name",
				label: "Venue",
				type: "text",
				required: true
			},
			{
				key: "location.address.streetAddress",
				label: "Venue street",
				type: "text"
			},
			{
				key: "location.address.addressLocality",
				label: "Venue city",
				type: "text"
			},
			{
				key: "location.address.addressCountry",
				label: "Venue country",
				type: "text"
			},
			{
				key: "organizer.name",
				label: "Organizer",
				type: "text",
				auto: "Organization"
			},
			{
				key: "performer.name",
				label: "Performer",
				type: "text"
			},
			...price(),
			{
				key: "offers.availability",
				label: "Ticket availability",
				type: "select",
				options: [
					"InStock",
					"SoldOut",
					"PreOrder"
				]
			},
			{
				key: "offers.url",
				label: "Ticket URL",
				type: "url"
			},
			description,
			image
		]
	},
	{
		type: "Course",
		label: "Course",
		group: "Content",
		kind: "entity",
		rich: "yes",
		note: "Shown in course lists (needs 3+ courses marked up across the site).",
		fields: [
			name,
			{
				...description,
				required: true
			},
			{
				key: "provider.name",
				label: "Provider",
				type: "text",
				auto: "Organization"
			},
			...price(),
			{
				key: "offers.category",
				label: "Pricing",
				type: "select",
				options: [
					"Free",
					"Paid",
					"Subscription",
					"Partially Free"
				]
			},
			{
				key: "hasCourseInstance.courseMode",
				label: "Mode",
				type: "select",
				options: [
					"Online",
					"Onsite",
					"Blended"
				]
			},
			{
				key: "hasCourseInstance.courseWorkload",
				label: "Workload",
				type: "duration",
				placeholder: "PT22H"
			}
		]
	},
	{
		type: "JobPosting",
		label: "Job posting",
		group: "Business",
		kind: "entity",
		rich: "yes",
		fields: [
			{
				key: "title",
				label: "Job title",
				type: "text",
				required: true,
				auto: "Page title"
			},
			{
				...description,
				required: true
			},
			{
				key: "datePosted",
				label: "Posted",
				type: "date",
				required: true
			},
			{
				key: "validThrough",
				label: "Apply before",
				type: "datetime",
				recommended: true
			},
			{
				key: "employmentType",
				label: "Employment type",
				type: "select",
				options: [
					"FULL_TIME",
					"PART_TIME",
					"CONTRACTOR",
					"TEMPORARY",
					"INTERN",
					"VOLUNTEER",
					"PER_DIEM",
					"OTHER"
				],
				recommended: true
			},
			{
				key: "jobLocationType",
				label: "Remote",
				type: "select",
				options: ["", "TELECOMMUTE"]
			},
			{
				key: "jobLocation.address.addressLocality",
				label: "City",
				type: "text",
				required: true
			},
			{
				key: "jobLocation.address.addressRegion",
				label: "Region",
				type: "text"
			},
			{
				key: "jobLocation.address.addressCountry",
				label: "Country",
				type: "text"
			},
			{
				key: "applicantLocationRequirements.name",
				label: "Remote: allowed country",
				type: "text"
			},
			{
				key: "baseSalary.currency",
				label: "Salary currency",
				type: "text",
				recommended: true
			},
			{
				key: "baseSalary.value.value",
				label: "Salary",
				type: "number",
				recommended: true
			},
			{
				key: "baseSalary.value.unitText",
				label: "Salary per",
				type: "select",
				options: [
					"HOUR",
					"DAY",
					"WEEK",
					"MONTH",
					"YEAR"
				]
			}
		]
	},
	{
		type: "Recipe",
		label: "Recipe",
		group: "Content",
		kind: "entity",
		rich: "yes",
		fields: [
			name,
			{
				...image,
				required: true
			},
			description,
			{
				key: "recipeIngredient",
				label: "Ingredients",
				type: "list",
				recommended: true
			},
			{
				key: "recipeInstructions",
				label: "Steps",
				type: "list",
				recommended: true
			},
			{
				key: "prepTime",
				label: "Prep time",
				type: "duration",
				placeholder: "PT15M",
				recommended: true
			},
			{
				key: "cookTime",
				label: "Cook time",
				type: "duration",
				placeholder: "PT1H",
				recommended: true
			},
			{
				key: "totalTime",
				label: "Total time",
				type: "duration",
				recommended: true
			},
			{
				key: "recipeYield",
				label: "Yield",
				type: "text",
				placeholder: "4 servings",
				recommended: true
			},
			{
				key: "recipeCategory",
				label: "Category",
				type: "text"
			},
			{
				key: "recipeCuisine",
				label: "Cuisine",
				type: "text"
			},
			{
				key: "nutrition.calories",
				label: "Calories",
				type: "text",
				placeholder: "270 calories"
			},
			{
				key: "keywords",
				label: "Keywords",
				type: "list"
			},
			...rating
		]
	},
	{
		type: "SoftwareApplication",
		label: "Software / app",
		group: "Commerce",
		kind: "entity",
		rich: "yes",
		note: "Needs a rating (or review) and a price (0 if free).",
		fields: [
			name,
			description,
			{
				key: "applicationCategory",
				label: "Category",
				type: "select",
				options: [
					"BusinessApplication",
					"DeveloperApplication",
					"DesignApplication",
					"EducationalApplication",
					"FinanceApplication",
					"GameApplication",
					"HealthApplication",
					"LifestyleApplication",
					"MultimediaApplication",
					"ProductivityApplication",
					"SocialNetworkingApplication",
					"TravelApplication",
					"UtilitiesApplication"
				],
				recommended: true
			},
			{
				key: "operatingSystem",
				label: "Operating system",
				type: "text",
				placeholder: "Web, iOS, Android",
				recommended: true
			},
			...price(true),
			...rating.map((f) => ({
				...f,
				required: true
			})),
			image
		]
	},
	{
		type: "VideoObject",
		label: "Video",
		group: "Media",
		kind: "entity",
		rich: "yes",
		fields: [
			name,
			{
				...description,
				recommended: true
			},
			{
				key: "thumbnailUrl",
				label: "Thumbnail",
				type: "image",
				required: true,
				auto: "Share image"
			},
			{
				key: "uploadDate",
				label: "Upload date",
				type: "datetime",
				required: true,
				auto: "Published date"
			},
			{
				key: "duration",
				label: "Duration",
				type: "duration",
				placeholder: "PT2M30S",
				recommended: true
			},
			{
				key: "contentUrl",
				label: "Video file URL",
				type: "url",
				recommended: true
			},
			{
				key: "embedUrl",
				label: "Embed URL",
				type: "url",
				recommended: true
			}
		]
	},
	{
		type: "HowTo",
		label: "How-to",
		group: "Content",
		kind: "entity",
		rich: "retired",
		note: "No longer a Google rich result. Still useful for AI answers.",
		fields: [
			name,
			description,
			{
				key: "step",
				label: "Steps",
				type: "list",
				required: true
			},
			{
				key: "totalTime",
				label: "Total time",
				type: "duration"
			},
			image
		]
	},
	{
		type: "NGO",
		label: "Non-profit / NGO",
		group: "Business",
		kind: "entity",
		rich: "no",
		note: "A charity or non-profit. Google has no NGO rich result; it feeds knowledge panels and AI answers. Pair with Donate on donation pages.",
		fields: [
			name,
			description,
			{
				key: "url",
				label: "Website",
				type: "url"
			},
			{
				key: "logo",
				label: "Logo",
				type: "image",
				recommended: true
			},
			{
				key: "taxID",
				label: "Charity / registration number",
				type: "text",
				recommended: true
			},
			{
				key: "foundingDate",
				label: "Founded",
				type: "date"
			},
			{
				key: "sameAs",
				label: "Profile links (one per line)",
				type: "list",
				recommended: true,
				placeholder: "https://www.wikidata.org/…"
			},
			...address()
		]
	},
	{
		type: "DonateAction",
		label: "Donate (donation page)",
		group: "Commerce",
		kind: "entity",
		rich: "no",
		note: "Where and how to give. Use on a donation or appeal page.",
		fields: [
			name,
			{
				key: "target",
				label: "Donation URL",
				type: "url",
				required: true
			},
			{
				key: "recipient.name",
				label: "Recipient (charity name)",
				type: "text",
				required: true
			},
			{
				key: "price",
				label: "Suggested amount",
				type: "number"
			},
			{
				key: "priceCurrency",
				label: "Currency",
				type: "text",
				placeholder: "INR, USD, EUR…"
			}
		]
	},
	{
		type: "Restaurant",
		label: "Restaurant",
		group: "Business",
		kind: "entity",
		rich: "yes",
		note: "A restaurant location. Google uses LocalBusiness rules for it: hours, address and phone matter most.",
		fields: [
			name,
			description,
			image,
			...address(true),
			{
				key: "telephone",
				label: "Phone",
				type: "text",
				recommended: true
			},
			{
				key: "servesCuisine",
				label: "Cuisine",
				type: "text",
				placeholder: "Italian, South Indian…"
			},
			{
				key: "priceRange",
				label: "Price range",
				type: "text",
				placeholder: "$$"
			},
			{
				key: "menu",
				label: "Menu URL",
				type: "url"
			},
			{
				key: "openingHours",
				label: "Opening hours (one per line)",
				type: "list",
				recommended: true,
				placeholder: "Mo-Fr 09:00-22:00"
			}
		]
	},
	{
		type: "RealEstateListing",
		label: "Property listing",
		group: "Commerce",
		kind: "entity",
		rich: "no",
		note: "A property for sale or rent. Read by AI assistants and property portals; no Google rich result.",
		fields: [
			name,
			description,
			image,
			{
				key: "url",
				label: "Listing URL",
				type: "url"
			},
			{
				key: "datePosted",
				label: "Listed on",
				type: "date"
			},
			...price(true),
			...address(true),
			{
				key: "numberOfBedrooms",
				label: "Bedrooms",
				type: "number"
			},
			{
				key: "numberOfBathroomsTotal",
				label: "Bathrooms",
				type: "number"
			}
		]
	},
	{
		type: "GovernmentService",
		label: "Public service",
		group: "Business",
		kind: "entity",
		rich: "no",
		note: "A service run by a government body: permits, registrations, benefits.",
		fields: [
			name,
			description,
			{
				key: "url",
				label: "Service URL",
				type: "url"
			},
			{
				key: "provider.name",
				label: "Government body",
				type: "text",
				required: true
			},
			{
				key: "serviceType",
				label: "Service type",
				type: "text",
				placeholder: "Passport renewal"
			},
			{
				key: "areaServed",
				label: "Area served",
				type: "text",
				placeholder: "Karnataka"
			},
			{
				key: "audience",
				label: "Who it is for",
				type: "text"
			}
		]
	}
];
const schemaType = (type) => SCHEMA_TYPES.find((t) => t.type === type);
// src/schema/graph.ts
const ORG_FULL_PAGES = /* @__PURE__ */ new Set(["AboutPage", "ContactPage"]);
const ids = (r) => {
	const root = r.siteUrl ? `${r.siteUrl}/` : "";
	const url = r.url || root;
	return {
		website: `${root}#website`,
		organization: `${root}#organization`,
		webpage: `${url}#webpage`,
		primary: `${url}#primary`,
		breadcrumb: `${url}#breadcrumb`,
		faq: `${url}#faq`,
		author: `${url}#author`
	};
};
/** The site organization, with this page's location fields laid over it (this page only). */
function organizationFor(site, page) {
	if (!page.organization) return site;
	return {
		...site,
		organization: merge(site.organization ?? {}, page.organization)
	};
}
function buildGraph({ site, page = {}, resolved: r, text }) {
	const id = ids(r);
	const t = schemaType(page.schema?.type) ?? schemaType("WebPage");
	const pageType = t.kind === "page" ? t.type : t.pageType ?? "WebPage";
	const org = organization(organizationFor(site, page), r, r.isHome || ORG_FULL_PAGES.has(pageType) || !!page.organization);
	const graph = [website(site, r, org !== null), ...org ? [org] : []];
	const author = r.author?.name ? person(r.author, absolute(r.author.url, r.siteUrl) ? void 0 : id.author, r.siteUrl) : void 0;
	const image = r.og.image ? {
		"@type": "ImageObject",
		url: r.og.image.url,
		...r.og.image.width ? {
			width: r.og.image.width,
			height: r.og.image.height
		} : {}
	} : void 0;
	const crumbs = breadcrumbs(page, r);
	const faq = (page.aeo?.faq ?? []).filter((f) => f.question?.trim() && f.answer?.trim());
	const webpage = clean$1({
		"@type": pageType,
		"@id": id.webpage,
		url: r.url || void 0,
		name: r.pageTitle,
		description: r.description || void 0,
		isPartOf: { "@id": id.website },
		inLanguage: r.lang,
		datePublished: r.datePublished,
		dateModified: r.dateModified,
		primaryImageOfPage: image,
		breadcrumb: crumbs ? { "@id": id.breadcrumb } : void 0,
		about: entities(page.aeo?.about),
		mentions: entities(page.aeo?.mentions),
		abstract: page.aeo?.summary?.trim() || void 0,
		citation: page.aeo?.citations?.length ? page.aeo.citations : void 0,
		speakable: page.schema?.speakable?.length ? {
			"@type": "SpeakableSpecification",
			cssSelector: page.schema.speakable
		} : void 0,
		...org ? pageType === "AboutPage" || pageType === "ContactPage" ? { mainEntity: { "@id": id.organization } } : {} : {}
	});
	graph.push(webpage);
	if (pageType === "FAQPage" && faq.length) webpage.mainEntity = faq.map(question);
	else if (faq.length) graph.push({
		"@type": "FAQPage",
		"@id": id.faq,
		isPartOf: { "@id": id.webpage },
		mainEntity: faq.map(question)
	});
	if (t.kind === "page" && t.type === "ProfilePage") {
		const main = expand(page.schema?.data ?? {}, "").mainEntity;
		if (isRecord(main) && main.name) webpage.mainEntity = clean$1({
			"@type": "Person",
			...main
		});
		else if (author) webpage.mainEntity = author;
	}
	if (t.kind === "entity") {
		const entity = primaryEntity(t.type, page, r, {
			id,
			org: org ? id.organization : void 0,
			author,
			image,
			text
		});
		graph.push(entity);
		webpage.mainEntity = { "@id": id.primary };
	} else if (author && !webpage.mainEntity) webpage.author = author;
	if (crumbs) graph.push(crumbs);
	for (const node of [...site.schema?.extra ?? [], ...page.schema?.extra ?? []]) if (isRecord(node) && node["@type"]) graph.push(node);
	return {
		"@context": "https://schema.org",
		"@graph": graph
	};
}
function website(site, r, hasOrg) {
	const id = ids(r);
	const base = {
		"@type": "WebSite",
		"@id": id.website,
		url: r.siteUrl ? `${r.siteUrl}/` : void 0,
		name: r.siteName || void 0
	};
	if (!r.isHome) return clean$1(base);
	return clean$1({
		...base,
		alternateName: site.identity?.alternateName?.length ? site.identity.alternateName : void 0,
		description: site.identity?.description,
		inLanguage: r.lang,
		publisher: hasOrg ? { "@id": id.organization } : void 0
	});
}
function organization(site, r, full) {
	const o = site.organization ?? {};
	const name = o.name || r.siteName;
	if (!name) return null;
	const logo = absolute(o.logo ?? site.icons?.icon512, r.siteUrl);
	const light = {
		"@type": o.type || "Organization",
		"@id": ids(r).organization,
		name,
		url: r.siteUrl ? `${r.siteUrl}/` : void 0,
		logo: logo ? {
			"@type": "ImageObject",
			url: logo,
			contentUrl: logo
		} : void 0
	};
	if (!full) return clean$1(light);
	const address = clean$1({
		"@type": "PostalAddress",
		...o.address ?? {}
	});
	return clean$1({
		...light,
		alternateName: o.alternateName,
		legalName: o.legalName,
		description: o.description ?? site.identity?.description,
		image: absolute(o.image, r.siteUrl),
		email: o.email,
		telephone: o.telephone,
		address: Object.keys(address).length > 1 ? address : void 0,
		geo: o.geo?.latitude !== void 0 && o.geo.longitude !== void 0 ? {
			"@type": "GeoCoordinates",
			latitude: o.geo.latitude,
			longitude: o.geo.longitude
		} : void 0,
		openingHours: o.openingHours?.length ? o.openingHours : void 0,
		priceRange: o.priceRange,
		areaServed: o.areaServed?.length ? o.areaServed : void 0,
		foundingDate: o.foundingDate,
		numberOfEmployees: o.numberOfEmployees ? {
			"@type": "QuantitativeValue",
			value: o.numberOfEmployees
		} : void 0,
		founder: o.founders?.length ? o.founders.map((n) => ({
			"@type": "Person",
			name: n
		})) : void 0,
		contactPoint: o.contactPoints?.length ? o.contactPoints.map((c) => clean$1({
			"@type": "ContactPoint",
			...c
		})) : void 0,
		sameAs: site.social?.profiles?.length ? site.social.profiles : void 0,
		...o.identifiers ?? {}
	});
}
function person(p, id, siteUrl) {
	return clean$1({
		"@type": "Person",
		"@id": id,
		name: p.name,
		url: absolute(p.url, siteUrl),
		jobTitle: p.jobTitle,
		description: p.description,
		image: absolute(p.image, siteUrl),
		sameAs: p.sameAs?.length ? p.sameAs : void 0,
		knowsAbout: p.knowsAbout?.length ? p.knowsAbout : void 0
	});
}
const question = (f) => ({
	"@type": "Question",
	name: f.question.trim(),
	acceptedAnswer: {
		"@type": "Answer",
		text: f.answer.trim()
	}
});
function entities(list) {
	const out = (list ?? []).filter((e) => e.name?.trim()).map((e) => clean$1({
		"@type": e.type || "Thing",
		name: e.name.trim(),
		sameAs: e.sameAs || void 0
	}));
	return out.length ? out : void 0;
}
function breadcrumbs(page, r) {
	const setting = page.schema?.breadcrumbs;
	if (setting === false || r.isHome && !Array.isArray(setting)) return null;
	let items;
	if (Array.isArray(setting)) items = setting.map((c) => ({
		name: c.name,
		url: absolute(c.url, r.siteUrl) ?? c.url
	}));
	else {
		if (!r.siteUrl) return null;
		const parts = r.path.split("/").filter(Boolean);
		const slash = r.path.endsWith("/") ? "/" : "";
		items = [{
			name: "Home",
			url: `${r.siteUrl}/`
		}];
		parts.forEach((part, i) => {
			const last = i === parts.length - 1;
			items.push({
				name: last ? r.pageTitle : humanize(part),
				url: last ? r.url : `${r.siteUrl}/${parts.slice(0, i + 1).join("/")}${slash}`
			});
		});
	}
	if (items.length < 2) return null;
	return {
		"@type": "BreadcrumbList",
		"@id": ids(r).breadcrumb,
		itemListElement: items.map((c, i) => ({
			"@type": "ListItem",
			position: i + 1,
			name: c.name,
			item: c.url
		}))
	};
}
function primaryEntity(type, page, r, ctx) {
	const data = expand(page.schema?.data ?? {}, "");
	const node = {
		"@type": type,
		"@id": ctx.id.primary,
		...data
	};
	const orgRef = ctx.org ? { "@id": ctx.org } : void 0;
	const img = r.og.image?.url;
	const fill = (key, value) => {
		if (node[key] === void 0 || node[key] === "" || isRecord(node[key]) && !Object.keys(node[key]).some((k) => k !== "@type")) {
			if (value !== void 0 && value !== "") node[key] = value;
		}
	};
	const dates = () => {
		fill("datePublished", r.datePublished);
		fill("dateModified", r.dateModified);
	};
	switch (type) {
		case "Article":
		case "BlogPosting":
		case "NewsArticle":
			fill("headline", r.pageTitle.slice(0, 110));
			fill("description", r.description);
			fill("image", img ? [img] : void 0);
			fill("author", ctx.author ?? orgRef);
			fill("publisher", orgRef);
			fill("mainEntityOfPage", { "@id": ctx.id.webpage });
			fill("inLanguage", r.lang);
			fill("wordCount", ctx.text ? wordCount(ctx.text) : void 0);
			dates();
			break;
		case "Product":
			fill("name", r.pageTitle);
			fill("description", r.description);
			fill("image", img ? [img] : void 0);
			if (isRecord(node.offers)) fill2(node.offers, "url", r.url);
			break;
		case "Service":
			fill("name", r.pageTitle);
			fill("description", r.description);
			fill("provider", orgRef);
			fill("url", r.url);
			fill("image", img);
			break;
		case "LocalBusiness":
			fill("name", r.pageTitle);
			fill("url", r.url);
			fill("image", img);
			fill("parentOrganization", orgRef);
			break;
		case "Event":
			fill("name", r.pageTitle);
			fill("description", r.description);
			fill("image", img ? [img] : void 0);
			fill("url", r.url);
			fill("organizer", orgRef);
			if (isRecord(node.offers)) fill2(node.offers, "url", r.url);
			break;
		case "Course":
			fill("name", r.pageTitle);
			fill("description", r.description);
			fill("provider", orgRef);
			if (isRecord(node.hasCourseInstance) && !node.hasCourseInstance.courseMode) delete node.hasCourseInstance;
			break;
		case "JobPosting":
			fill("title", r.pageTitle);
			fill("description", r.description);
			fill("hiringOrganization", orgRef);
			fill("datePosted", r.datePublished);
			fill("url", r.url);
			break;
		case "Recipe":
			fill("name", r.pageTitle);
			fill("description", r.description);
			fill("image", img ? [img] : void 0);
			fill("author", ctx.author ?? orgRef);
			if (Array.isArray(node.recipeInstructions)) node.recipeInstructions = node.recipeInstructions.map((s) => ({
				"@type": "HowToStep",
				text: s
			}));
			dates();
			break;
		case "SoftwareApplication":
			fill("name", r.pageTitle);
			fill("description", r.description);
			fill("image", img);
			fill("url", r.url);
			break;
		case "VideoObject":
			fill("name", r.pageTitle);
			fill("description", r.description);
			fill("thumbnailUrl", img ? [img] : void 0);
			fill("uploadDate", r.datePublished);
			break;
		case "HowTo":
			fill("name", r.pageTitle);
			fill("description", r.description);
			fill("image", img);
			if (Array.isArray(node.step)) node.step = node.step.map((s, i) => ({
				"@type": "HowToStep",
				position: i + 1,
				text: s
			}));
	}
	return clean$1(node);
}
function fill2(obj, key, value) {
	if (obj[key] === void 0 && value) obj[key] = value;
}
/** {"offers.price": 10, "offers.priceCurrency": "INR"} → { offers: { "@type": "Offer", price: 10, … } }, enums → schema URLs. */
function expand(data, prefix) {
	const out = {};
	for (const [key, raw] of Object.entries(data)) {
		if (raw === "" || raw === null || Array.isArray(raw) && !raw.length) continue;
		const parts = key.split(".");
		let node = out;
		let path = prefix;
		for (let i = 0; i < parts.length - 1; i++) {
			path = path ? `${path}.${parts[i]}` : parts[i];
			const nested = NESTED[path] ?? NESTED[parts[i]];
			node[parts[i]] ??= nested ? { "@type": nested } : {};
			node = node[parts[i]];
		}
		const leaf = parts[parts.length - 1];
		node[leaf] = typeof raw === "string" && ENUMS[leaf] && raw && !raw.startsWith("http") ? `${ENUMS[leaf]}${raw}` : Array.isArray(raw) ? nonEmpty(raw) : raw;
	}
	return out;
}
/** Drops undefined/empty values (recursively for plain objects). */
function clean$1(obj) {
	const out = {};
	for (const [k, v] of Object.entries(obj)) {
		if (v === void 0 || v === null || v === "") continue;
		if (isRecord(v) && !("@id" in v && Object.keys(v).length === 1)) {
			const c = clean$1(v);
			if (Object.keys(c).some((key) => key !== "@type")) out[k] = c;
			continue;
		}
		out[k] = v;
	}
	return out;
}
/** Google's required/recommended properties for the page's chosen type, checked on the built node. */
function checkSchema(graph, page = {}) {
	const t = schemaType(page.schema?.type);
	if (!t || !t.fields.length) return [];
	const node = t.kind === "entity" ? graph["@graph"].find((n) => typeof n["@id"] === "string" && n["@id"].endsWith("#primary")) : graph["@graph"].find((n) => typeof n["@id"] === "string" && n["@id"].endsWith("#webpage"));
	if (!node) return [];
	const issues = [];
	for (const f of t.fields) {
		if (!f.required && !f.recommended) continue;
		if (t.type === "JobPosting" && f.key.startsWith("jobLocation") && get(node, "jobLocationType") === "TELECOMMUTE") continue;
		const v = get(node, f.key);
		if (v === void 0 || v === "" || Array.isArray(v) && !v.length) issues.push({
			level: f.required ? "error" : "warning",
			field: f.key,
			message: `${t.label}: ${f.label} is ${f.required ? "required" : "recommended"}`
		});
	}
	if ((t.type === "Product" || t.type === "SoftwareApplication") && !get(node, "offers.price") && !get(node, "aggregateRating.ratingValue") && !get(node, "review")) issues.push({
		level: "error",
		field: "offers.price",
		message: `${t.label}: needs a price, a rating or a review`
	});
	return dedupe$1(issues);
}
const dedupe$1 = (issues) => issues.filter((i, n) => issues.findIndex((j) => j.field === i.field) === n);
function get(node, path) {
	return path.split(".").reduce((v, k) => isRecord(v) ? v[k] : void 0, node);
}
// src/edge/redirects.ts
const clean = (p) => p.trim().replace(/\s+/g, "");
function checkRedirects(rules = []) {
	const issues = [];
	const map = /* @__PURE__ */ new Map();
	for (const r of rules) {
		const from = clean(r.from);
		const to = clean(r.to);
		if (!from || !to) {
			issues.push({
				level: "error",
				from,
				message: "Redirect needs both a source and a destination."
			});
			continue;
		}
		if (!from.startsWith("/")) issues.push({
			level: "error",
			from,
			message: "Source must be a path starting with \"/\"."
		});
		if (from === to) {
			issues.push({
				level: "error",
				from,
				message: "Redirects to itself."
			});
			continue;
		}
		if (map.has(from)) issues.push({
			level: "warning",
			from,
			message: "Duplicate source; the last rule wins."
		});
		map.set(from, {
			from,
			to,
			status: r.status ?? 301
		});
	}
	const out = [];
	for (const r of map.values()) {
		const seen = /* @__PURE__ */ new Set([r.from]);
		let to = r.to;
		let hops = 0;
		while (map.has(to) && !seen.has(to)) {
			seen.add(to);
			to = map.get(to).to;
			hops++;
		}
		if (seen.has(to)) {
			issues.push({
				level: "error",
				from: r.from,
				message: `Redirect loop: ${[...seen].join(" → ")} → ${to}`
			});
			continue;
		}
		if (hops) issues.push({
			level: "warning",
			from: r.from,
			message: `Chain of ${hops + 1} hops, flattened to ${r.from} → ${to}.`
		});
		out.push({
			...r,
			to
		});
	}
	return {
		rules: out,
		issues
	};
}
// src/shared/i18n.ts
/** A locale's URL prefix without a trailing slash: "/fr", or "" for an unprefixed default. */
const prefixOf = (l) => (l.prefix ?? `/${l.code}`).replace(/\/+$/, "");
/** The locale a path belongs to: the longest matching prefix, else the unprefixed one. */
function localeOf(path, langs) {
	const all = langs?.locales ?? [];
	return all.filter((l) => prefixOf(l) && (path === prefixOf(l) || path.startsWith(`${prefixOf(l)}/`))).sort((a, b) => prefixOf(b).length - prefixOf(a).length)[0] ?? all.find((l) => !prefixOf(l));
}
/** The same page in another locale: `/fr/pricing/` → `/de/pricing/`. */
function localizedPath(path, from, to) {
	const rest = from && prefixOf(from) ? path.slice(prefixOf(from).length) : path;
	return `${prefixOf(to)}${rest.startsWith("/") ? rest : `/${rest}`}` || "/";
}
/**
* hreflang alternates for a page: every locale's version of it, plus x-default (`xDefault`, else the default locale).
* Empty unless the site has two or more locales and the path is in one of them.
*/
function alternatePaths(path, langs) {
	const all = langs?.locales ?? [];
	const here = localeOf(path, langs);
	if (all.length < 2 || !here) return [];
	const out = all.map((l) => ({
		hreflang: l.code,
		path: localizedPath(path, here, l),
		ogLocale: ogLocaleOf(l)
	}));
	const x = all.find((l) => l.code === (langs?.xDefault || langs?.defaultLocale)) ?? all[0];
	out.push({
		hreflang: "x-default",
		path: localizedPath(path, here, x)
	});
	return out;
}
/** Open Graph form of a locale: "en_GB", or the language alone ("fr"). */
const ogLocaleOf = (l) => l.ogLocale ?? l.code.replace("-", "_");
// src/shared/resolve.ts
const DEFAULT_ROBOTS = {
	index: true,
	follow: true,
	maxImagePreview: "large"
};
/** Directive list for the robots meta tag. Defaults are written out so the intent is explicit. */
function robotsContent(d) {
	const out = [d.index === false ? "noindex" : "index", d.follow === false ? "nofollow" : "follow"];
	if (d.nosnippet) out.push("nosnippet");
	if (d.maxSnippet !== void 0 && !d.nosnippet) out.push(`max-snippet:${d.maxSnippet}`);
	if (d.maxImagePreview) out.push(`max-image-preview:${d.maxImagePreview}`);
	if (d.maxVideoPreview !== void 0) out.push(`max-video-preview:${d.maxVideoPreview}`);
	if (d.noimageindex) out.push("noimageindex");
	if (d.notranslate) out.push("notranslate");
	if (d.indexifembedded && d.index === false) out.push("indexifembedded");
	if (d.unavailableAfter) out.push(`unavailable_after:${d.unavailableAfter}`);
	if (d.noarchive) out.push("noarchive");
	return out.join(", ");
}
function applyTemplate(title, template, siteName) {
	if (!template || !template.includes("%s")) return title;
	if (!title || title === siteName) return siteName || title;
	return template.replace("%s", title).replace(/\{name\}/g, siteName);
}
function resolvePage({ site, page = {}, path: rawPath, detected = {}, siteUrl: fallbackUrl, lastmod }) {
	const id = site.identity ?? {};
	const siteUrl = origin(id.url || fallbackUrl || (detected.canonical && /^https?:/.test(detected.canonical) ? new URL(detected.canonical).origin : ""));
	const path = normalizePath(rawPath, id.trailingSlash ?? "ignore");
	const isHome = path === "/" || path === "";
	const siteName = id.name || "";
	const loc = localeOf(path, site.languages);
	const lang = loc?.code ?? id.language ?? detected.lang ?? "en";
	const og = loc ? loc.ogLocale ?? (loc.code === id.language ? id.ogLocale : void 0) ?? ogLocaleOf(loc) : id.ogLocale ?? lang.replace("-", "_");
	const alternates = page.alternates ? Object.entries(page.alternates).map(([hreflang, href]) => ({
		hreflang,
		url: absolute(href, siteUrl) ?? href
	})) : alternatePaths(path, site.languages).map((a) => ({
		hreflang: a.hreflang,
		url: siteUrl ? `${siteUrl}${a.path}` : a.path,
		ogLocale: a.ogLocale
	}));
	const ownTitle = collapse(detected.title ?? "");
	const pageTitle = collapse(page.title ?? "") || stripTemplate(ownTitle, id.titleTemplate, siteName) || siteName;
	const title = page.title?.trim() ? page.absoluteTitle ? page.title.trim() : applyTemplate(page.title.trim(), id.titleTemplate, siteName) : ownTitle || siteName;
	const description = collapse(page.description ?? "") || collapse(detected.description ?? "") || (isHome ? collapse(id.description ?? "") : "") || collapse(id.description ?? "");
	const directives = merge(merge(DEFAULT_ROBOTS, site.robots?.defaults ?? {}), page.robots ?? {});
	if (site.robots?.indexable === false) directives.index = false;
	const url = absolute(page.canonical, siteUrl) ?? (siteUrl ? `${siteUrl}${path}` : detected.canonical ?? "");
	const image = pickImage(page, site, detected, siteUrl, path);
	const twitterImage = page.twitter?.image ? {
		url: absolute(page.twitter.image, siteUrl) ?? page.twitter.image,
		alt: page.twitter.imageAlt ?? image?.alt
	} : image;
	const datePublished = page.aeo?.datePublished;
	const dateModified = page.aeo?.dateModified ?? (datePublished ? lastmod : void 0);
	const ogType = page.og?.type ?? (isHome ? "website" : page.schema?.type && /Article|BlogPosting/.test(page.schema.type) ? "article" : "website");
	const ogTitle = collapse(page.og?.title ?? "") || pageTitle;
	const ogDescription = collapse(page.og?.description ?? "") || description;
	return {
		path,
		url,
		siteUrl,
		siteName,
		isHome,
		lang,
		ogLocale: page.og?.locale || og,
		alternates,
		title,
		pageTitle,
		description,
		keywords: page.keywords ?? [],
		robots: {
			directives,
			content: robotsContent(directives),
			indexable: directives.index !== false
		},
		og: {
			type: ogType,
			title: ogTitle,
			description: ogDescription,
			image,
			video: absolute(page.og?.video, siteUrl) ?? page.og?.video,
			article: ogType === "article" ? {
				publishedTime: datePublished,
				modifiedTime: dateModified,
				author: page.og?.article?.author ?? page.aeo?.author?.url ?? page.aeo?.author?.name,
				section: page.og?.article?.section,
				tags: page.og?.article?.tags ?? []
			} : void 0,
			product: page.og?.product?.price !== void 0 && page.og.product.currency ? {
				price: page.og.product.price,
				currency: page.og.product.currency
			} : void 0,
			appId: site.social?.facebookAppId || void 0,
			fediverseCreator: site.social?.fediverseCreator?.trim() || void 0,
			nopin: page.og?.pinterest === false
		},
		twitter: {
			card: page.twitter?.card ?? (twitterImage ? "summary_large_image" : "summary"),
			title: collapse(page.twitter?.title ?? "") || ogTitle,
			description: collapse(page.twitter?.description ?? "") || ogDescription,
			image: twitterImage,
			site: handle(site.social?.twitterSite),
			creator: handle(page.twitter?.creator) ?? handle(site.social?.twitterCreator),
			labels: [{
				label: page.twitter?.label1 ?? "",
				data: page.twitter?.data1 ?? ""
			}, {
				label: page.twitter?.label2 ?? "",
				data: page.twitter?.data2 ?? ""
			}].filter((l) => l.label.trim() && l.data.trim())
		},
		datePublished,
		dateModified,
		author: page.aeo?.author
	};
}
const handle = (h) => h?.trim() ? `@${h.trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//, "")}` : void 0;
/** Whether `path` gets a generated share card: the site turned them on, the page has no image and didn't opt out. */
const cardEnabled = (site, page, path) => !!site.social?.card?.enabled && page.og?.card !== false && !page.og?.image && !isUtilityPath(path);
function pickImage(page, site, detected, siteUrl, path) {
	if (page.og?.image) return {
		url: absolute(page.og.image, siteUrl) ?? page.og.image,
		alt: page.og.imageAlt,
		width: page.og.imageWidth,
		height: page.og.imageHeight
	};
	if (cardEnabled(site, page, path)) return {
		url: absolute(cardPath(path), siteUrl) ?? cardPath(path),
		width: 1200,
		height: 630
	};
	if (site.social?.image) return {
		url: absolute(site.social.image, siteUrl) ?? site.social.image,
		alt: site.social.imageAlt,
		width: site.social.imageWidth,
		height: site.social.imageHeight
	};
	if (detected.ogImage) return { url: absolute(detected.ogImage, siteUrl) ?? detected.ogImage };
}
/** "About · Acme" with template "%s · Acme" → "About". */
function stripTemplate(title, template, siteName) {
	if (!title || !template?.includes("%s")) return title;
	const [pre, post] = template.replace(/\{name\}/g, siteName).split("%s");
	if (title.startsWith(pre) && title.endsWith(post) && title.length > pre.length + post.length) return title.slice(pre.length, title.length - post.length);
	return title;
}
// src/aeo/markdown.ts
const SKIP = /* @__PURE__ */ new Set([
	"script",
	"style",
	"noscript",
	"template",
	"svg",
	"canvas",
	"iframe",
	"form",
	"button",
	"select",
	"input",
	"textarea",
	"dialog",
	"head"
]);
const CHROME = /* @__PURE__ */ new Set([
	"header",
	"nav",
	"footer",
	"aside"
]);
const FORMAT = /* @__PURE__ */ new Set([
	"strong",
	"b",
	"em",
	"i",
	"code",
	"s",
	"del",
	"sup",
	"sub",
	"small",
	"mark",
	"abbr",
	"br"
]);
function toMarkdown(html, opts = {}) {
	const doc = tree(html);
	const main = find(doc, (n) => n.name === "main" || n.attrs.role === "main");
	let body = block(main ?? find(doc, (n) => n.name === "body") ?? doc, {
		base: opts.base ?? "",
		chrome: !main
	}).replace(/\n{3,}/g, "\n\n").trim();
	if (opts.title && !/^# /m.test(body.split("\n").slice(0, 3).join("\n"))) body = `# ${opts.title}\n\n${body}`;
	if (opts.url) body = `${body}\n\nSource: ${opts.url}`;
	return `${body.trim()}\n`;
}
const hidden = (n) => "hidden" in n.attrs || n.attrs["aria-hidden"] === "true" || "data-u1-skip" in n.attrs || /display\s*:\s*none/.test(n.attrs.style ?? "");
function block(node, ctx) {
	let out = "";
	let line = "";
	const flush = () => {
		const t = collapse(line);
		if (t) out += `${t}\n\n`;
		line = "";
	};
	let prevEl = false;
	for (const c of node.children) {
		if (typeof c === "string") {
			line += c;
			prevEl = false;
			continue;
		}
		if (SKIP.has(c.name) || hidden(c) || ctx.chrome && CHROME.has(c.name)) continue;
		const kind = KIND[c.name];
		if (!kind) {
			if (prevEl && !FORMAT.has(c.name) && line && !/\s$/.test(line)) line += " ";
			line += inline(c, ctx);
			prevEl = !FORMAT.has(c.name);
			continue;
		}
		prevEl = false;
		flush();
		out += kind(c, ctx);
	}
	flush();
	return out;
}
const KIND = {
	...Object.fromEntries([
		1,
		2,
		3,
		4,
		5,
		6
	].map((l) => [`h${l}`, (n, ctx) => {
		const t = collapse(inline(n, ctx));
		return t ? `${"#".repeat(l)} ${t}\n\n` : "";
	}])),
	p: (n, ctx) => para(inline(n, ctx)),
	blockquote: (n, ctx) => {
		const inner = block(n, ctx).trim();
		return inner ? `${inner.split("\n").map((l) => l ? `> ${l}` : ">").join("\n")}\n\n` : "";
	},
	pre: (n) => {
		const code = find(n, (c) => c.name === "code");
		return `\`\`\`${/(?:^|\s)(?:language|lang)-(\S+)/.exec(code?.attrs.class ?? "")?.[1] ?? ""}\n${raw(code ?? n).replace(/^\n+|\s+$/g, "")}\n\`\`\`\n\n`;
	},
	ul: (n, ctx) => list(n, ctx, false),
	ol: (n, ctx) => list(n, ctx, true),
	hr: () => "---\n\n",
	table: (n, ctx) => table(n, ctx),
	figure: (n, ctx) => block(n, ctx),
	figcaption: (n, ctx) => para(`*${collapse(inline(n, ctx))}*`),
	dl: (n, ctx) => {
		let out = "";
		for (const c of n.children) {
			if (typeof c === "string") continue;
			if (c.name === "dt") out += `**${collapse(inline(c, ctx))}**\n`;
			if (c.name === "dd") out += `: ${collapse(inline(c, ctx))}\n\n`;
		}
		return out;
	},
	...Object.fromEntries([
		"div",
		"section",
		"article",
		"main",
		"header",
		"footer",
		"nav",
		"aside",
		"details",
		"summary",
		"address",
		"li",
		"body"
	].map((k) => [k, (n, ctx) => block(n, ctx)]))
};
const para = (s) => {
	const t = s.replace(/[ \t]*\n[ \t]*/g, "  \n").replace(/[ \t]+/g, " ").trim();
	return t ? `${t}\n\n` : "";
};
function list(n, ctx, ordered) {
	const depth = (ctx.list?.depth ?? -1) + 1;
	let i = Number(n.attrs.start) || 1;
	let out = "";
	for (const c of n.children) {
		if (typeof c === "string" || c.name !== "li" || hidden(c)) continue;
		const marker = ordered ? `${i++}.` : "-";
		const [first, ...rest] = block(c, {
			...ctx,
			list: {
				ordered,
				n: i,
				depth
			}
		}).trim().replace(/\n{2,}/g, "\n").split("\n");
		const pad = " ".repeat(marker.length + 1);
		out += `${"  ".repeat(depth)}${marker} ${first ?? ""}\n${rest.map((l) => /^\s*(?:-|\d+\.) /.test(l) ? l : `${"  ".repeat(depth)}${pad}${l}`).join("\n")}${rest.length ? "\n" : ""}`;
	}
	return depth === 0 ? `${out}\n` : out;
}
function table(n, ctx) {
	const rows = [];
	const walk = (x) => {
		for (const c of x.children) {
			if (typeof c === "string") continue;
			if (c.name === "tr") rows.push(c.children.filter((d) => typeof d !== "string" && (d.name === "td" || d.name === "th")).map((d) => collapse(inline(d, ctx)).replace(/\|/g, "\\|")));
			else walk(c);
		}
	};
	walk(n);
	if (!rows.length) return "";
	const width = Math.max(...rows.map((r) => r.length));
	const fill = (r) => `| ${[...r, ...Array(width - r.length).fill("")].join(" | ")} |`;
	return `${[
		fill(rows[0]),
		`|${" --- |".repeat(width)}`,
		...rows.slice(1).map(fill)
	].join("\n")}\n\n`;
}
function inline(node, ctx) {
	if (typeof node === "string") return node.replace(/[ \t\r\n]+/g, " ");
	if (SKIP.has(node.name) || hidden(node)) return "";
	const inner = () => node.children.map((c) => inline(c, ctx)).join("");
	switch (node.name) {
		case "br": return "\n";
		case "strong":
		case "b": return wrap(inner(), "**");
		case "em":
		case "i": return wrap(inner(), "*");
		case "s":
		case "del": return wrap(inner(), "~~");
		case "code": return `\`${raw(node).replace(/`/g, "\\`")}\``;
		case "a": {
			const text = collapse(inner());
			const href = node.attrs.href;
			if (!href || href.startsWith("#") || /^javascript:/i.test(href)) return text;
			const url = absolute(href, ctx.base) ?? href;
			return text ? `[${text}](${url})` : "";
		}
		case "img": {
			const src = node.attrs.src;
			if (!src || src.startsWith("data:")) return "";
			return `![${collapse(node.attrs.alt ?? "")}](${absolute(src, ctx.base) ?? src})`;
		}
		case "picture": return inline(find(node, (c) => c.name === "img") ?? "", ctx);
		default: return KIND[node.name] ? ` ${collapse(block(node, ctx))} ` : inner();
	}
}
const wrap = (s, m) => {
	const t = s.trim();
	if (!t) return s;
	return `${s.match(/^\s*/)?.[0] ? " " : ""}${m}${t}${m}${s.match(/\s*$/)?.[0] ? " " : ""}`;
};
const raw = (n) => typeof n === "string" ? n : n.name === "br" ? "\n" : n.children.map(raw).join("");
// src/shared/pages.ts
function sitePage({ site, page = {}, path, html, siteUrl, lastmod, markdown }) {
	const r = resolvePage({
		site,
		page,
		path,
		detected: html ? detect(html) : {},
		siteUrl,
		lastmod
	});
	const analysis = html ? analyze(html) : void 0;
	const own = r.siteUrl ? `${r.siteUrl}${r.path}` : r.url;
	const images = (analysis?.images ?? []).map((i) => ({
		url: absolute(i.src, r.siteUrl) ?? "",
		title: i.alt || void 0
	})).filter((i) => i.url && !i.url.startsWith("data:") && sameHost(i.url, r.siteUrl));
	return {
		path: r.path,
		url: r.url,
		title: r.title,
		pageTitle: r.pageTitle,
		description: r.description,
		lang: r.lang,
		indexable: r.robots.indexable,
		canonicalSelf: !r.url || stripSlash(r.url) === stripSlash(own),
		lastmod: page.sitemap?.lastmod ?? r.dateModified ?? lastmod,
		datePublished: r.datePublished,
		dateModified: r.dateModified,
		images: dedupe(images),
		settings: page,
		markdown: html && markdown ? toMarkdown(html, {
			base: r.siteUrl,
			title: r.pageTitle,
			url: r.url || void 0
		}) : void 0,
		resolved: r,
		analysis
	};
}
const stripSlash = (u) => u.replace(/\/+$/, "").toLowerCase();
const sameHost = (url, site) => {
	if (!site) return true;
	try {
		return new URL(url).host === new URL(site).host;
	} catch {
		return false;
	}
};
const dedupe = (list) => [...new Map(list.map((i) => [i.url, i])).values()];
// src/crawl/robots.ts
const BOTS = [
	{
		agent: "Googlebot",
		owner: "Google",
		purpose: "search",
		note: "Search, including AI Overviews and AI Mode"
	},
	{
		agent: "Bingbot",
		owner: "Microsoft",
		purpose: "search",
		note: "Bing and Copilot answers"
	},
	{
		agent: "Applebot",
		owner: "Apple",
		purpose: "search",
		note: "Siri and Spotlight"
	},
	{
		agent: "DuckDuckBot",
		owner: "DuckDuckGo",
		purpose: "search"
	},
	{
		agent: "YandexBot",
		owner: "Yandex",
		purpose: "search"
	},
	{
		agent: "Baiduspider",
		owner: "Baidu",
		purpose: "search"
	},
	{
		agent: "OAI-SearchBot",
		owner: "OpenAI",
		purpose: "ai-search",
		note: "ChatGPT search results"
	},
	{
		agent: "Claude-SearchBot",
		owner: "Anthropic",
		purpose: "ai-search",
		note: "Claude search answers"
	},
	{
		agent: "PerplexityBot",
		owner: "Perplexity",
		purpose: "ai-search"
	},
	{
		agent: "ChatGPT-User",
		owner: "OpenAI",
		purpose: "ai-user",
		note: "Fetches a page a user asked about; may ignore robots.txt"
	},
	{
		agent: "Claude-User",
		owner: "Anthropic",
		purpose: "ai-user",
		note: "Fetches a page a user asked about"
	},
	{
		agent: "Perplexity-User",
		owner: "Perplexity",
		purpose: "ai-user"
	},
	{
		agent: "MistralAI-User",
		owner: "Mistral",
		purpose: "ai-user"
	},
	{
		agent: "GPTBot",
		owner: "OpenAI",
		purpose: "ai-training"
	},
	{
		agent: "ClaudeBot",
		owner: "Anthropic",
		purpose: "ai-training"
	},
	{
		agent: "Google-Extended",
		owner: "Google",
		purpose: "ai-training",
		note: "Token only: Gemini training and grounding. Does not affect Search"
	},
	{
		agent: "Applebot-Extended",
		owner: "Apple",
		purpose: "ai-training",
		note: "Token only: Apple Intelligence training"
	},
	{
		agent: "CCBot",
		owner: "Common Crawl",
		purpose: "ai-training",
		note: "Open dataset used by many model builders"
	},
	{
		agent: "Meta-ExternalAgent",
		owner: "Meta",
		purpose: "ai-training"
	},
	{
		agent: "Bytespider",
		owner: "ByteDance",
		purpose: "ai-training"
	},
	{
		agent: "Amazonbot",
		owner: "Amazon",
		purpose: "ai-training"
	},
	{
		agent: "cohere-ai",
		owner: "Cohere",
		purpose: "ai-training"
	},
	{
		agent: "Diffbot",
		owner: "Diffbot",
		purpose: "ai-training"
	},
	{
		agent: "AhrefsBot",
		owner: "Ahrefs",
		purpose: "seo-tool"
	},
	{
		agent: "SemrushBot",
		owner: "Semrush",
		purpose: "seo-tool"
	},
	{
		agent: "facebookexternalhit",
		owner: "Meta",
		purpose: "social",
		note: "Link previews; keep allowed"
	},
	{
		agent: "Twitterbot",
		owner: "X",
		purpose: "social",
		note: "Link previews; keep allowed"
	},
	{
		agent: "LinkedInBot",
		owner: "LinkedIn",
		purpose: "social",
		note: "Link previews; keep allowed"
	}
];
const PRESETS = {
	open: {
		label: "Open",
		help: "Every crawler, including AI training.",
		block: []
	},
	"no-training": {
		label: "Search + AI answers, no training",
		help: "Show up in Google, Bing, ChatGPT, Claude and Perplexity answers; opt out of model training.",
		block: ["ai-training"]
	},
	"search-only": {
		label: "Search engines only",
		help: "Classic search only. Also hides you from AI assistants’ answers.",
		block: [
			"ai-training",
			"ai-search",
			"ai-user"
		]
	},
	closed: {
		label: "Closed",
		help: "Block everything (staging sites).",
		block: []
	}
};
/** Which registry bots end up blocked from "/" (for the dashboard and checks). */
function blockedBots(site) {
	const r = site.robots ?? {};
	if (r.preset === "closed" || r.indexable === false) return BOTS;
	const block = PRESETS[r.preset ?? "no-training"].block;
	const custom = new Set((r.rules ?? []).filter((x) => x.disallow?.includes("/")).flatMap((x) => x.agents.map((a) => a.toLowerCase())));
	return BOTS.filter((b) => block.includes(b.purpose) || custom.has(b.agent.toLowerCase()));
}
// src/checker/pixels.ts
const ARIAL = [
	278,
	278,
	355,
	556,
	556,
	889,
	667,
	191,
	333,
	333,
	389,
	584,
	278,
	333,
	278,
	278,
	556,
	556,
	556,
	556,
	556,
	556,
	556,
	556,
	556,
	556,
	278,
	278,
	584,
	584,
	584,
	556,
	1015,
	667,
	667,
	722,
	722,
	667,
	611,
	778,
	722,
	278,
	500,
	667,
	556,
	833,
	722,
	778,
	667,
	778,
	722,
	667,
	611,
	722,
	667,
	944,
	667,
	667,
	611,
	278,
	278,
	278,
	469,
	556,
	333,
	556,
	556,
	500,
	556,
	556,
	278,
	556,
	556,
	222,
	222,
	500,
	222,
	833,
	556,
	556,
	556,
	556,
	333,
	500,
	278,
	556,
	500,
	722,
	500,
	500,
	500,
	334,
	260,
	334,
	584
];
const wide = /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/;
function textWidth(text, fontPx) {
	let units = 0;
	for (const ch of text) {
		const c = ch.codePointAt(0);
		if (c >= 32 && c <= 126) units += ARIAL[c - 32];
		else if (wide.test(ch)) units += 1e3;
		else if (c > 126976) units += 1e3;
		else units += 556;
	}
	return Math.round(units / 1e3 * fontPx);
}
const SERP = {
	title: {
		font: 20,
		max: 600
	},
	description: {
		font: 14,
		max: 920,
		mobile: 680
	}
};
// src/checker/checks.ts
function checkPage({ site, page, resolved: r, analysis: a, graph, others = [] }) {
	const out = [];
	const add = (id, level, group, message, field) => out.push({
		id,
		level,
		group,
		message,
		field
	});
	if (!r.title) add("title.missing", "error", "search", "No title.", "title");
	else {
		const w = textWidth(r.title, SERP.title.font);
		if (w > SERP.title.max) add("title.long", "warning", "search", `Title is ${w}px wide; Google cuts it around ${SERP.title.max}px.`, "title");
		else if (r.title.length < 15) add("title.short", "info", "search", "Title is very short; say what the page is about.", "title");
		else add("title.ok", "pass", "search", `Title fits (${w}px).`, "title");
	}
	if (!r.description) add("description.missing", "warning", "search", "No meta description; Google will pick text from the page.", "description");
	else {
		const w = textWidth(r.description, SERP.description.font);
		if (w > SERP.description.max) add("description.long", "warning", "search", `Description is ${w}px; it gets cut around ${SERP.description.max}px (desktop).`, "description");
		else if (r.description.length < 70) add("description.short", "info", "search", "Description is short; aim for 120–155 characters.", "description");
		else add("description.ok", "pass", "search", "Description length is good.", "description");
	}
	const dupTitle = others.filter((o) => o.path !== r.path && o.title && o.title === r.title);
	if (dupTitle.length) add("title.duplicate", "warning", "search", `Same title as ${dupTitle.map((o) => o.path).slice(0, 3).join(", ")}.`, "title");
	const dupDesc = others.filter((o) => o.path !== r.path && o.description && o.description === r.description);
	if (dupDesc.length) add("description.duplicate", "warning", "search", `Same description as ${dupDesc.map((o) => o.path).slice(0, 3).join(", ")}.`, "description");
	if (!r.siteUrl) add("url.missing", "error", "search", "Site URL is not set; canonical, Open Graph and sitemap URLs need it.", "site:identity.url");
	if (r.siteUrl && r.url && !r.url.startsWith(r.siteUrl)) add("canonical.external", "info", "search", `Canonical points to another site: ${r.url}`, "canonical");
	else if (r.siteUrl && r.url && r.url.replace(/\/$/, "") !== `${r.siteUrl}${r.path}`.replace(/\/$/, "")) add("canonical.other", "info", "search", `Canonical points to ${r.url}; this page stays out of the sitemap.`, "canonical");
	if (r.siteUrl.startsWith("http://")) add("url.http", "warning", "search", "Site URL uses http; use https.", "site:identity.url");
	if (site.robots?.indexable === false) add("robots.site-noindex", "warning", "crawl", "The whole site is set to noindex (staging mode).", "site:robots.indexable");
	else if (!r.robots.indexable) add("robots.noindex", "info", "crawl", "This page is noindex; it is left out of the sitemap and llms.txt.", "robots.index");
	if (r.robots.directives.nosnippet) add("robots.nosnippet", "info", "crawl", "nosnippet also keeps this page out of AI Overviews text.", "robots.nosnippet");
	if (r.robots.directives.maxSnippet === 0) add("robots.maxsnippet", "info", "crawl", "max-snippet:0 hides snippets and AI Overview quotes.", "robots.maxSnippet");
	const blocked = blockedBots(site);
	const search = blocked.filter((b) => b.purpose === "search");
	if (search.length && site.robots?.indexable !== false) add("bots.search", "error", "crawl", `robots.txt blocks search engines: ${search.map((b) => b.agent).join(", ")}.`, "site:robots.preset");
	const ai = blocked.filter((b) => b.purpose === "ai-search");
	if (ai.length && !search.length) add("bots.ai", "info", "crawl", `AI answer engines are blocked (${ai.map((b) => b.agent).join(", ")}); you won't be cited there.`, "site:robots.preset");
	const img = r.og.image;
	if (!img) add("og.image", "warning", "social", "No share image; links show without a preview picture.", "og.image");
	else {
		if (img.width && img.height) {
			const ratio = img.width / img.height;
			if (img.width < 1200) add("og.small", "info", "social", `Share image is ${img.width}px wide; 1200×630 is sharpest everywhere.`, "og.image");
			if (Math.abs(ratio - 1.91) > .15) add("og.ratio", "info", "social", "Share image is not 1.91:1; some apps will crop it.", "og.image");
		} else add("og.size", "info", "social", "Add the share image width and height so apps render it on first share.", "og.imageWidth");
		if (!img.alt) add("og.alt", "info", "social", "Share image has no alt text.", "og.imageAlt");
		if (img.url.startsWith("http://")) add("og.http", "warning", "social", "Share image uses http; some apps refuse it.", "og.image");
	}
	if (a) {
		if (!a.h1.length) add("h1.missing", "warning", "content", "No h1 heading.");
		else if (a.h1.length > 1) add("h1.many", "info", "content", `${a.h1.length} h1 headings; one is clearer.`);
		let prev = 0;
		for (const h of a.headings) {
			if (prev && h.level > prev + 1) {
				add("headings.skip", "info", "content", `Heading jumps from h${prev} to h${h.level} ("${h.text.slice(0, 40)}").`);
				break;
			}
			prev = h.level;
		}
		const noAlt = a.images.filter((i) => i.alt === null);
		if (noAlt.length) add("img.alt", "warning", "content", `${noAlt.length} image${noAlt.length > 1 ? "s" : ""} without alt text.`);
		if (a.words < 150 && r.robots.indexable) add("content.thin", "info", "content", `Only ${a.words} words of main text.`);
		if (!a.hasViewport) add("tech.viewport", "error", "tech", "No viewport meta tag; the page will not be mobile friendly.");
		if (!a.hasCharset) add("tech.charset", "warning", "tech", "No <meta charset>.");
		const own = a.jsonLd.filter((j) => !JSON.stringify(j).includes("\"#webpage\""));
		if (own.some((j) => j.invalid)) add("schema.invalid", "error", "schema", "The page has a JSON-LD block that is not valid JSON.");
		const dup = own.flatMap(types).filter((t) => t === "Organization" || t === "WebSite" || t === "BreadcrumbList");
		if (dup.length) add("schema.duplicate", "info", "schema", `The page already has its own ${[...new Set(dup)].join(", ")} markup; u1webcore adds one too.`);
	}
	if (!r.lang) add("tech.lang", "warning", "tech", "No page language.", "site:identity.language");
	if (graph) {
		for (const i of checkSchema(graph, page)) add(`schema.${i.field}`, i.level, "schema", i.message, `schema.data.${i.field}`);
		const t = schemaType(page.schema?.type);
		if (t?.rich === "retired") add("schema.retired", "info", "schema", `${t.label}: Google no longer shows a rich result; still read by Bing and AI assistants.`);
		if (a && page.aeo?.faq?.length) {
			const text = a.text.toLowerCase();
			const missing = page.aeo.faq.filter((f) => !text.includes(f.question.toLowerCase().slice(0, 40)));
			if (missing.length) add("schema.faq-visible", "warning", "schema", `${missing.length} FAQ question${missing.length > 1 ? "s are" : " is"} not visible on the page; structured data must match visible content.`, "aeo.faq");
		}
	}
	if (!site.organization?.logo && r.isHome) add("org.logo", "info", "schema", "No organization logo (≥112px) for Google knowledge panels.", "site:organization.logo");
	return out;
}
const types = (j) => {
	if (!j || typeof j !== "object") return [];
	const o = j;
	const own = o["@type"] ? [].concat(o["@type"]).map(String) : [];
	const graph = Array.isArray(o["@graph"]) ? o["@graph"].flatMap(types) : [];
	return [...own, ...graph];
};
// src/checker/audit.ts
/** Site-level wording for page checks whose message has page specifics in it. */
const LABELS = {
	"title.long": "Title too wide: Google cuts it off",
	"description.long": "Description gets cut off in Google",
	"canonical.external": "Canonical points to another site",
	"canonical.other": "Canonical points to another page",
	"og.small": "Share image narrower than 1200 px",
	"headings.skip": "Heading levels skip",
	"img.alt": "Images without alt text",
	"content.thin": "Little main text",
	"schema.duplicate": "Structured data added twice (page and u1webcore)",
	"schema.retired": "Schema type with no Google rich result",
	"schema.faq-visible": "FAQ answers not visible on the page"
};
const RANK = {
	error: 0,
	warning: 1,
	info: 2
};
function auditSite({ site, pages, links = [], siteUrl = "" }) {
	const issues = /* @__PURE__ */ new Map();
	const add = (id, level, message, page, field, note) => {
		const cur = issues.get(id) ?? issues.set(id, {
			id,
			level,
			message,
			pages: [],
			field
		}).get(id);
		if (!cur.pages.includes(page)) cur.pages.push(page);
		if (note) (cur.notes ??= {})[page] = note;
	};
	const content = pages.filter((p) => !isUtilityPath(p.path));
	const others = content.filter((p) => p.indexable).map((p) => ({
		path: p.path,
		title: p.title,
		description: p.description
	}));
	for (const p of content) {
		const graph = buildGraph({
			site,
			page: p.settings,
			resolved: p.resolved,
			text: p.analysis?.text
		});
		for (const c of checkPage({
			site,
			page: p.settings,
			resolved: p.resolved,
			analysis: p.analysis,
			graph,
			others: p.indexable ? others : []
		})) {
			if (c.level === "pass") continue;
			const id = c.id.startsWith("title.duplicate") ? `${c.id}:${p.title}` : c.id.startsWith("description.duplicate") ? `${c.id}:${p.description}` : c.id;
			const label = LABELS[c.id];
			const message = c.id.startsWith("title.duplicate") ? `Same title on several pages: “${p.title}”` : c.id.startsWith("description.duplicate") ? "Same description on several pages" : label ?? c.message;
			add(id, c.level, message, p.path, c.field, label ? c.message : void 0);
		}
	}
	for (const l of links) if (l.status >= 400 || l.status === 0) add(`link.broken:${l.to}`, "error", `Broken link to ${l.to}${l.status ? ` (${l.status})` : ""}`, l.from);
	else if (l.status >= 300) add(`link.redirect:${l.to}`, "warning", `Link to ${l.to} redirects${l.location ? ` to ${l.location}` : ""}; link to the final URL`, l.from);
	if (siteUrl.startsWith("https://")) {
		for (const p of content) for (const img of p.analysis?.images ?? []) if (img.src.startsWith("http://")) add(`mixed:${img.src}`, "error", `Insecure image (http://) ${img.src}`, p.path);
	}
	if (links.length) {
		const linked = new Set(links.filter((l) => pageKey(l.from) !== pageKey(l.to)).map((l) => pageKey(l.to)));
		for (const p of content) if (p.path !== "/" && p.indexable && !linked.has(pageKey(p.path))) add("orphan", "info", "No other page links here", p.path);
	}
	for (const i of checkRedirects(site.redirects ?? []).issues) add(`redirects:${i.from}`, "warning", `Redirect ${i.from}: ${i.message}`, i.from, "site:redirects");
	const list = [...issues.values()].sort((a, b) => RANK[a.level] - RANK[b.level] || b.pages.length - a.pages.length);
	return {
		pages: pages.length,
		links: links.length,
		issues: list
	};
}
/** Internal links on a page, as site paths (no hash or query); `null` for external or non-page links. */
function internalPath(href, from, origins) {
	if (!href || /^(mailto|tel|javascript|data):/i.test(href) || href.startsWith("#")) return null;
	let url;
	try {
		url = new URL(href, `http://local${from}`);
	} catch {
		return null;
	}
	if (!(url.host === "local" || origins.some((o) => o && url.origin === new URL(o).origin))) return null;
	const p = decodeURI(url.pathname);
	if (/\.[a-z0-9]+$/i.test(p) && !/\.html?$/i.test(p)) return null;
	return p;
}
// src/cli.ts
function htmlFiles(dir, base = dir) {
	return readdirSync(dir).flatMap((name) => {
		const abs = path.join(dir, name);
		if (statSync(abs).isDirectory()) return htmlFiles(abs, base);
		return name.endsWith(".html") ? [path.relative(base, abs)] : [];
	});
}
/** dist file → page path: index.html → /, a/index.html → /a, a.html → /a */
const routeOf = (file) => pageKey(`/${file.split(path.sep).join("/").replace(/(^|\/)index\.html$/, "").replace(/\.html$/, "")}`);
function main(argv) {
	const [cmd, dir = "dist"] = argv;
	if (cmd !== "audit") {
		console.log("Usage: u1webcore audit [dist]");
		return cmd ? 1 : 0;
	}
	const out = path.resolve(dir);
	if (!existsSync(out)) {
		console.error(`No ${dir}/ folder. Build the site first.`);
		return 1;
	}
	let site = {};
	try {
		site = JSON.parse(readFileSync(SITE_FILE, "utf-8"));
	} catch {}
	const siteUrl = site.identity?.url ?? "";
	const redirects = new Map((site.redirects ?? []).map((r) => [pageKey(r.from), r.to]));
	const pages = [];
	const links = [];
	const known = /* @__PURE__ */ new Set();
	const files = htmlFiles(out);
	for (const f of files) known.add(routeOf(f));
	for (const f of files) {
		const route = routeOf(f);
		const html = readFileSync(path.join(out, f), "utf-8");
		if (/<meta[^>]+http-equiv=["']?refresh/i.test(html) && html.length < 2e3) continue;
		pages.push(sitePage({
			site,
			path: route,
			html,
			siteUrl
		}));
		for (const l of analyze(html).links) {
			const to = internalPath(l.href, route, [siteUrl]);
			if (to === null) continue;
			const key = pageKey(to);
			const location = redirects.get(key);
			links.push({
				from: route,
				to,
				status: location ? 301 : known.has(key) || existsSync(path.join(out, to)) ? 200 : 404,
				location
			});
		}
	}
	const result = auditSite({
		site,
		pages,
		links,
		siteUrl
	});
	const icon = {
		error: "✖",
		warning: "▲",
		info: "·"
	};
	console.log(`u1webcore audit: ${result.pages} pages, ${result.links} internal links\n`);
	for (const i of result.issues) {
		console.log(`${icon[i.level]} ${i.message}`);
		if (i.notes) for (const p of i.pages.slice(0, 5)) console.log(`    ${p}: ${i.notes[p] ?? ""}`);
		else console.log(`    ${i.pages.slice(0, 5).join(", ")}`);
		if (i.pages.length > 5) console.log(`    +${i.pages.length - 5} more`);
	}
	const errors = result.issues.filter((i) => i.level === "error").length;
	console.log(`\n${errors} errors, ${result.issues.filter((i) => i.level === "warning").length} warnings, ${result.issues.filter((i) => i.level === "info").length} notes`);
	return errors ? 1 : 0;
}
process.exitCode = main(process.argv.slice(2));
export {};
