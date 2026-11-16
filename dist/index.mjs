// src/shared/util.ts
const escapeHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const escapeXml = (s) => escapeHtml(s).replace(/'/g, "&apos;");
/** JSON for inside <script>: no "<\/script>" breakouts, no U+2028/9 surprises. */
const scriptJson = (value, indent) => JSON.stringify(value, null, indent).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
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
/** A page's settings file sits next to its route file: src/pages/contact.astro → src/pages/contact.u1wc.json */
const sidecarFor = (entrypoint) => entrypoint.replace(/\.[a-z]+$/i, ".u1wc.json");
/** Normalized page path, the key for one URL's settings: "/" or "/a/b" (no trailing slash, query or index). */
function pageKey(path) {
	const clean = path.split(/[?#]/)[0].replace(/\.html$/, "").replace(/\/index$/, "").replace(/\/+$/, "");
	return clean.startsWith("/") ? clean || "/" : `/${clean}`;
}
/** Error pages and similar never go into sitemaps, feeds, llms.txt or share cards. */
const isUtilityPath = (path) => /^\/(?:404|500|_[^/]*)(?:\/|\.html)?$/.test(path) || /\/(?:404|500)\/?$/.test(path);
/** Where a page's generated share card is served: "/" → /og/index.png, "/a/b" → /og/a/b.png */
const cardPath = (path) => `/og${pageKey(path) === "/" ? "/index" : pageKey(path)}.png`;
/** The route that renders `path`: by Astro's route pattern when known, else the first regex that matches. */
function routeFor(routes, path, pattern) {
	const byPattern = pattern ? routes.find((r) => r.pattern === pattern) : void 0;
	if (byPattern) return byPattern;
	const bare = path.replace(/\/+$/, "") || "/";
	return routes.find((r) => {
		try {
			const re = new RegExp(r.re);
			return re.test(path) || re.test(bare) || re.test(`${bare}/`.replace(/\/{2}$/, "/"));
		} catch {
			return false;
		}
	});
}
/** Key of `path`'s settings in its route's file: the URL for a dynamic route, else empty (the file is the page). */
const entryKey = (route, path) => route.dynamic ? pageKey(path) : "";
/** `path`'s settings, from the settings files' contents (by file). */
function pageSettings(files, route, path) {
	const file = route && files[route.file];
	if (!file) return void 0;
	const v = route.dynamic ? file[pageKey(path)] : file;
	return isRecord(v) ? v : void 0;
}
const collapse = (s) => s.replace(/\s+/g, " ").trim();
const clip = (s, max) => s.length <= max ? s : `${s.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
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
/** "/blog/*" or "/drafts/**" style patterns ("*" = one segment, "**" = anything). Plain paths match as prefixes. */
function matchPath(pattern, path) {
	if (!pattern.includes("*")) return path === pattern || path.startsWith(pattern.endsWith("/") ? pattern : `${pattern}/`);
	const re = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*\*/g, "\0").replace(/\*/g, "[^/]*").replace(/\u0000/g, ".*");
	return new RegExp(`^${re}$`).test(path);
}
/** Route path → its markdown copy: "/" → "/index.md", "/a/b/" → "/a/b.md". */
const markdownPath = (path) => `${path.replace(/\/+$/, "").replace(/\.html$/, "") || "/index"}.md`;
const isoDate = (d) => {
	if (!d) return void 0;
	const t = new Date(d);
	return Number.isNaN(t.getTime()) ? void 0 : t.toISOString();
};
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
/** Languages from Astro's `i18n` config: `/<locale>` prefixes, the default unprefixed unless `prefixDefaultLocale`. */
function fromAstroI18n(i18n) {
	if (!i18n?.locales?.length) return void 0;
	const routing = i18n.routing && typeof i18n.routing === "object" ? i18n.routing : {};
	const locales = i18n.locales.map((l) => {
		const path = typeof l === "string" ? l : l.path;
		return {
			code: typeof l === "string" ? l : l.codes[0] ?? l.path,
			prefix: path === i18n.defaultLocale && !routing.prefixDefaultLocale ? "" : `/${path}`
		};
	});
	return {
		locales,
		defaultLocale: locales.find((_, i) => (typeof i18n.locales[i] === "string" ? i18n.locales[i] : i18n.locales[i].path) === i18n.defaultLocale)?.code ?? locales[0].code
	};
}
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
// src/meta/tag.ts
const meta = (key, id, content) => content === void 0 || content === "" ? null : {
	tag: "meta",
	attrs: {
		[key]: id,
		content: String(content)
	}
};
const link = (attrs) => attrs.href ? {
	tag: "link",
	attrs: Object.fromEntries(Object.entries(attrs).filter(([, v]) => v !== void 0))
} : null;
// src/social/social.ts
function openGraphTags(page) {
	return [
		meta("property", "og:type", page.og.type),
		meta("property", "og:site_name", page.siteName),
		meta("property", "og:title", page.og.title),
		meta("property", "og:description", page.og.description),
		meta("property", "og:url", page.url || void 0),
		meta("property", "og:locale", page.ogLocale),
		...[...new Set(page.alternates.map((a) => a.ogLocale).filter((o) => !!o && o !== page.ogLocale))].map((o) => meta("property", "og:locale:alternate", o)),
		meta("property", "fb:app_id", page.og.appId),
		page.og.video ? meta("property", "og:video", page.og.video) : null,
		page.og.video?.startsWith("https://") ? meta("property", "og:video:secure_url", page.og.video) : null,
		meta("property", "product:price:amount", page.og.product?.price),
		meta("property", "product:price:currency", page.og.product?.currency),
		page.og.nopin ? meta("name", "pinterest", "nopin") : null,
		meta("name", "fediverse:creator", page.og.fediverseCreator),
		...page.og.image ? [
			meta("property", "og:image", page.og.image.url),
			page.og.image.url.startsWith("https://") ? meta("property", "og:image:secure_url", page.og.image.url) : null,
			meta("property", "og:image:type", imageType(page.og.image.url)),
			meta("property", "og:image:width", page.og.image.width),
			meta("property", "og:image:height", page.og.image.height),
			meta("property", "og:image:alt", page.og.image.alt)
		] : [],
		...page.og.article ? [
			meta("property", "article:published_time", page.og.article.publishedTime),
			meta("property", "article:modified_time", page.og.article.modifiedTime),
			meta("property", "article:author", page.og.article.author),
			meta("property", "article:section", page.og.article.section),
			...page.og.article.tags.map((t) => meta("property", "article:tag", t))
		] : []
	];
}
function twitterTags(page) {
	return [
		meta("name", "twitter:card", page.twitter.card),
		meta("name", "twitter:site", page.twitter.site),
		meta("name", "twitter:creator", page.twitter.creator),
		meta("name", "twitter:title", page.twitter.title),
		meta("name", "twitter:description", page.twitter.description),
		meta("name", "twitter:image", page.twitter.image?.url),
		meta("name", "twitter:image:alt", page.twitter.image?.alt),
		...page.twitter.labels.flatMap((l, i) => [meta("name", `twitter:label${i + 1}`, l.label), meta("name", `twitter:data${i + 1}`, l.data)])
	];
}
function imageType(url) {
	const ext = /\.(png|jpe?g|webp|gif|avif|svg)(?:[?#]|$)/i.exec(url)?.[1]?.toLowerCase();
	if (!ext) return void 0;
	return ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "svg" ? "image/svg+xml" : `image/${ext}`;
}
// src/meta/head.ts
function buildHead(page, site, extras = {}) {
	const s = page.siteUrl;
	const id = site.identity ?? {};
	const icons = site.icons ?? {};
	const v = site.verification ?? {};
	return [
		{
			tag: "title",
			attrs: {},
			content: page.title
		},
		meta("name", "description", page.description),
		page.keywords.length ? meta("name", "keywords", page.keywords.join(", ")) : null,
		meta("name", "author", page.author?.name),
		meta("name", "robots", page.robots.content),
		link({
			rel: "canonical",
			href: page.url || void 0
		}),
		...page.alternates.map((a) => link({
			rel: "alternate",
			hreflang: a.hreflang,
			href: a.url
		})),
		...openGraphTags(page),
		...twitterTags(page),
		id.themeColor ? {
			tag: "meta",
			attrs: {
				name: "theme-color",
				content: id.themeColor,
				...id.themeColorDark ? { media: "(prefers-color-scheme: light)" } : {}
			}
		} : null,
		id.themeColorDark ? {
			tag: "meta",
			attrs: {
				name: "theme-color",
				content: id.themeColorDark,
				media: "(prefers-color-scheme: dark)"
			}
		} : null,
		link({
			rel: "icon",
			href: icons.favicon,
			sizes: icons.favicon?.endsWith(".ico") ? "32x32" : void 0
		}),
		link({
			rel: "icon",
			href: icons.svg,
			type: "image/svg+xml"
		}),
		link({
			rel: "apple-touch-icon",
			href: icons.appleTouchIcon
		}),
		site.manifest?.enabled ? link({
			rel: "manifest",
			href: "/site.webmanifest"
		}) : null,
		meta("name", "google-site-verification", v.google),
		meta("name", "msvalidate.01", v.bing),
		meta("name", "yandex-verification", v.yandex),
		meta("name", "baidu-site-verification", v.baidu),
		meta("name", "naver-site-verification", v.naver),
		meta("name", "p:domain_verify", v.pinterest),
		meta("name", "facebook-domain-verification", v.facebook),
		...(site.feeds ?? []).map((f) => link({
			rel: "alternate",
			type: feedType$1(f),
			title: f.title ?? page.siteName,
			href: absolute(f.path, s) ?? f.path
		})),
		link({
			rel: "alternate",
			type: "text/markdown",
			href: extras.markdownUrl
		}),
		link({
			rel: "describedby",
			type: "text/plain",
			href: extras.llmsUrl
		}),
		...(site.hints?.preconnect ?? []).map((h) => link({
			rel: "preconnect",
			href: h,
			crossorigin: ""
		})),
		...(site.hints?.dnsPrefetch ?? []).map((h) => link({
			rel: "dns-prefetch",
			href: h
		})),
		extras.jsonLd ? {
			tag: "script",
			attrs: { type: "application/ld+json" },
			content: scriptJson(extras.jsonLd)
		} : null
	].filter((t) => t !== null);
}
const feedType$1 = (f) => f.format === "atom" ? "application/atom+xml" : f.format === "json" ? "application/feed+json" : "application/rss+xml";
function renderTag(t) {
	const attrs = Object.entries(t.attrs).map(([k, v]) => v === "" && k === "crossorigin" ? ` ${k}` : ` ${k}="${escapeHtml(v)}"`).join("");
	if (t.tag === "title") return `<title>${escapeHtml(t.content ?? "")}</title>`;
	if (t.tag === "script") return `<script${attrs}>${t.content ?? ""}<\/script>`;
	return `<${t.tag}${attrs}>`;
}
const renderHead = (tags) => tags.map(renderTag).join("\n");
/**
* Identity of a head tag for replacement: a page's own tag is dropped when we emit one with the same key.
* null = never replaced (e.g. a site's own JSON-LD, stylesheets).
*/
function tagKey(tag, attrs) {
	const t = tag.toLowerCase();
	if (t === "title") return "title";
	if (t === "meta") {
		if (attrs.name) return `name:${attrs.name.toLowerCase()}`;
		if (attrs.property) return `property:${attrs.property.toLowerCase()}`;
		return null;
	}
	if (t === "link") {
		const rel = (attrs.rel ?? "").toLowerCase().split(/\s+/);
		if (rel.includes("canonical")) return "canonical";
		if (rel.includes("alternate") && attrs.hreflang) return "hreflang";
		if (rel.includes("alternate") && /rss|atom|feed\+json|markdown/.test(attrs.type ?? "")) return `alternate:${attrs.type}`;
		if (rel.includes("icon") || rel.includes("shortcut")) return "icon";
		if (rel.includes("apple-touch-icon")) return "apple-touch-icon";
		if (rel.includes("manifest")) return "manifest";
		if (rel.includes("describedby")) return "describedby";
		return null;
	}
	return null;
}
// src/meta/rewrite.ts
const MARK = "u1webcore";
function inject(html, { head, lang, headStart = "", headEnd = "", bodyStart = "", bodyEnd = "" }) {
	const keys = new Set(head.map((t) => tagKey(t.tag, t.attrs)).filter(Boolean));
	const cuts = [];
	let headOpen = -1;
	let headClose = -1;
	let afterCharset = -1;
	let htmlTag = null;
	let bodyOpen = -1;
	let bodyClose = -1;
	let titleStart = -1;
	for (const t of tokens(html)) if (t.type === "open") {
		if (t.name === "html" && !htmlTag) htmlTag = {
			start: t.start,
			end: t.end,
			lang: t.attrs.lang
		};
		else if (t.name === "head" && headOpen === -1) headOpen = t.end;
		else if (t.name === "body" && bodyOpen === -1) bodyOpen = t.end;
		else if (headOpen !== -1 && headClose === -1) {
			if (t.name === "meta" && "charset" in t.attrs) afterCharset = t.end;
			if (t.name === "title") titleStart = t.start;
			const key = tagKey(t.name, t.attrs);
			if (key && keys.has(key) && t.name !== "title") cuts.push([t.start, t.end]);
		}
	} else if (t.type === "close") {
		if (t.name === "title" && titleStart !== -1 && headClose === -1 && keys.has("title")) {
			cuts.push([titleStart, t.end]);
			titleStart = -1;
		} else if (t.name === "head" && headClose === -1) headClose = t.start;
		else if (t.name === "body") bodyClose = t.start;
	}
	if (headOpen === -1 || headClose === -1) return html;
	const block = `\n<!--${MARK}-->\n${head.map(renderTag).join("\n")}\n<!--/${MARK}-->`;
	const edits = cuts.map(([s, e]) => wholeLine(html, s, e));
	edits.push({
		at: afterCharset !== -1 ? afterCharset : headOpen,
		end: afterCharset !== -1 ? afterCharset : headOpen,
		text: headStart + block
	});
	if (headEnd) edits.push({
		at: headClose,
		end: headClose,
		text: headEnd
	});
	if (bodyStart && bodyOpen !== -1) edits.push({
		at: bodyOpen,
		end: bodyOpen,
		text: bodyStart
	});
	if (bodyEnd && bodyClose !== -1) edits.push({
		at: bodyClose,
		end: bodyClose,
		text: bodyEnd
	});
	if (lang && htmlTag && htmlTag.lang !== lang) {
		const open = html.slice(htmlTag.start, htmlTag.end);
		const next = /\slang\s*=/i.test(open) ? open.replace(/\slang\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/i, ` lang="${escapeHtml(lang)}"`) : open.replace(/^<html/i, `<html lang="${escapeHtml(lang)}"`);
		edits.push({
			at: htmlTag.start,
			end: htmlTag.end,
			text: next
		});
	}
	edits.sort((a, b) => b.at - a.at || b.end - a.end);
	let out = html;
	for (const e of edits) out = out.slice(0, e.at) + e.text + out.slice(e.end);
	return out;
}
/** A removed tag that sat alone on its line takes the line with it. */
function wholeLine(html, start, end) {
	const lineStart = html.lastIndexOf("\n", start - 1) + 1;
	const after = /^[ \t]*\r?\n/.exec(html.slice(end, end + 200));
	if (/^[ \t]*$/.test(html.slice(lineStart, start)) && after) return {
		at: lineStart,
		end: end + after[0].length,
		text: ""
	};
	return {
		at: start,
		end,
		text: ""
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
function robotsTxt(site, siteUrl, extra = {}) {
	const r = site.robots ?? {};
	const preset = r.preset ?? "no-training";
	const lines = [];
	const base = origin(site.identity?.url || siteUrl);
	const closed = preset === "closed" || r.indexable === false;
	const signals = r.contentSignals;
	if (signals && Object.values(signals).some((v) => v !== void 0)) lines.push("# Content signals: search = indexing and links, ai-input = AI answers, ai-train = model training.");
	const group = (agents, body) => {
		lines.push(...agents.map((a) => `User-agent: ${a}`), ...body, "");
	};
	const everyone = closed ? ["Disallow: /"] : [...(r.disallow ?? []).map((p) => `Disallow: ${p}`), (r.disallow ?? []).length ? "" : "Allow: /"].filter(Boolean);
	if (signals && !closed) {
		const parts = [
			signals.search !== void 0 && `search=${signals.search ? "yes" : "no"}`,
			signals.aiInput !== void 0 && `ai-input=${signals.aiInput ? "yes" : "no"}`,
			signals.aiTrain !== void 0 && `ai-train=${signals.aiTrain ? "yes" : "no"}`
		].filter(Boolean);
		if (parts.length) everyone.unshift(`Content-Signal: ${parts.join(", ")}`);
	}
	if (r.contentUsage && !closed) everyone.unshift(`Content-Usage: ${r.contentUsage}`);
	group(["*"], everyone);
	if (!closed) {
		const blocked = BOTS.filter((b) => PRESETS[preset].block.includes(b.purpose)).map((b) => b.agent);
		if (blocked.length) group(blocked, ["Disallow: /"]);
		for (const rule of r.rules ?? []) group(rule.agents, ruleBody(rule));
	}
	if (extra.sitemap !== false && site.sitemap?.enabled !== false && base && !closed) lines.push(`Sitemap: ${base}/sitemap-index.xml`);
	return `${lines.join("\n").trim()}\n`;
}
function ruleBody(rule) {
	const body = [...(rule.allow ?? []).map((p) => `Allow: ${p}`), ...(rule.disallow ?? []).map((p) => `Disallow: ${p}`)];
	if (rule.crawlDelay) body.push(`Crawl-delay: ${rule.crawlDelay}`);
	return body.length ? body : ["Allow: /"];
}
/** Which registry bots end up blocked from "/" (for the dashboard and checks). */
function blockedBots(site) {
	const r = site.robots ?? {};
	if (r.preset === "closed" || r.indexable === false) return BOTS;
	const block = PRESETS[r.preset ?? "no-training"].block;
	const custom = new Set((r.rules ?? []).filter((x) => x.disallow?.includes("/")).flatMap((x) => x.agents.map((a) => a.toLowerCase())));
	return BOTS.filter((b) => block.includes(b.purpose) || custom.has(b.agent.toLowerCase()));
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
function inSitemap(p, site) {
	if (!p.indexable || !p.canonicalSelf || p.settings.sitemap?.include === false || isUtilityPath(p.path)) return false;
	return !(site.sitemap?.exclude ?? []).some((pat) => matchPath(pat, p.path));
}
function inLlms(p, site) {
	if (p.settings.llms?.include === false || !p.indexable || !p.canonicalSelf || isUtilityPath(p.path)) return false;
	return p.settings.llms?.include === true || !(site.sitemap?.exclude ?? []).some((pat) => matchPath(pat, p.path));
}
const markdownUrl = (p) => absolute(markdownPath(p.path), p.resolved.siteUrl) ?? markdownPath(p.path);
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
// src/crawl/sitemap.ts
const CHUNK = 45e3;
function sitemaps(site, pages, siteUrl) {
	if (site.sitemap?.enabled === false) return [];
	const base = origin(site.identity?.url || siteUrl);
	if (!base) return [];
	const list = pages.filter((p) => inSitemap(p, site)).sort((a, b) => a.path.localeCompare(b.path));
	const withImages = site.sitemap?.images !== false;
	const withLastmod = site.sitemap?.lastmod !== false;
	const listed = new Set(list.map((p) => p.url));
	const chunks = [];
	for (let i = 0; i < Math.max(1, list.length); i += CHUNK) {
		const urls = list.slice(i, i + CHUNK).map((p) => {
			const parts = [`    <loc>${escapeXml(p.url)}</loc>`];
			const lastmod = withLastmod ? isoDate(p.lastmod) : void 0;
			if (lastmod) parts.push(`    <lastmod>${lastmod}</lastmod>`);
			for (const a of p.resolved.alternates) if (listed.has(a.url)) parts.push(`    <xhtml:link rel="alternate" hreflang="${escapeXml(a.hreflang)}" href="${escapeXml(a.url)}"/>`);
			if (withImages) for (const img of p.images.slice(0, 1e3)) parts.push(`    <image:image><image:loc>${escapeXml(img.url)}</image:loc></image:image>`);
			return `  <url>\n${parts.join("\n")}\n  </url>`;
		});
		const ns = [
			"xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\"",
			withImages && list.some((p) => p.images.length) && "xmlns:image=\"http://www.google.com/schemas/sitemap-image/1.1\"",
			list.some((p) => p.resolved.alternates.length) && "xmlns:xhtml=\"http://www.w3.org/1999/xhtml\""
		].filter(Boolean);
		chunks.push({
			path: `/sitemap-${chunks.length}.xml`,
			type: "application/xml",
			body: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset ${ns.join(" ")}>\n${urls.join("\n")}\n</urlset>\n`
		});
	}
	const newest = (from) => list.slice(from, from + CHUNK).map((p) => isoDate(p.lastmod)).filter(Boolean).sort().pop();
	return [{
		path: "/sitemap-index.xml",
		type: "application/xml",
		body: `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${chunks.map((c, i) => {
			const lm = withLastmod ? newest(i * CHUNK) : void 0;
			return `  <sitemap>\n    <loc>${escapeXml(base + c.path)}</loc>${lm ? `\n    <lastmod>${lm}</lastmod>` : ""}\n  </sitemap>`;
		}).join("\n")}\n</sitemapindex>\n`
	}, ...chunks];
}
// src/aeo/llms.ts
function llmsSections(site, pages) {
	const md = site.llms?.markdownPages !== false;
	const sections = /* @__PURE__ */ new Map();
	const add = (title, link) => {
		const list = sections.get(title) ?? [];
		if (!list.some((l) => l.url === link.url)) list.push(link);
		sections.set(title, list);
	};
	for (const s of site.llms?.sections ?? []) for (const l of s.links) add(s.title, l);
	const listed = new Set([...sections.values()].flat().map((l) => l.url));
	const auto = pages.filter((p) => inLlms(p, site)).sort((a, b) => depth(a.path) - depth(b.path) || a.path.localeCompare(b.path));
	for (const p of auto) {
		const url = md ? markdownUrl(p) : p.url;
		if (listed.has(url) || listed.has(p.url)) continue;
		const seg = p.resolved.path.split("/").filter(Boolean)[0];
		const title = p.settings.llms?.section ?? (p.resolved.isHome || !seg || depth(p.path) === 1 ? "Pages" : humanize(seg));
		const notes = collapse(p.settings.llms?.notes ?? p.settings.aeo?.summary ?? p.description);
		add(title, {
			title: p.settings.llms?.title ?? p.pageTitle ?? p.path,
			url,
			notes: notes || void 0
		});
	}
	const out = [...sections.entries()].map(([title, links]) => ({
		title,
		links
	}));
	return [...out.filter((s) => s.title.toLowerCase() !== "optional"), ...out.filter((s) => s.title.toLowerCase() === "optional")];
}
function llmsTxt(site, pages) {
	const name = site.identity?.name || site.organization?.name || "Website";
	const summary = collapse(site.llms?.summary ?? site.identity?.description ?? site.organization?.description ?? "");
	const parts = [`# ${name}`];
	if (summary) parts.push(`> ${summary}`);
	if (site.llms?.details?.trim()) parts.push(site.llms.details.trim());
	for (const s of llmsSections(site, pages)) {
		if (!s.links.length) continue;
		parts.push(`## ${s.title}\n\n${s.links.map((l) => `- [${l.title.replace(/[[\]]/g, "")}](${l.url})${l.notes ? `: ${l.notes}` : ""}`).join("\n")}`);
	}
	return `${parts.join("\n\n")}\n`;
}
function llmsFullTxt(site, pages) {
	return `${[llmsTxt(site, pages).split("\n## ")[0].trim(), ...pages.filter((p) => inLlms(p, site) && p.markdown).sort((a, b) => depth(a.path) - depth(b.path) || a.path.localeCompare(b.path)).map((p) => p.markdown.trim().replace(/^# /gm, "## ").replace(/^## /, "# "))].join("\n\n---\n\n")}\n`;
}
const depth = (p) => p.split("/").filter(Boolean).length;
// src/crawl/misc.ts
function webManifest(site) {
	const id = site.identity ?? {};
	const m = site.manifest ?? {};
	const icons = site.icons ?? {};
	const list = [
		icons.icon192 && {
			src: icons.icon192,
			sizes: "192x192",
			type: mime(icons.icon192)
		},
		icons.icon512 && {
			src: icons.icon512,
			sizes: "512x512",
			type: mime(icons.icon512)
		},
		icons.maskable && {
			src: icons.maskable,
			sizes: "512x512",
			type: mime(icons.maskable),
			purpose: "maskable"
		},
		!icons.icon192 && !icons.icon512 && icons.svg && {
			src: icons.svg,
			sizes: "any",
			type: "image/svg+xml"
		}
	].filter(Boolean);
	const out = {
		name: id.name || site.organization?.name,
		short_name: m.shortName || id.alternateName?.[0] || id.name,
		description: id.description,
		lang: id.language,
		start_url: m.startUrl ?? "/",
		scope: "/",
		display: m.display ?? "standalone",
		background_color: m.backgroundColor ?? "#ffffff",
		theme_color: id.themeColor,
		icons: list
	};
	return `${JSON.stringify(out, (_k, v) => v === void 0 || v === "" ? void 0 : v, 2)}\n`;
}
const mime = (src) => /\.svg/i.test(src) ? "image/svg+xml" : /\.webp/i.test(src) ? "image/webp" : /\.jpe?g/i.test(src) ? "image/jpeg" : "image/png";
/** RFC 9116. Contact and Expires are required; Expires defaults to one year from `now` (keep it under a year). */
function securityTxt(site, siteUrl, now = /* @__PURE__ */ new Date()) {
	const t = site.security?.txt;
	const contacts = (t?.contact ?? []).map((c) => c.includes(":") ? c : c.includes("@") ? `mailto:${c}` : c).filter(Boolean);
	if (!contacts.length) return null;
	const base = origin(site.identity?.url || siteUrl);
	const expires = isoDate(t?.expires) ?? new Date(now.getTime() + 31536e6).toISOString().replace(/\.\d{3}Z$/, ".000Z");
	return `${[
		...contacts.map((c) => `Contact: ${c}`),
		`Expires: ${expires}`,
		t?.encryption && `Encryption: ${t.encryption}`,
		t?.acknowledgments && `Acknowledgments: ${t.acknowledgments}`,
		t?.policy && `Policy: ${t.policy}`,
		t?.hiring && `Hiring: ${t.hiring}`,
		t?.preferredLanguages && `Preferred-Languages: ${t.preferredLanguages}`,
		base && `Canonical: ${base}/.well-known/security.txt`
	].filter(Boolean).join("\n")}\n`;
}
/** ads.txt / app-ads.txt: "domain, publisher id, DIRECT|RESELLER[, cert id]" one per line. */
const adsTxt = (lines) => lines?.length ? `${lines.map((l) => l.trim()).filter(Boolean).join("\n")}\n` : null;
function indexNowKey() {
	const bytes = /* @__PURE__ */ new Uint8Array(16);
	crypto.getRandomValues(bytes);
	return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const indexNowFile = (key) => ({
	path: `/${key}.txt`,
	body: key
});
/** Request for https://api.indexnow.org/indexnow. Up to 10,000 URLs per call, same host only. */
function indexNowRequest(site, siteUrl, urls) {
	const key = site.indexNow?.key;
	const base = origin(site.identity?.url || siteUrl);
	if (!site.indexNow?.enabled || !key || !base) return null;
	const host = new URL(base).host;
	const list = urls.map((u) => absolute(u, base)).filter((u) => u && new URL(u).host === host).slice(0, 1e4);
	if (!list.length) return null;
	return {
		url: "https://api.indexnow.org/indexnow",
		init: {
			method: "POST",
			headers: { "content-type": "application/json; charset=utf-8" },
			body: JSON.stringify({
				host,
				key,
				keyLocation: `${base}/${key}.txt`,
				urlList: list
			})
		}
	};
}
// src/crawl/feeds.ts
function feedItems(feed, pages, limit = 50) {
	const prefix = feed.include;
	return pages.filter((p) => p.indexable && p.canonicalSelf && p.path !== prefix && p.path !== prefix.replace(/\/$/, "") && matchPath(prefix.replace(/\*+$/, ""), p.path)).map((p) => ({
		page: p,
		date: isoDate(p.datePublished ?? p.dateModified ?? p.lastmod)
	})).sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")).slice(0, limit);
}
function feed(site, f, pages, siteUrl) {
	const base = origin(site.identity?.url || siteUrl);
	const title = f.title ?? site.identity?.name ?? "Feed";
	const description = f.description ?? site.identity?.description ?? "";
	const self = absolute(f.path, base) ?? f.path;
	const home = absolute(f.include.replace(/\*+$/, ""), base) ?? base;
	const items = feedItems(f, pages);
	const updated = items.map((i) => i.date).filter(Boolean).sort().pop() ?? void 0;
	const lang = site.identity?.language;
	if (f.format === "json") return `${JSON.stringify({
		version: "https://jsonfeed.org/version/1.1",
		title,
		home_page_url: home,
		feed_url: self,
		description: description || void 0,
		language: lang,
		items: items.map(({ page: p, date }) => ({
			id: p.url,
			url: p.url,
			title: p.pageTitle,
			summary: p.description || void 0,
			image: p.resolved.og.image?.url,
			date_published: date,
			date_modified: isoDate(p.dateModified),
			authors: p.resolved.author ? [{
				name: p.resolved.author.name,
				url: p.resolved.author.url
			}] : void 0,
			tags: p.settings.og?.article?.tags
		}))
	}, null, 2)}\n`;
	if (f.format === "atom") {
		const entries = items.map(({ page: p, date }) => [
			"  <entry>",
			`    <title>${escapeXml(p.pageTitle)}</title>`,
			`    <link href="${escapeXml(p.url)}"/>`,
			`    <id>${escapeXml(p.url)}</id>`,
			`    <updated>${isoDate(p.dateModified) ?? date ?? updated ?? (/* @__PURE__ */ new Date(0)).toISOString()}</updated>`,
			date ? `    <published>${date}</published>` : "",
			p.description ? `    <summary>${escapeXml(p.description)}</summary>` : "",
			p.resolved.author ? `    <author><name>${escapeXml(p.resolved.author.name)}</name></author>` : "",
			"  </entry>"
		].filter(Boolean).join("\n"));
		return `<?xml version="1.0" encoding="utf-8"?>\n<feed xmlns="http://www.w3.org/2005/Atom"${lang ? ` xml:lang="${escapeXml(lang)}"` : ""}>\n  <title>${escapeXml(title)}</title>\n${description ? `  <subtitle>${escapeXml(description)}</subtitle>\n` : ""}  <link href="${escapeXml(home)}"/>\n  <link rel="self" href="${escapeXml(self)}"/>\n  <id>${escapeXml(self)}</id>\n  <updated>${updated ?? (/* @__PURE__ */ new Date(0)).toISOString()}</updated>\n  <author><name>${escapeXml(site.organization?.name ?? title)}</name></author>\n${entries.join("\n")}\n</feed>\n`;
	}
	const rssItems = items.map(({ page: p, date }) => [
		"    <item>",
		`      <title>${escapeXml(p.pageTitle)}</title>`,
		`      <link>${escapeXml(p.url)}</link>`,
		`      <guid isPermaLink="true">${escapeXml(p.url)}</guid>`,
		date ? `      <pubDate>${new Date(date).toUTCString()}</pubDate>` : "",
		p.description ? `      <description>${escapeXml(p.description)}</description>` : "",
		p.resolved.author ? `      <dc:creator>${escapeXml(p.resolved.author.name)}</dc:creator>` : "",
		...(p.settings.og?.article?.tags ?? []).map((t) => `      <category>${escapeXml(t)}</category>`),
		"    </item>"
	].filter(Boolean).join("\n"));
	return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">\n  <channel>\n    <title>${escapeXml(title)}</title>\n    <link>${escapeXml(home)}</link>\n    <description>${escapeXml(description || title)}</description>\n${lang ? `    <language>${escapeXml(lang)}</language>\n` : ""}    <atom:link href="${escapeXml(self)}" rel="self" type="application/rss+xml"/>\n${updated ? `    <lastBuildDate>${new Date(updated).toUTCString()}</lastBuildDate>\n` : ""}${rssItems.join("\n")}\n  </channel>\n</rss>\n`;
}
const feedType = (f) => f.format === "atom" ? "application/atom+xml" : f.format === "json" ? "application/feed+json" : "application/rss+xml";
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
/** Astro `redirects` config. Dynamic segments ([slug]) pass through unchanged. */
const toAstro = (rules) => Object.fromEntries(rules.map((r) => [r.from, {
	status: r.status,
	destination: r.to
}]));
/** Netlify / Cloudflare Pages `_redirects`. */
const toRedirectsFile = (rules) => `${rules.map((r) => `${r.from} ${r.to} ${r.status}`).join("\n")}\n`;
const toVercel = (rules) => ({ redirects: rules.map((r) => ({
	source: r.from,
	destination: r.to,
	permanent: r.status === 301 || r.status === 308,
	statusCode: r.status
})) });
const toNginx = (rules) => `${rules.filter((r) => !r.from.includes("*") && !r.from.includes("[")).map((r) => `location = ${r.from} { return ${r.status} ${r.to}; }`).join("\n")}\n`;
// src/edge/headers.ts
function securityHeaders(site) {
	const h = site.security?.headers ?? {};
	if (h.enabled === false) return {};
	const out = {
		"X-Content-Type-Options": "nosniff",
		"Referrer-Policy": h.referrerPolicy ?? "strict-origin-when-cross-origin",
		"Permissions-Policy": h.permissionsPolicy ?? "camera=(), microphone=(), geolocation=()"
	};
	if (h.frameOptions !== "") out["X-Frame-Options"] = h.frameOptions ?? "SAMEORIGIN";
	if (h.hsts) out["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload";
	if (h.csp) out["Content-Security-Policy"] = h.csp;
	return out;
}
/** Headers for every response. Staging (indexable: false) gets X-Robots-Tag: noindex everywhere, incl. PDFs. */
function siteHeaders(site) {
	const out = { ...securityHeaders(site) };
	if (site.robots?.indexable === false || site.robots?.preset === "closed") out["X-Robots-Tag"] = "noindex, nofollow";
	if (site.robots?.contentUsage) out["Content-Usage"] = site.robots.contentUsage;
	return out;
}
function headersFile(site, pages = []) {
	const blocks = [];
	const all = siteHeaders(site);
	if (Object.keys(all).length) blocks.push(`/*\n${Object.entries(all).map(([k, v]) => `  ${k}: ${v}`).join("\n")}`);
	if (site.llms?.markdownPages !== false && site.llms?.enabled !== false) {
		for (const p of pages) if (p.url && p.indexable) blocks.push(`${markdownPath(p.path)}\n  Link: <${p.url}>; rel="canonical"\n  X-Robots-Tag: noindex`);
	}
	blocks.push("/llms.txt\n  Content-Type: text/plain; charset=utf-8", "/llms-full.txt\n  Content-Type: text/plain; charset=utf-8");
	return `${blocks.join("\n\n")}\n`;
}
// src/crawl/index.ts
const text = "text/plain; charset=utf-8";
function siteFiles({ site, pages, siteUrl, now }) {
	const out = [{
		path: "/robots.txt",
		type: text,
		body: robotsTxt(site, siteUrl)
	}, ...sitemaps(site, pages, siteUrl)];
	if (site.llms?.enabled !== false) {
		out.push({
			path: "/llms.txt",
			type: text,
			body: llmsTxt(site, pages)
		});
		if (site.llms?.full) out.push({
			path: "/llms-full.txt",
			type: text,
			body: llmsFullTxt(site, pages)
		});
		if (site.llms?.markdownPages !== false) {
			for (const p of pages) if (p.markdown && inLlms(p, site)) out.push({
				path: markdownPath(p.path),
				type: "text/markdown; charset=utf-8",
				body: p.markdown
			});
		}
	}
	if (site.manifest?.enabled) out.push({
		path: "/site.webmanifest",
		type: "application/manifest+json",
		body: webManifest(site)
	});
	const sec = securityTxt(site, siteUrl, now);
	if (sec) out.push({
		path: "/.well-known/security.txt",
		type: text,
		body: sec
	});
	const ads = adsTxt(site.ads?.adsTxt);
	if (ads) out.push({
		path: "/ads.txt",
		type: text,
		body: ads
	});
	const appAds = adsTxt(site.ads?.appAdsTxt);
	if (appAds) out.push({
		path: "/app-ads.txt",
		type: text,
		body: appAds
	});
	for (const f of site.feeds ?? []) out.push({
		path: f.path,
		type: `${feedType(f)}; charset=utf-8`,
		body: feed(site, f, pages, siteUrl)
	});
	if (site.indexNow?.enabled && site.indexNow.key) out.push({
		...indexNowFile(site.indexNow.key),
		type: text
	});
	if (site.security?.headers?.enabled) out.push({
		path: "/_headers",
		type: text,
		body: headersFile(site, pages)
	});
	return out;
}
// src/consent/consent.ts
const CONSENT_KEY = "u1-consent";
const DEFAULT_TEXT = {
	title: "Cookies",
	message: "We use cookies to understand how the site is used and to improve it. You can accept all, reject non-essential, or choose.",
	accept: "Accept all",
	reject: "Reject non-essential",
	customize: "Choose",
	save: "Save choices",
	necessary: "Necessary",
	analytics: "Analytics",
	marketing: "Marketing",
	preferences: "Preferences",
	policy: "Privacy policy"
};
const js$3 = (v) => JSON.stringify(v).replace(/</g, "\\u003c");
/** Runs before any tag: Consent Mode defaults, then the stored choice re-applied synchronously. */
function consentHead(site) {
	const c = site.consent ?? {};
	const version = c.version ?? "1";
	const google = c.googleConsentMode !== false;
	const denied = {
		ad_storage: "denied",
		ad_user_data: "denied",
		ad_personalization: "denied",
		analytics_storage: "denied",
		functionality_storage: "denied",
		personalization_storage: "denied",
		security_storage: "granted"
	};
	const granted = Object.fromEntries(Object.keys(denied).map((k) => [k, "granted"]));
	const defaults = c.regions?.length ? `gtag('consent','default',${js$3(granted)});gtag('consent','default',${js$3({
		...denied,
		region: c.regions,
		wait_for_update: 500
	})});` : `gtag('consent','default',${js$3({
		...denied,
		wait_for_update: 500
	})});`;
	return `<script>(function(){window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}window.gtag=window.gtag||gtag;${google ? `${defaults}gtag('set','ads_data_redaction',true);gtag('set','url_passthrough',true);` : ""}try{var s=JSON.parse(localStorage.getItem(${js$3(CONSENT_KEY)})||'null');if(s&&s.v===${js$3(version)}&&s.exp>Date.now()){window.__u1consent=s.c;${google ? `gtag('consent','update',{analytics_storage:s.c.analytics?'granted':'denied',ad_storage:s.c.marketing?'granted':'denied',ad_user_data:s.c.marketing?'granted':'denied',ad_personalization:s.c.marketing?'granted':'denied',functionality_storage:s.c.preferences?'granted':'denied',personalization_storage:s.c.preferences?'granted':'denied'});` : ""}}}catch(e){}})();<\/script>\n`;
}
/** Banner, dialog and the activator for held-back scripts. */
function consentBody(site) {
	const c = site.consent ?? {};
	const text = {
		...DEFAULT_TEXT,
		...Object.fromEntries(Object.entries(c.text ?? {}).filter(([, v]) => v))
	};
	const used = new Set((site.tags ?? []).filter((t) => t.enabled !== false).map((t) => t.consent).filter(Boolean));
	const categories = [
		"analytics",
		"marketing",
		"preferences"
	].filter((k) => used.has(k) || k !== "preferences");
	const cfg = {
		key: CONSENT_KEY,
		v: c.version ?? "1",
		days: c.expiryDays ?? 180,
		gpc: c.respectGpc !== false,
		google: c.googleConsentMode !== false,
		pos: c.position ?? "bottom",
		policy: c.policyUrl ?? site.legal?.cookies ?? site.legal?.privacy ?? "",
		cats: categories,
		t: Object.fromEntries(Object.entries(text).map(([k, v]) => [k, escapeHtml(String(v))]))
	};
	return `<script>${RUNTIME$1.replace("__CFG__", js$3(cfg))}<\/script>\n`;
}
const RUNTIME$1 = `(function(){var C=__CFG__,d=document,w=window;
function load(){try{var s=JSON.parse(localStorage.getItem(C.key)||'null');if(s&&s.v===C.v&&s.exp>Date.now())return s.c}catch(e){}return null}
function gpc(){return C.gpc&&navigator.globalPrivacyControl===true}
function activate(c){d.querySelectorAll('script[type="text/plain"][data-u1-consent]').forEach(function(old){var k=old.getAttribute('data-u1-consent');if(!c[k])return;var s=d.createElement('script');for(var i=0;i<old.attributes.length;i++){var a=old.attributes[i];if(a.name!=='type'&&a.name!=='data-u1-consent'&&a.name!=='data-u1-type')s.setAttribute(a.name,a.value)}var m=old.getAttribute('data-u1-type');if(m)s.type=m;s.text=old.text;old.parentNode.replaceChild(s,old)})}
function google(c){if(!C.google||!w.gtag)return;var g=function(b){return b?'granted':'denied'};w.gtag('consent','update',{analytics_storage:g(c.analytics),ad_storage:g(c.marketing),ad_user_data:g(c.marketing),ad_personalization:g(c.marketing),functionality_storage:g(c.preferences),personalization_storage:g(c.preferences)})}
function save(c){c.necessary=true;if(gpc()&&c.marketing&&!c.__explicit)c.marketing=false;delete c.__explicit;try{localStorage.setItem(C.key,JSON.stringify({v:C.v,c:c,t:Date.now(),exp:Date.now()+C.days*864e5}))}catch(e){}w.__u1consent=c;google(c);activate(c);hide();try{w.dispatchEvent(new CustomEvent('u1:consent',{detail:c}))}catch(e){}}
var root;function hide(){if(root){root.remove();root=null}}
function all(v){var c={};C.cats.forEach(function(k){c[k]=v});return c}
function css(){return '.u1c{position:fixed;z-index:2147483000;font:14px/1.45 system-ui,sans-serif;color:#111;background:#fff;border:1px solid #0002;border-radius:12px;box-shadow:0 8px 30px #0003;padding:16px;max-width:440px;box-sizing:border-box}.u1c *{box-sizing:border-box}.u1c[data-pos=bottom]{left:50%;transform:translateX(-50%);bottom:16px;width:calc(100% - 32px);max-width:640px}.u1c[data-pos=bottom-left]{left:16px;bottom:16px;width:calc(100% - 32px)}.u1c[data-pos=bottom-right]{right:16px;bottom:16px;width:calc(100% - 32px)}.u1c h2{font-size:15px;margin:0 0 6px}.u1c p{margin:0 0 12px}.u1c a{color:inherit}.u1c .r{display:flex;flex-wrap:wrap;gap:8px}.u1c button{font:inherit;cursor:pointer;border-radius:8px;padding:8px 12px;border:1px solid #0003;background:#fff;color:#111}.u1c button.p{background:#111;color:#fff;border-color:#111}.u1c label{display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-top:1px solid #0001}.u1c fieldset{border:0;padding:0;margin:0 0 12px}@media (prefers-color-scheme:dark){.u1c{background:#1b1b1b;color:#eee;border-color:#fff2}.u1c button{background:#1b1b1b;color:#eee;border-color:#fff3}.u1c button.p{background:#eee;color:#111}}'}
function show(prefs){hide();var cur=load()||all(false);root=d.createElement('div');root.className='u1c';root.setAttribute('role','dialog');root.setAttribute('aria-label',C.t.title);root.setAttribute('data-pos',C.pos);var T=C.t;var h='<style>'+css()+'</style><h2>'+T.title+'</h2><p>'+T.message+(C.policy?' <a href="'+C.policy.replace(/"/g,'&quot;')+'">'+T.policy+'</a>':'')+'</p>';
if(prefs){h+='<fieldset><label>'+T.necessary+'<input type="checkbox" checked disabled></label>';C.cats.forEach(function(k){h+='<label>'+T[k]+'<input type="checkbox" data-k="'+k+'"'+(cur[k]?' checked':'')+'></label>'});h+='</fieldset><div class="r"><button class="p" data-a="save">'+T.save+'</button><button data-a="accept">'+T.accept+'</button></div>'}
else h+='<div class="r"><button class="p" data-a="accept">'+T.accept+'</button><button data-a="reject">'+T.reject+'</button><button data-a="prefs">'+T.customize+'</button></div>';
root.innerHTML=h;root.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('[data-a]');if(!a)return;var k=a.getAttribute('data-a');if(k==='accept')save(all(true));else if(k==='reject')save(all(false));else if(k==='prefs')show(true);else if(k==='save'){var c=all(false);root.querySelectorAll('input[data-k]').forEach(function(i){c[i.getAttribute('data-k')]=i.checked});c.__explicit=true;save(c)}});d.body.appendChild(root);var f=root.querySelector('button');if(f&&prefs)f.focus()}
w.u1consent={get:load,open:function(){show(true)},set:function(c){c.__explicit=true;save(c)},reset:function(){try{localStorage.removeItem(C.key)}catch(e){}show(false)}};
d.addEventListener('click',function(e){var t=e.target.closest&&e.target.closest('[data-u1-consent-open],a[href="#cookie-settings"]');if(t){e.preventDefault();show(true)}});
var s=load();if(s){activate(s)}else{if(gpc()){var g=all(false);activate(g)}show(false)}})();`;
// src/consent/triggers.ts
const js$2 = (v) => JSON.stringify(v).replace(/</g, "\\u003c");
/** Page variables, pushed before the tag manager so its first tags already see them. */
function dataLayerHead(page) {
	const entries = Object.entries(page?.dataLayer ?? {});
	if (!entries.length) return "";
	return `<script>window.dataLayer=window.dataLayer||[];window.dataLayer.push(${js$2(Object.fromEntries(entries))});<\/script>\n`;
}
/** Runtime for the site's triggers. Empty when there are none. */
function triggersBody(site) {
	const triggers = (site.tagManager?.triggers ?? []).filter((t) => t.name && t.selector && [
		"click",
		"submit",
		"view"
	].includes(t.on));
	if (!triggers.length) return "";
	const cfg = triggers.map((t) => ({
		name: t.name,
		on: t.on,
		selector: t.selector,
		params: t.params ?? {}
	}));
	return `<script>${RUNTIME.replace("__TRIGGERS__", js$2(cfg))}<\/script>\n`;
}
const RUNTIME = `(function(){var T=__TRIGGERS__;window.dataLayer=window.dataLayer||[];
function push(t,extra){var o={event:t.name};for(var k in t.params)o[k]=t.params[k];if(extra)for(var j in extra)o[j]=extra[j];window.dataLayer.push(o)}
T.forEach(function(t){
  if(t.on==='click')document.addEventListener('click',function(e){var el=e.target&&e.target.closest&&e.target.closest(t.selector);if(el)push(t,{element_text:(el.textContent||'').trim().slice(0,100)})},true);
  else if(t.on==='submit')document.addEventListener('submit',function(e){if(e.target&&e.target.matches&&e.target.matches(t.selector))push(t,{form_id:e.target.id||''})},true);
  else if(t.on==='view'&&'IntersectionObserver' in window){
    var io=new IntersectionObserver(function(es){es.forEach(function(x){if(x.isIntersecting){push(t);io.unobserve(x.target)}})},{threshold:0.5});
    document.querySelectorAll(t.selector).forEach(function(el){io.observe(el)});
  }
});})();`;
// src/consent/tags.ts
const TAG_PRESETS = [
	{
		kind: "gtm",
		label: "Google Tag Manager",
		valueLabel: "Container ID",
		placeholder: "GTM-XXXXXXX",
		pattern: /^GTM-[A-Z0-9]+$/,
		consent: "analytics",
		google: true
	},
	{
		kind: "ga4",
		label: "Google Analytics 4",
		valueLabel: "Measurement ID",
		placeholder: "G-XXXXXXXXXX",
		pattern: /^G-[A-Z0-9]+$/,
		consent: "analytics",
		google: true,
		help: "Skip if GA4 already runs through Tag Manager."
	},
	{
		kind: "meta",
		label: "Meta Pixel",
		valueLabel: "Pixel ID",
		placeholder: "123456789012345",
		pattern: /^\d{10,20}$/,
		consent: "marketing"
	},
	{
		kind: "linkedin",
		label: "LinkedIn Insight Tag",
		valueLabel: "Partner ID",
		placeholder: "1234567",
		pattern: /^\d+$/,
		consent: "marketing"
	},
	{
		kind: "tiktok",
		label: "TikTok Pixel",
		valueLabel: "Pixel ID",
		placeholder: "CXXXXXXXXXXXXXXXXXXX",
		consent: "marketing"
	},
	{
		kind: "clarity",
		label: "Microsoft Clarity",
		valueLabel: "Project ID",
		placeholder: "abcd1234ef",
		consent: "analytics"
	},
	{
		kind: "hotjar",
		label: "Hotjar",
		valueLabel: "Site ID",
		placeholder: "1234567",
		pattern: /^\d+$/,
		consent: "analytics"
	},
	{
		kind: "plausible",
		label: "Plausible",
		valueLabel: "Domain",
		placeholder: "example.com",
		consent: "necessary",
		help: "Cookieless; usually needs no consent. Paste your pa-….js script URL in Source if your account uses one."
	},
	{
		kind: "fathom",
		label: "Fathom",
		valueLabel: "Site ID",
		placeholder: "ABCDEFGH",
		consent: "necessary",
		help: "Cookieless; usually needs no consent."
	},
	{
		kind: "umami",
		label: "Umami",
		valueLabel: "Website ID",
		placeholder: "uuid",
		consent: "necessary",
		help: "Cookieless; usually needs no consent."
	},
	{
		kind: "custom",
		label: "Custom HTML",
		valueLabel: "Name",
		placeholder: "Chat widget",
		consent: "marketing"
	}
];
const tagPreset = (kind) => TAG_PRESETS.find((p) => p.kind === kind);
const js$1 = (s) => JSON.stringify(s).replace(/</g, "\\u003c");
function snippet(t) {
	const v = (t.value ?? "").trim();
	switch (t.kind) {
		case "gtm": {
			const host = t.serverUrl?.trim().replace(/\/+$/, "") || "https://www.googletagmanager.com";
			return {
				head: `<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=${js$1(`${host}/gtm.js?id=`)}+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer',${js$1(v)});<\/script>`,
				bodyStart: `<noscript><iframe src="${escapeHtml(host)}/ns.html?id=${encodeURIComponent(v)}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>`
			};
		}
		case "ga4": return { head: `<script async src="https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(v)}"><\/script>\n<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config',${js$1(v)});<\/script>` };
		case "meta": return { head: `<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init',${js$1(v)});fbq('track','PageView');<\/script>` };
		case "linkedin": return { bodyEnd: `<script>window._linkedin_partner_id=${js$1(v)};window._linkedin_data_partner_ids=window._linkedin_data_partner_ids||[];window._linkedin_data_partner_ids.push(window._linkedin_partner_id);(function(l){if(!l){window.lintrk=function(a,b){window.lintrk.q.push([a,b])};window.lintrk.q=[]}var s=document.getElementsByTagName("script")[0];var b=document.createElement("script");b.type="text/javascript";b.async=true;b.src="https://snap.licdn.com/li.lms-analytics/insight.min.js";s.parentNode.insertBefore(b,s);})(window.lintrk);<\/script>` };
		case "tiktok": return { head: `<script>!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=r;ttq._t=ttq._t||{};ttq._t[e]=+new Date;ttq._o=ttq._o||{};ttq._o[e]=n||{};var o=d.createElement("script");o.type="text/javascript";o.async=!0;o.src=r+"?sdkid="+e+"&lib="+t;var a=d.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load(${js$1(v)});ttq.page();}(window,document,'ttq');<\/script>` };
		case "clarity": return { head: `<script>(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script",${js$1(v)});<\/script>` };
		case "hotjar": return { head: `<script>(function(h,o,t,j,a,r){h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};h._hjSettings={hjid:${Number(v) || 0},hjsv:6};a=o.getElementsByTagName('head')[0];r=o.createElement('script');r.async=1;r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;a.appendChild(r);})(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');<\/script>` };
		case "plausible": return t.src ? { head: `<script async src="${escapeHtml(t.src)}"><\/script>\n<script>window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};plausible.init();<\/script>` } : { head: `<script defer data-domain="${escapeHtml(v)}" src="https://plausible.io/js/script.js"><\/script>` };
		case "fathom": return { head: `<script src="${escapeHtml(t.src || "https://cdn.usefathom.com/script.js")}" data-site="${escapeHtml(v)}" defer><\/script>` };
		case "umami": return t.src ? { head: `<script defer src="${escapeHtml(t.src)}" data-website-id="${escapeHtml(v)}"><\/script>` } : {};
		case "custom": return { [t.placement === "head" ? "head" : t.placement === "body-start" ? "bodyStart" : "bodyEnd"]: t.html ?? "" };
	}
}
/** Turns runnable scripts into inert ones the consent runtime activates later. */
function hold(html, category) {
	return html.replace(/<script\b([^>]*)>/gi, (all, attrs) => {
		const type = /\stype\s*=\s*["']?([^"'\s>]+)/i.exec(attrs)?.[1]?.toLowerCase();
		if (type && type !== "text/javascript" && type !== "module" && type !== "application/javascript") return all;
		const rest = attrs.replace(/\stype\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/i, "");
		return `<script type="text/plain" data-u1-consent="${category}"${type === "module" ? " data-u1-type=\"module\"" : ""}${rest}>`;
	});
}
/** Prefix match on the page path. `exclude` wins; no rules = every page. */
function tagApplies(paths, path) {
	if (!paths || path === void 0) return true;
	const clean = (p) => p.replace(/\/+$/, "") || "/";
	const hit = (list) => (list ?? []).some((p) => clean(p) === "/" || path === clean(p) || path.startsWith(`${clean(p)}/`));
	if (hit(paths.exclude)) return false;
	return !paths.include?.length || hit(paths.include);
}
function renderTags(site, ctx = {}) {
	const consent = site.consent ?? {};
	const consentOn = consent.enabled === true;
	const googleAdvanced = consentOn && consent.googleConsentMode !== false && (consent.googleMode ?? "advanced") === "advanced";
	const out = {
		head: "",
		bodyStart: "",
		bodyEnd: ""
	};
	for (const t of site.tags ?? []) {
		if (t.enabled === false || !t.value?.trim() && t.kind !== "custom" && !t.src) continue;
		if (!tagApplies(t.paths, ctx.path)) continue;
		const preset = tagPreset(t.kind);
		const category = t.consent ?? preset.consent;
		const placed = snippet(t);
		const gated = consentOn && category !== "necessary" && !(preset.google && googleAdvanced);
		for (const k of [
			"head",
			"bodyStart",
			"bodyEnd"
		]) {
			const html = placed[k];
			if (!html) continue;
			const label = `<!-- ${escapeHtml(t.label ?? preset.label).replace(/--/g, "—")} -->`;
			out[k] += `${label}\n${gated ? hold(html, category) : html}\n`;
		}
	}
	return {
		headStart: (consentOn ? consentHead(site) : "") + dataLayerHead(ctx.page) + out.head,
		headEnd: "",
		bodyStart: out.bodyStart,
		bodyEnd: out.bodyEnd + triggersBody(site) + (consentOn ? consentBody(site) : "")
	};
}
// src/announce/client.ts
function announceClient(cfg) {
	const w = window;
	const d = document;
	if (w.__u1a && !cfg.preview) return;
	w.__u1a = 1;
	if (!cfg.preview && w.self !== w.top) return;
	const NS = "u1a:";
	const now = Date.now();
	const get = (k) => {
		try {
			return JSON.parse(localStorage.getItem(NS + k) || "null");
		} catch (e) {
			return null;
		}
	};
	const put = (k, v) => {
		try {
			localStorage.setItem(NS + k, JSON.stringify(v));
		} catch (e) {}
	};
	const sessGet = (k) => {
		try {
			return sessionStorage.getItem(NS + k);
		} catch (e) {
			return null;
		}
	};
	const sessSet = (k) => {
		try {
			sessionStorage.setItem(NS + k, "1");
		} catch (e) {}
	};
	const lang = (cfg.lang || d.documentElement.lang || "").toLowerCase().split("-")[0];
	const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
		"&": "&amp;",
		"<": "&lt;",
		">": "&gt;",
		"\"": "&quot;",
		"'": "&#39;"
	})[c]);
	const safeUrl = (u) => /^(https?:|mailto:|tel:|\/|#|\.)/i.test(u || "") ? u : "#";
	const rich = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, t, u) => `<a href="${esc(safeUrl(u))}">${t}</a>`).replace(/\n/g, "<br>");
	const text = (a, k) => {
		const t = (a.translations || {})[lang] || {};
		if (t[k]) return t[k];
		return k === "ctaLabel" ? a.cta ? a.cta.label : "" : a[k] || "";
	};
	const glob = (p) => new RegExp(`^${p.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}/?$`);
	const path = location.pathname;
	const bare = lang && path.indexOf(`/${lang}/`) === 0 ? path.slice(lang.length + 1) : path === `/${lang}` ? "/" : path;
	const onPage = (a) => {
		const p = a.pages || {
			mode: "all",
			paths: []
		};
		if (p.mode === "all") return true;
		const hit = (p.paths || []).some((x) => {
			const r = glob(x.trim());
			return r.test(path) || r.test(bare);
		});
		return p.mode === "only" ? hit : !hit;
	};
	const live = (a) => (!a.startsAt || Date.parse(a.startsAt) <= now) && (!a.endsAt || Date.parse(a.endsAt) > now);
	const rec = (a) => {
		const r = get(a.id);
		return r && r.v === a.version ? r : { v: a.version };
	};
	const due = (a) => {
		const r = rec(a);
		const f = a.frequency || { mode: "until-closed" };
		if (f.mode === "always") return true;
		if (f.mode === "session") return !sessGet(a.id);
		if (f.mode === "once") return !r.seen;
		if (f.mode === "days") return !r.seen || now - r.seen > (f.days || 1) * 864e5;
		return !r.closed;
	};
	const mark = (a, field) => {
		if (cfg.preview) return;
		const r = rec(a);
		r[field] = Date.now();
		put(a.id, r);
		if (field === "seen") sessSet(a.id);
	};
	const track = (a, type) => {
		if (cfg.preview) return;
		(w.dataLayer = w.dataLayer || []).push({
			event: `u1_announcement_${type}`,
			announcement_id: a.id,
			announcement_name: a.name,
			announcement_kind: a.kind
		});
		if (cfg.api && cfg.key) fetch(`${cfg.api}/public/v1/announcements/${a.id}/events`, {
			method: "POST",
			keepalive: true,
			headers: {
				"content-type": "application/json",
				"x-site-key": cfg.key
			},
			body: JSON.stringify({ type })
		}).catch(() => {});
	};
	const TONES = {
		brand: ["var(--u1a-accent, #4f46e5)", "#fff"],
		dark: ["#111827", "#f9fafb"],
		light: ["#ffffff", "#111827"]
	};
	const colors = (a) => {
		const ap = a.appearance || {};
		const t = ap.tone === "custom" ? [ap.background || "#111827", ap.color || "#ffffff"] : TONES[ap.tone] || TONES.brand;
		const accent = ap.accent || (ap.tone === "brand" ? t[1] : "var(--u1a-accent, #4f46e5)");
		const accentFg = ap.accent || ap.tone !== "brand" ? "#fff" : t[0];
		return `--bg:var(--u1a-bg, ${t[0]});--fg:var(--u1a-fg, ${t[1]});--ac:${accent};--acfg:${accentFg};`;
	};
	const CSS = `:host{all:initial;font-family:var(--u1a-font,inherit)}*{box-sizing:border-box}
.w{font-family:inherit;color:var(--fg);-webkit-font-smoothing:antialiased;line-height:1.45}
a{color:inherit;text-decoration:underline;text-underline-offset:2px}
.x{appearance:none;border:0;background:transparent;color:inherit;opacity:.75;cursor:pointer;width:32px;height:32px;border-radius:8px;display:grid;place-items:center;flex:none;padding:0}
.x:hover{opacity:1;background:color-mix(in srgb,currentColor 12%,transparent)}.x:focus-visible,.b:focus-visible{outline:2px solid currentColor;outline-offset:2px}
.x svg{width:16px;height:16px}
.b{display:inline-flex;align-items:center;justify-content:center;gap:6px;border:0;cursor:pointer;font:inherit;font-weight:600;text-decoration:none;background:var(--ac);color:var(--acfg);border-radius:calc(var(--u1a-radius,12px) - 4px);padding:10px 16px;font-size:14px;white-space:nowrap}
.b:hover{filter:brightness(1.08)}
.bar{background:var(--bg);overflow:hidden;max-height:0;transition:max-height .35s ease}
.bar.in{max-height:240px}
.bar .r{display:flex;align-items:center;justify-content:center;gap:12px;padding:9px 12px 9px 16px;font-size:14px;min-height:44px;max-width:1200px;margin:0 auto}
.bar .t{flex:1;text-align:center}.bar .t strong:first-child{margin-right:6px}
.bar .b{padding:6px 12px;font-size:13px}
.ov{position:fixed;inset:0;z-index:2147483000;background:rgba(10,10,15,.55);display:flex;align-items:center;justify-content:center;padding:16px;opacity:0;transition:opacity .2s ease}
.ov.bottom{align-items:flex-end}
.ov.in{opacity:1}
.card{background:var(--bg);border-radius:var(--u1a-radius,16px);box-shadow:0 24px 64px rgba(0,0,0,.28);width:100%;max-width:440px;max-height:calc(100vh - 32px);overflow:auto;position:relative;transform:translateY(12px) scale(.98);transition:transform .25s ease}
.in .card,.toast.in{transform:none}
.card .img{display:block;width:100%;max-height:220px;object-fit:cover;border-radius:var(--u1a-radius,16px) var(--u1a-radius,16px) 0 0}
.card .p{padding:22px 22px 20px}.card h2{margin:0 0 6px;font-size:20px;line-height:1.25;font-weight:700}
.card .t{margin:0;font-size:15px;opacity:.85}.card .a{margin-top:18px;display:flex;gap:8px}.card .a .b{flex:1}
.card>.x{position:absolute;top:8px;right:8px;background:color-mix(in srgb,var(--bg) 70%,transparent)}
.toast{position:fixed;z-index:2147482990;bottom:16px;right:16px;width:min(360px,calc(100vw - 32px));background:var(--bg);border-radius:var(--u1a-radius,14px);box-shadow:0 12px 40px rgba(0,0,0,.22);display:flex;gap:12px;padding:14px 10px 14px 16px;opacity:0;transform:translateY(16px);transition:opacity .25s ease,transform .25s ease}
.toast.left{right:auto;left:16px}.toast.in{opacity:1}
.toast h2{margin:0 0 2px;font-size:15px;font-weight:700}.toast .t{margin:0;font-size:14px;opacity:.85}.toast .b{margin-top:10px;padding:7px 12px;font-size:13px}
.toast .img{width:56px;height:56px;border-radius:10px;object-fit:cover;flex:none}
@media (max-width:520px){.ov{align-items:flex-end;padding:0}.card{max-width:none;border-radius:var(--u1a-radius,16px) var(--u1a-radius,16px) 0 0}}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}`;
	const X = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\"><path d=\"M6 6l12 12M18 6L6 18\"/></svg>";
	const shell = (a) => {
		const host = d.createElement("div");
		host.setAttribute("data-u1-announcement", a.kind);
		const root = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;
		root.innerHTML = `<style>${CSS}</style><div class="w" style="${colors(a)}"></div>`;
		return {
			host,
			box: root.querySelector(".w")
		};
	};
	const cta = (a) => a.cta && a.cta.url ? `<a class="b" data-cta href="${esc(safeUrl(a.cta.url))}"${a.cta.newTab ? " target=\"_blank\" rel=\"noopener\"" : ""}>${esc(text(a, "ctaLabel"))}</a>` : "";
	const wire = (a, el, close) => {
		const c = el.querySelector("[data-cta]");
		if (c) c.addEventListener("click", () => {
			track(a, "click");
			if (a.kind !== "bar") {
				mark(a, "closed");
				close();
			}
		});
		el.querySelectorAll("[data-x]").forEach((x) => x.addEventListener("click", () => {
			track(a, "close");
			mark(a, "closed");
			close();
		}));
	};
	const shown = (a) => {
		mark(a, "seen");
		track(a, "view");
	};
	function bar(a) {
		const { host, box } = shell(a);
		const ap = a.appearance || {};
		const title = text(a, "title");
		box.innerHTML = `<div class="bar" role="region" aria-label="${esc(title || "Announcement")}"><div class="r"><div class="t">${title ? `<strong>${esc(title)}</strong>` : ""}${rich(text(a, "body"))}</div>${cta(a)}${ap.dismissible !== false ? `<button class="x" data-x aria-label="Close">${X}</button>` : ""}</div></div>`;
		const slot = d.querySelector("[data-u1-announcements]");
		if (slot) slot.appendChild(host);
		else d.body.insertBefore(host, d.body.firstChild);
		const el = box.firstChild;
		const html = d.documentElement;
		const size = () => html.style.setProperty("--u1a-bar-height", `${el.offsetHeight}px`);
		const ro = w.ResizeObserver ? new w.ResizeObserver(size) : null;
		if (ro) ro.observe(el);
		requestAnimationFrame(() => {
			el.classList.add("in");
			size();
		});
		wire(a, el, () => {
			el.classList.remove("in");
			html.style.setProperty("--u1a-bar-height", "0px");
			if (ro) ro.disconnect();
			setTimeout(() => host.remove(), 400);
		});
		shown(a);
	}
	let open = false;
	function popup(a) {
		if (open) return;
		open = true;
		const { host, box } = shell(a);
		const pos = (a.appearance || {}).position === "bottom" ? " bottom" : "";
		const title = text(a, "title");
		box.innerHTML = `<div class="ov${pos}"><div class="card" role="dialog" aria-modal="true" aria-label="${esc(title || "Announcement")}" tabindex="-1">${a.image ? `<img class="img" src="${esc(safeUrl(a.image))}" alt="">` : ""}<button class="x" data-x aria-label="Close">${X}</button><div class="p">${title ? `<h2>${esc(title)}</h2>` : ""}<p class="t">${rich(text(a, "body"))}</p>${a.cta && a.cta.url ? `<div class="a">${cta(a)}</div>` : ""}</div></div></div>`;
		d.body.appendChild(host);
		const ov = box.firstChild;
		const card = ov.firstChild;
		const before = d.activeElement;
		const overflow = d.documentElement.style.overflow;
		d.documentElement.style.overflow = "hidden";
		const focusable = () => Array.prototype.slice.call(card.querySelectorAll("a[href],button"));
		const close = () => {
			ov.classList.remove("in");
			d.removeEventListener("keydown", key, true);
			d.documentElement.style.overflow = overflow;
			setTimeout(() => host.remove(), 250);
			if (before && before.focus) before.focus();
			open = false;
		};
		const key = (e) => {
			if (e.key === "Escape") {
				track(a, "close");
				mark(a, "closed");
				close();
			} else if (e.key === "Tab") {
				const f = focusable();
				if (!f.length) return;
				const active = (host.shadowRoot || d).activeElement;
				const first = f[0];
				const last = f[f.length - 1];
				if (e.shiftKey && (active === first || active === card)) {
					e.preventDefault();
					last.focus();
				} else if (!e.shiftKey && active === last) {
					e.preventDefault();
					first.focus();
				}
			}
		};
		d.addEventListener("keydown", key, true);
		ov.addEventListener("click", (e) => {
			if (e.target === ov) {
				track(a, "close");
				mark(a, "closed");
				close();
			}
		});
		wire(a, card, close);
		requestAnimationFrame(() => {
			ov.classList.add("in");
			const f = focusable();
			(f.length > 1 ? f[1] : card).focus({ preventScroll: true });
		});
		shown(a);
	}
	function toast(a) {
		const { host, box } = shell(a);
		const ap = a.appearance || {};
		const title = text(a, "title");
		box.innerHTML = `<div class="toast${ap.position === "bottom-left" ? " left" : ""}" role="status">${a.image ? `<img class="img" src="${esc(safeUrl(a.image))}" alt="">` : ""}<div style="flex:1;min-width:0">${title ? `<h2>${esc(title)}</h2>` : ""}<p class="t">${rich(text(a, "body"))}</p>${cta(a)}</div>${ap.dismissible !== false ? `<button class="x" data-x aria-label="Close">${X}</button>` : ""}</div>`;
		d.body.appendChild(host);
		const el = box.firstChild;
		requestAnimationFrame(() => el.classList.add("in"));
		wire(a, el, () => {
			el.classList.remove("in");
			setTimeout(() => host.remove(), 300);
		});
		shown(a);
	}
	const SHOW = {
		bar,
		popup,
		toast
	};
	function arm(a) {
		const show = () => SHOW[a.kind] && SHOW[a.kind](a);
		const t = a.trigger || { on: "load" };
		if (cfg.preview || t.on === "load" || a.kind === "bar") return show();
		if (t.on === "delay") return void setTimeout(show, Math.max(0, t.seconds || 0) * 1e3);
		if (t.on === "scroll") {
			const at = Math.min(100, Math.max(0, t.percent == null ? 50 : t.percent)) / 100;
			const check = () => {
				const max = d.documentElement.scrollHeight - innerHeight;
				if (max <= 0 || scrollY / max >= at) {
					removeEventListener("scroll", check);
					show();
				}
			};
			addEventListener("scroll", check, { passive: true });
			return check();
		}
		if (t.on === "exit") {
			const leave = (e) => {
				if (e.clientY <= 0 && !e.relatedTarget) {
					d.removeEventListener("mouseout", leave);
					show();
				}
			};
			d.addEventListener("mouseout", leave);
		}
	}
	let ran = false;
	function run(items) {
		if (ran) return;
		ran = true;
		const pick = (items || []).filter((a) => cfg.preview || live(a) && onPage(a) && due(a));
		const seen = {};
		pick.forEach((a) => {
			if (seen[a.kind]) return;
			seen[a.kind] = 1;
			arm(a);
		});
	}
	const start = (fn) => d.readyState === "loading" ? d.addEventListener("DOMContentLoaded", fn) : fn();
	if (cfg.items) return start(() => run(cfg.items));
	if (!cfg.api || !cfg.key) return;
	const cached = get("cache");
	if (cached && now - cached.at < 864e5) start(() => run(cached.items));
	fetch(`${cfg.api}/public/v1/announcements`, { headers: { "x-site-key": cfg.key } }).then((r) => r.ok ? r.json() : null).then((j) => {
		if (!j) return;
		put("cache", {
			at: Date.now(),
			items: j.items
		});
		if (!cached) start(() => run(j.items));
	}).catch(() => {});
}
const js = (v) => JSON.stringify(v).replace(/</g, "\\u003c");
/** The <script> that shows the site's announcements. Empty without an API origin and site key. */
function announceBody(cfg) {
	if (!cfg || (!cfg.api || !cfg.key) && !cfg.items) return "";
	return `<script>(${announceClient.toString()})(${js({
		...cfg,
		api: cfg.api?.replace(/\/+$/, "")
	})});<\/script>\n`;
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
/** Text as Google would show it: cut on a word boundary with "…" once it passes the width. */
function truncateTo(text, fontPx, maxPx) {
	if (textWidth(text, fontPx) <= maxPx) return {
		text,
		cut: false
	};
	const ell = textWidth(" …", fontPx);
	let out = "";
	for (const ch of text) {
		if (textWidth(out + ch, fontPx) + ell > maxPx) break;
		out += ch;
	}
	const word = out.replace(/\s+\S*$/, "");
	return {
		text: `${(word.length > out.length * .6 ? word : out).trimEnd()} …`,
		cut: true
	};
}
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
/** Across all pages: duplicates, sitemap vs noindex, missing basics. */
function checkSite(site, pages) {
	const out = [];
	const by = (key) => {
		const map = /* @__PURE__ */ new Map();
		for (const p of pages) if (p.indexable && p[key]) map.set(p[key], [...map.get(p[key]) ?? [], p.path]);
		for (const [v, paths] of map) if (paths.length > 1) out.push({
			id: `${key}.duplicate`,
			level: "warning",
			group: "search",
			message: `${paths.length} pages share the ${key} "${v.slice(0, 60)}": ${paths.slice(0, 5).join(", ")}`
		});
	};
	by("title");
	by("description");
	if (!site.identity?.url) out.push({
		id: "url.missing",
		level: "error",
		group: "search",
		message: "Site URL is not set.",
		field: "site:identity.url"
	});
	if (!site.identity?.name) out.push({
		id: "name.missing",
		level: "warning",
		group: "search",
		message: "Site name is not set.",
		field: "site:identity.name"
	});
	if (!site.social?.image) out.push({
		id: "og.default",
		level: "info",
		group: "social",
		message: "No default share image.",
		field: "site:social.image"
	});
	if (!site.icons?.favicon && !site.icons?.svg) out.push({
		id: "icons.favicon",
		level: "info",
		group: "tech",
		message: "No favicon set in u1webcore (the page’s own is kept).",
		field: "site:icons.favicon"
	});
	return [...out, ...complianceChecks(site)];
}
/** Privacy and cookie rules that depend on which tags are on. Not legal advice: they flag gaps. */
function complianceChecks(site) {
	const out = [];
	const active = (site.tags ?? []).filter((t) => t.enabled !== false);
	const categoryOf = (t) => t.consent ?? TAG_PRESETS.find((p) => p.kind === t.kind)?.consent ?? "analytics";
	const tracking = active.filter((t) => categoryOf(t) !== "necessary");
	const consentOn = !!site.consent?.enabled;
	if (tracking.length && !site.legal?.privacy) out.push({
		id: "legal.privacy",
		level: "error",
		group: "compliance",
		message: "Tags load but there is no privacy policy URL.",
		field: "site:legal.privacy"
	});
	if (tracking.length && !consentOn) out.push({
		id: "consent.off",
		level: "error",
		group: "compliance",
		message: "Analytics or marketing tags load without a consent banner. Turn consent on.",
		field: "site:consent.enabled"
	});
	if (active.length && !site.legal?.cookies) out.push({
		id: "legal.cookies",
		level: "warning",
		group: "compliance",
		message: "Tags use cookies but there is no cookie policy URL.",
		field: "site:legal.cookies"
	});
	if (active.some((t) => t.kind === "gtm") && consentOn && !site.consent?.googleConsentMode) out.push({
		id: "consent.mode",
		level: "warning",
		group: "compliance",
		message: "Google Tag Manager is on without Google Consent Mode.",
		field: "site:consent.googleConsentMode"
	});
	if (consentOn && !site.consent?.respectGpc) out.push({
		id: "consent.gpc",
		level: "warning",
		group: "compliance",
		message: "Global Privacy Control is not honoured. Turn on respectGpc for US state laws.",
		field: "site:consent.respectGpc"
	});
	if (!site.organization?.email && !site.organization?.telephone) out.push({
		id: "legal.contact",
		level: "warning",
		group: "compliance",
		message: "No contact email or phone for the organization (privacy and consumer rules expect one).",
		field: "site:organization.email"
	});
	if (!site.legal?.terms) out.push({
		id: "legal.terms",
		level: "info",
		group: "compliance",
		message: "No terms page URL set.",
		field: "site:legal.terms"
	});
	return out;
}
// src/aeo/score.ts
const QUESTION = /^(how|what|why|when|where|which|who|can|does|do|is|are|should|will)\b|\?$/i;
function aeoScore({ site, page, resolved: r, analysis: a, now = /* @__PURE__ */ new Date() }) {
	const items = [];
	const add = (i) => items.push(i);
	const summaryWords = wordCount(page.aeo?.summary ?? "");
	const firstPara = (a?.intro ?? "").split(/(?<=[.!?])\s/).slice(0, 2).join(" ");
	add({
		id: "answer",
		label: "Answer first",
		weight: 15,
		field: "aeo.summary",
		pass: summaryWords >= 30 && summaryWords <= 80,
		partial: summaryWords > 0 || wordCount(firstPara) >= 15 && wordCount(firstPara) <= 70,
		tip: "Open with a 40–60 word direct answer to the page’s main question."
	});
	const h = (a?.headings ?? []).filter((x) => x.level >= 2 && x.level <= 3);
	const questions = h.filter((x) => QUESTION.test(x.text)).length;
	add({
		id: "questions",
		label: "Question headings",
		weight: 10,
		pass: questions >= 2,
		partial: questions === 1,
		tip: "Phrase some h2/h3 headings as the questions people ask."
	});
	add({
		id: "structure",
		label: "Clear structure",
		weight: 10,
		pass: (a?.h1.length ?? 0) === 1 && h.length >= 2,
		partial: h.length >= 1,
		tip: "One h1, then sections with h2/h3 headings."
	});
	const stats = (a?.text.match(/\b\d[\d,.]*\s?(%|percent|x|k|m|million|billion|years?|days?|hours?|₹|\$|€|£)/gi) ?? []).length;
	add({
		id: "facts",
		label: "Concrete facts",
		weight: 10,
		pass: stats >= 3,
		partial: stats >= 1,
		tip: "Include specific numbers, dates and measurable claims."
	});
	const host = safeHost(r.siteUrl);
	const outbound = (a?.links ?? []).filter((l) => /^https?:/.test(l.href) && safeHost(l.href) !== host).length;
	const cites = (page.aeo?.citations?.length ?? 0) + outbound;
	add({
		id: "sources",
		label: "Cites sources",
		weight: 10,
		pass: cites >= 2,
		partial: cites === 1,
		tip: "Link to the sources behind your claims (and list them under Citations).",
		field: "aeo.citations"
	});
	const modified = r.dateModified ?? page.sitemap?.lastmod;
	const age = modified ? (now.getTime() - new Date(modified).getTime()) / 864e5 : Infinity;
	add({
		id: "fresh",
		label: "Fresh",
		weight: 10,
		pass: age <= 365,
		partial: age <= 730,
		tip: "Show a last-updated date and keep it current.",
		field: "aeo.dateModified"
	});
	add({
		id: "author",
		label: "Named author",
		weight: 8,
		pass: !!page.aeo?.author?.name && !!(page.aeo.author.url || page.aeo.author.sameAs?.length),
		partial: !!page.aeo?.author?.name || !!site.organization?.name,
		tip: "Name the author with a profile link (expertise signals).",
		field: "aeo.author"
	});
	const entities = [...page.aeo?.about ?? [], ...page.aeo?.mentions ?? []];
	add({
		id: "entities",
		label: "Linked entities",
		weight: 7,
		pass: entities.some((e) => e.sameAs),
		partial: entities.length > 0,
		tip: "Add what the page is about, linked to Wikipedia/Wikidata.",
		field: "aeo.about"
	});
	add({
		id: "faq",
		label: "FAQ",
		weight: 6,
		pass: (page.aeo?.faq?.length ?? 0) >= 3,
		partial: (page.aeo?.faq?.length ?? 0) > 0,
		tip: "Answer 3+ common questions on the page.",
		field: "aeo.faq"
	});
	add({
		id: "schema",
		label: "Structured data",
		weight: 6,
		pass: !!page.schema?.type && page.schema.type !== "WebPage",
		partial: true,
		tip: "Pick the schema type that matches the page.",
		field: "schema.type"
	});
	const words = a?.words ?? 0;
	add({
		id: "depth",
		label: "Depth",
		weight: 4,
		pass: words >= 500,
		partial: words >= 250,
		tip: "Cover the topic fully; very short pages are rarely cited."
	});
	add({
		id: "crawlable",
		label: "AI engines allowed",
		weight: 4,
		pass: !blockedBots(site).filter((b) => b.purpose === "ai-search" || b.purpose === "search").length && r.robots.indexable && !r.robots.directives.nosnippet,
		tip: "Allow AI search crawlers and avoid nosnippet.",
		field: "site:robots.preset"
	});
	const total = items.reduce((s, i) => s + i.weight, 0);
	const got = items.reduce((s, i) => s + (i.pass ? i.weight : i.partial ? i.weight / 2 : 0), 0);
	return {
		score: Math.round(got / total * 100),
		items
	};
}
const safeHost = (u) => {
	try {
		return new URL(u).host;
	} catch {
		return "";
	}
};
// src/shared/spec.ts
const IMAGES = {
	share: {
		size: [1200, 630],
		min: [600, 315],
		formats: "JPG, PNG or WebP, under 5 MB"
	},
	x: {
		size: [1200, 600],
		min: [300, 157],
		formats: "JPG, PNG or WebP, under 5 MB"
	},
	logo: {
		size: [512, 512],
		min: [112, 112],
		anyRatio: true,
		formats: "PNG, SVG or WebP on a plain background"
	},
	schema: {
		size: [1200, 675],
		min: [696, 0],
		anyRatio: true,
		formats: "JPG, PNG or WebP; 16:9, 4:3 or 1:1"
	},
	favicon: {
		size: [48, 48],
		formats: ".ico holding 16, 32 and 48 px"
	},
	svg: { formats: "SVG with a square viewBox" },
	apple: {
		size: [180, 180],
		exact: true,
		formats: "PNG, no transparency"
	},
	icon192: {
		size: [192, 192],
		exact: true,
		formats: "PNG"
	},
	icon512: {
		size: [512, 512],
		exact: true,
		formats: "PNG"
	},
	maskable: {
		size: [512, 512],
		exact: true,
		formats: "PNG; keep the logo inside the centre 80%"
	}
};
/** Checks the loaded image against its spec; returns a warning or null. */
function checkImage(spec, width, height) {
	const [w, h] = spec.size ?? [0, 0];
	if (spec.exact && w && (width !== w || height !== h)) return `Should be exactly ${w} × ${h} px.`;
	if (spec.min && (width < spec.min[0] || height < spec.min[1])) return `Too small: at least ${spec.min[0]}${spec.min[1] ? ` × ${spec.min[1]}` : " px wide"}${spec.min[1] ? " px" : ""}.`;
	if (w && h && !spec.anyRatio && Math.abs(width / height - w / h) > .05 * (w / h)) return `Shape is ${(width / height).toFixed(2)}:1; apps crop to ${(w / h).toFixed(2)}:1.`;
	return null;
}
const FORMATS = {
	url: [/^(https?:\/\/[^\s]+|\/[^\s]*)$/, "Use a full URL (https://…) or a path starting with /."],
	absoluteUrl: [/^https:\/\/[^\s/]+(\/[^\s]*)?$/, "Use a full https:// URL."],
	email: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Not an email address."],
	phone: [/^\+[\d\s().-]{6,}$/, "Use international format, e.g. +91 80 1234 5678."],
	handle: [/^(@?\w{1,15}|https:\/\/(www\.)?(x|twitter)\.com\/\w{1,15})$/, "An X handle such as @accord (up to 15 letters, digits or _)."],
	lang: [/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/, "A language code such as en, en-IN or fr."],
	ogLocale: [/^[a-z]{2,3}_[A-Z]{2}$/, "Language_TERRITORY, e.g. en_US or en_IN."],
	country: [/^[A-Z]{2}$/, "Two capital letters (ISO 3166), e.g. IN."],
	color: [/^#([\da-f]{3}|[\da-f]{6})$/i, "A hex color such as #2d368e."]
};
/** Inline format hint for a typed value; null when it fits (or is empty). */
function checkFormat(format, value) {
	if (typeof value !== "string" || !value) return null;
	const [re, message] = FORMATS[format];
	return re.test(value.trim()) ? null : message;
}
/** A group's fields split into its tabs; a single untitled tab when it has none. */
function tabsOf(fields) {
	const tabs = [];
	for (const f of fields) if (f.tab || !tabs.length) tabs.push({
		label: f.tab ?? "",
		fields: [f]
	});
	else tabs[tabs.length - 1].fields.push(f);
	return tabs;
}
const opts = (...list) => list.map((v) => ({
	value: v,
	label: v
}));
const PAGE_SPEC = [
	{
		id: "search",
		label: "Search",
		help: "How this page appears in search results.",
		fields: [
			{
				key: "title",
				label: "Title",
				type: "text",
				pixels: "title",
				fallback: "pageTitle",
				help: "The site title template is added automatically.",
				chars: [30, 60]
			},
			{
				key: "absoluteTitle",
				label: "Use title as-is",
				type: "boolean",
				help: "Skip the site title template on this page."
			},
			{
				key: "description",
				label: "Description",
				type: "textarea",
				pixels: "description",
				chars: [120, 155],
				fallback: "description"
			},
			{
				key: "canonical",
				label: "Canonical URL",
				type: "url",
				section: "Advanced",
				help: "Only when this page duplicates another URL.",
				fallback: "url",
				format: "url"
			},
			{
				key: "keywords",
				label: "Keywords",
				type: "list",
				help: "Ignored by Google; some site search tools use them."
			}
		]
	},
	{
		id: "social",
		label: "Social",
		help: "What people see when this page is shared.",
		fields: [
			{
				key: "og.title",
				tab: "Share card",
				label: "Share title",
				type: "text",
				fallback: "og.title",
				chars: [30, 90]
			},
			{
				key: "og.description",
				label: "Share description",
				type: "textarea",
				fallback: "og.description",
				chars: [55, 200]
			},
			{
				key: "og.image",
				label: "Share image",
				type: "image",
				fallback: "og.image.url",
				placeholder: "/images/share.jpg",
				image: IMAGES.share
			},
			{
				key: "og.card",
				label: "Use the generated card",
				type: "boolean",
				default: true,
				help: "When the site generates share cards and this page has no image of its own."
			},
			{
				key: "og.imageAlt",
				label: "Image alt text",
				type: "text",
				fallback: "og.image.alt",
				help: "Describes the image for screen readers and when it fails to load.",
				chars: [10, 125]
			},
			{
				key: "og.imageWidth",
				label: "Image width",
				type: "number",
				placeholder: "1200"
			},
			{
				key: "og.imageHeight",
				label: "Image height",
				type: "number",
				placeholder: "630"
			},
			{
				key: "twitter.card",
				tab: "X",
				label: "Card size",
				type: "select",
				help: "Large when there is an image, else small.",
				options: [{
					value: "summary_large_image",
					label: "Large image"
				}, {
					value: "summary",
					label: "Small image"
				}]
			},
			{
				key: "twitter.title",
				label: "Title",
				type: "text",
				fallback: "twitter.title",
				chars: [10, 70]
			},
			{
				key: "twitter.description",
				label: "Description",
				type: "textarea",
				fallback: "twitter.description",
				chars: [50, 200]
			},
			{
				key: "twitter.image",
				label: "Image",
				type: "image",
				fallback: "twitter.image.url",
				image: IMAGES.x,
				help: "Small card: square, at least 144 × 144 px."
			},
			{
				key: "twitter.imageAlt",
				label: "Image alt text",
				type: "text",
				fallback: "twitter.image.alt",
				chars: [10, 125]
			},
			{
				key: "twitter.creator",
				label: "Author on X",
				type: "text",
				placeholder: "@author",
				help: "Credits the writer; defaults to the site’s creator.",
				format: "handle"
			},
			{
				key: "og.type",
				tab: "More",
				label: "Content type",
				type: "select",
				options: opts("website", "article", "profile", "product", "book", "video.other"),
				help: "Article adds published and updated dates from Answers → Author."
			},
			{
				key: "og.locale",
				label: "Locale",
				type: "text",
				placeholder: "ta_IN",
				help: "Only when this page’s language differs from the site’s.",
				format: "ogLocale"
			},
			{
				key: "og.article.author",
				label: "Author profile URL",
				type: "url",
				section: "Article",
				help: "Used when the content type is article. Defaults to the Answers author.",
				format: "url"
			},
			{
				key: "og.article.section",
				label: "Section",
				type: "text",
				placeholder: "Guides"
			},
			{
				key: "og.article.tags",
				label: "Tags",
				type: "list"
			},
			{
				key: "og.product.price",
				label: "Price",
				type: "number",
				section: "Product or listing",
				placeholder: "2500000",
				help: "Shown by Facebook and Pinterest."
			},
			{
				key: "og.product.currency",
				label: "Currency",
				type: "text",
				placeholder: "INR"
			},
			{
				key: "og.video",
				label: "Video URL",
				type: "url",
				section: "Video",
				placeholder: "https://…/tour.mp4",
				help: "Plays inline in Facebook and Discord cards.",
				format: "url"
			},
			{
				key: "twitter.label1",
				label: "Label 1",
				type: "text",
				section: "Extra details",
				placeholder: "Price",
				help: "Slack and X show up to two of these under the card."
			},
			{
				key: "twitter.data1",
				label: "Value 1",
				type: "text",
				placeholder: "₹25 lakh onwards"
			},
			{
				key: "twitter.label2",
				label: "Label 2",
				type: "text",
				placeholder: "Location"
			},
			{
				key: "twitter.data2",
				label: "Value 2",
				type: "text",
				placeholder: "ECR, Chennai"
			},
			{
				key: "og.pinterest",
				label: "Allow saving to Pinterest",
				type: "boolean",
				default: true,
				section: "Pinterest"
			}
		]
	},
	{
		id: "schema",
		label: "Schema",
		help: "Structured data that describes this page to search engines.",
		fields: [
			{
				key: "schema.type",
				label: "Page type",
				type: "schemaType"
			},
			{
				key: "schema.data",
				label: "Details",
				type: "schemaData"
			},
			{
				key: "schema.breadcrumbs",
				label: "Breadcrumbs",
				type: "boolean",
				default: true,
				help: "Built from the URL."
			},
			{
				key: "schema.speakable",
				label: "Speakable selectors",
				type: "list",
				section: "Advanced",
				placeholder: ".summary, h1",
				help: "Parts voice assistants may read aloud."
			},
			{
				key: "schema.extra",
				label: "Custom JSON-LD nodes",
				type: "json"
			}
		]
	},
	{
		id: "location",
		label: "Location",
		help: "A branch with its own address; replaces the site organization on this page.",
		fields: [
			{
				key: "organization.name",
				tab: "Branch",
				label: "Branch name",
				type: "text",
				placeholder: "Accord Hospital, Whitefield"
			},
			{
				key: "organization.type",
				label: "Type",
				type: "select",
				options: opts("Organization", "LocalBusiness", "Hospital", "MedicalClinic", "Dentist", "Store", "Restaurant", "RealEstateAgent")
			},
			{
				key: "organization.telephone",
				label: "Phone",
				type: "text",
				placeholder: "+91 80 1234 5678",
				format: "phone"
			},
			{
				key: "organization.email",
				label: "Email",
				type: "text",
				format: "email"
			},
			{
				key: "organization.address.streetAddress",
				tab: "Address",
				label: "Street",
				type: "text"
			},
			{
				key: "organization.address.addressLocality",
				label: "City",
				type: "text"
			},
			{
				key: "organization.address.addressRegion",
				label: "Region",
				type: "text"
			},
			{
				key: "organization.address.postalCode",
				label: "Postal code",
				type: "text"
			},
			{
				key: "organization.address.addressCountry",
				label: "Country (ISO)",
				type: "text",
				placeholder: "IN",
				format: "country"
			},
			{
				key: "organization.geo.latitude",
				label: "Latitude",
				type: "number"
			},
			{
				key: "organization.geo.longitude",
				label: "Longitude",
				type: "number"
			},
			{
				key: "organization.openingHours",
				tab: "Hours",
				label: "Opening hours",
				type: "list",
				placeholder: "Mo-Sa 08:00-20:00"
			}
		]
	},
	{
		id: "answers",
		label: "Answers",
		help: "What answer engines (AEO/GEO) quote and cite.",
		fields: [
			{
				key: "aeo.summary",
				tab: "Answer",
				label: "Answer summary",
				type: "textarea",
				words: [40, 60],
				help: "A direct answer to the page’s main question. Shown to engines as the page abstract."
			},
			{
				key: "aeo.faq",
				label: "Questions & answers",
				type: "faq",
				help: "Must also be visible on the page."
			},
			{
				key: "aeo.author",
				tab: "Author",
				label: "Author",
				type: "person"
			},
			{
				key: "aeo.datePublished",
				label: "Published",
				type: "date"
			},
			{
				key: "aeo.dateModified",
				label: "Updated",
				type: "date",
				help: "Defaults to the last git change."
			},
			{
				key: "aeo.about",
				tab: "Entities",
				label: "About",
				type: "entities",
				help: "Link to Wikipedia or Wikidata."
			},
			{
				key: "aeo.mentions",
				label: "Mentions",
				type: "entities"
			},
			{
				key: "aeo.citations",
				label: "Citations",
				type: "list",
				placeholder: "https://…"
			}
		]
	},
	{
		id: "indexing",
		label: "Indexing",
		help: "Search visibility, sitemap and llms.txt for this page.",
		fields: [
			{
				key: "robots.index",
				tab: "Robots",
				label: "Show in search results",
				type: "boolean",
				default: true
			},
			{
				key: "robots.follow",
				label: "Follow links",
				type: "boolean",
				default: true
			},
			{
				key: "robots.nosnippet",
				label: "No snippet",
				type: "boolean",
				help: "Also hides the page from AI Overviews."
			},
			{
				key: "robots.noimageindex",
				label: "Keep images out of image search",
				type: "boolean"
			},
			{
				key: "robots.maxSnippet",
				label: "Max snippet length",
				type: "number",
				placeholder: "-1",
				help: "Characters; -1 = no limit, 0 = no snippet."
			},
			{
				key: "robots.maxImagePreview",
				label: "Image preview",
				type: "select",
				default: "large",
				options: opts("large", "standard", "none")
			},
			{
				key: "robots.unavailableAfter",
				label: "Remove from results after",
				type: "date"
			},
			{
				key: "sitemap.include",
				tab: "Sitemap",
				label: "Include in sitemap",
				type: "boolean",
				default: true
			},
			{
				key: "sitemap.lastmod",
				label: "Last modified (override)",
				type: "date"
			},
			{
				key: "llms.include",
				tab: "llms.txt",
				label: "Include in llms.txt",
				type: "boolean",
				default: true
			},
			{
				key: "llms.section",
				label: "Section",
				type: "text",
				placeholder: "Docs, Optional…"
			},
			{
				key: "llms.title",
				label: "Link title",
				type: "text"
			},
			{
				key: "llms.notes",
				label: "Note",
				type: "text"
			}
		]
	}
];
const SITE_SPEC = [
	{
		id: "identity",
		label: "Identity",
		help: "Name, address and defaults for every page.",
		fields: [
			{
				key: "identity.name",
				label: "Site name",
				type: "text"
			},
			{
				key: "identity.url",
				label: "Site URL",
				type: "url",
				placeholder: "https://example.com",
				format: "absoluteUrl"
			},
			{
				key: "identity.alternateName",
				label: "Other names",
				type: "list",
				help: "Acronyms or short names Google may show."
			},
			{
				key: "identity.titleTemplate",
				label: "Title template",
				type: "text",
				placeholder: "%s · Acme",
				help: "%s is replaced by the page title."
			},
			{
				key: "identity.description",
				label: "Default description",
				type: "textarea",
				chars: [120, 155]
			},
			{
				key: "identity.language",
				label: "Language",
				type: "text",
				placeholder: "en",
				section: "Locale",
				format: "lang"
			},
			{
				key: "identity.ogLocale",
				label: "Open Graph locale",
				type: "text",
				placeholder: "en_US",
				format: "ogLocale"
			},
			{
				key: "identity.trailingSlash",
				label: "Trailing slash",
				type: "select",
				default: "ignore",
				options: opts("ignore", "always", "never")
			},
			{
				key: "identity.themeColor",
				label: "Theme color",
				type: "color",
				section: "Browser colors"
			},
			{
				key: "identity.themeColorDark",
				label: "Theme color (dark)",
				type: "color"
			}
		]
	},
	{
		id: "organization",
		label: "Organization",
		help: "Who runs the site; shown in full on the home, about and contact pages.",
		fields: [
			{
				key: "organization.type",
				tab: "Details",
				label: "Type",
				type: "select",
				default: "Organization",
				options: opts("Organization", "Corporation", "LocalBusiness", "ProfessionalService", "Store", "OnlineStore", "Restaurant", "MedicalBusiness", "RealEstateAgent", "EducationalOrganization", "NGO", "Person")
			},
			{
				key: "organization.name",
				label: "Name",
				type: "text"
			},
			{
				key: "organization.legalName",
				label: "Legal name",
				type: "text"
			},
			{
				key: "organization.description",
				label: "Description",
				type: "textarea"
			},
			{
				key: "organization.logo",
				label: "Logo",
				type: "image",
				placeholder: "/logo.png",
				image: IMAGES.logo,
				help: "Google needs at least 112 × 112 px, readable on white."
			},
			{
				key: "organization.email",
				tab: "Contact",
				label: "Email",
				type: "text",
				format: "email"
			},
			{
				key: "organization.telephone",
				label: "Phone",
				type: "text",
				placeholder: "+91 80 1234 5678",
				format: "phone"
			},
			{
				key: "organization.contactPoints",
				label: "Contact points",
				type: "contactPoints"
			},
			{
				key: "organization.address.streetAddress",
				tab: "Address",
				label: "Street",
				type: "text"
			},
			{
				key: "organization.address.addressLocality",
				label: "City",
				type: "text"
			},
			{
				key: "organization.address.addressRegion",
				label: "Region",
				type: "text"
			},
			{
				key: "organization.address.postalCode",
				label: "Postal code",
				type: "text"
			},
			{
				key: "organization.address.addressCountry",
				label: "Country (ISO)",
				type: "text",
				placeholder: "IN",
				format: "country"
			},
			{
				key: "organization.geo.latitude",
				label: "Latitude",
				type: "number"
			},
			{
				key: "organization.geo.longitude",
				label: "Longitude",
				type: "number"
			},
			{
				key: "organization.openingHours",
				tab: "Business",
				label: "Opening hours",
				type: "list",
				placeholder: "Mo-Fr 09:00-18:00"
			},
			{
				key: "organization.areaServed",
				label: "Areas served",
				type: "list"
			},
			{
				key: "organization.priceRange",
				label: "Price range",
				type: "text",
				placeholder: "₹₹"
			},
			{
				key: "organization.foundingDate",
				label: "Founded",
				type: "date"
			},
			{
				key: "organization.numberOfEmployees",
				label: "Employees",
				type: "number"
			},
			{
				key: "organization.founders",
				label: "Founders",
				type: "list"
			},
			{
				key: "organization.identifiers.iso6523Code",
				tab: "Identifiers",
				label: "ISO 6523 code",
				type: "text",
				help: "Preferred by Google, e.g. 0060:123456789."
			},
			{
				key: "organization.identifiers.vatID",
				label: "VAT / GST ID",
				type: "text"
			},
			{
				key: "organization.identifiers.leiCode",
				label: "LEI",
				type: "text"
			},
			{
				key: "organization.identifiers.duns",
				label: "DUNS",
				type: "text"
			}
		]
	},
	{
		id: "social",
		label: "Social",
		help: "Default share card and social profiles.",
		fields: [
			{
				key: "social.image",
				tab: "Share image",
				label: "Default share image",
				type: "image",
				placeholder: "/images/share.jpg",
				help: "For pages without their own image, unless share cards are generated.",
				image: IMAGES.share
			},
			{
				key: "social.imageAlt",
				label: "Image alt text",
				type: "text",
				chars: [10, 125]
			},
			{
				key: "social.imageWidth",
				label: "Width",
				type: "number",
				placeholder: "1200"
			},
			{
				key: "social.imageHeight",
				label: "Height",
				type: "number",
				placeholder: "630"
			},
			{
				key: "social.card.enabled",
				tab: "Generated cards",
				label: "Generate share cards",
				type: "boolean",
				help: "Pages without their own share image get a 1200 × 630 card with their title, site name and domain."
			},
			{
				key: "social.card.background",
				label: "Background",
				type: "color",
				help: "Defaults to the theme color."
			},
			{
				key: "social.card.color",
				label: "Text",
				type: "color",
				help: "Defaults to black or white, whichever reads best."
			},
			{
				key: "social.card.accent",
				label: "Accent",
				type: "color"
			},
			{
				key: "social.twitterSite",
				tab: "Accounts",
				label: "X account",
				type: "text",
				placeholder: "@acme",
				format: "handle"
			},
			{
				key: "social.twitterCreator",
				label: "X creator",
				type: "text",
				format: "handle"
			},
			{
				key: "social.facebookAppId",
				label: "Facebook App ID",
				type: "text",
				help: "For Facebook’s sharing insights."
			},
			{
				key: "social.fediverseCreator",
				label: "Mastodon author",
				type: "text",
				placeholder: "@acme@mastodon.social",
				help: "Credits shared links on Mastodon."
			},
			{
				key: "social.profiles",
				label: "Profiles (sameAs)",
				type: "list",
				placeholder: "https://www.linkedin.com/company/…",
				help: "LinkedIn, X, Instagram, YouTube, Wikipedia, Wikidata…"
			}
		]
	},
	{
		id: "icons",
		label: "Icons & app",
		help: "Favicons, home-screen icons and the web app manifest.",
		fields: [
			{
				key: "icons.favicon",
				tab: "Icons",
				label: "favicon.ico",
				type: "image",
				placeholder: "/favicon.ico",
				image: IMAGES.favicon
			},
			{
				key: "icons.svg",
				label: "SVG icon",
				type: "image",
				placeholder: "/icon.svg",
				image: IMAGES.svg,
				help: "Sharp at any size; modern browsers prefer it."
			},
			{
				key: "icons.appleTouchIcon",
				label: "Apple touch icon",
				type: "image",
				placeholder: "/apple-touch-icon.png",
				image: IMAGES.apple
			},
			{
				key: "icons.icon192",
				label: "Android icon",
				type: "image",
				placeholder: "/icon-192.png",
				image: IMAGES.icon192
			},
			{
				key: "icons.icon512",
				label: "Large icon",
				type: "image",
				placeholder: "/icon-512.png",
				help: "Install prompts and splash screens.",
				image: IMAGES.icon512
			},
			{
				key: "icons.maskable",
				label: "Maskable icon",
				type: "image",
				placeholder: "/icon-maskable.png",
				help: "Android crops it to a circle or squircle.",
				image: IMAGES.maskable
			},
			{
				key: "manifest.enabled",
				tab: "App manifest",
				label: "Publish site.webmanifest",
				type: "boolean"
			},
			{
				key: "manifest.shortName",
				label: "Short name",
				type: "text"
			},
			{
				key: "manifest.display",
				label: "Display",
				type: "select",
				default: "standalone",
				options: opts("standalone", "minimal-ui", "browser", "fullscreen")
			},
			{
				key: "manifest.backgroundColor",
				label: "Background color",
				type: "color"
			}
		]
	},
	{
		id: "verification",
		label: "Verification",
		help: "Ownership codes from webmaster tools.",
		fields: [
			{
				key: "verification.google",
				label: "Google Search Console",
				type: "text"
			},
			{
				key: "verification.bing",
				label: "Bing Webmaster",
				type: "text"
			},
			{
				key: "verification.yandex",
				label: "Yandex",
				type: "text"
			},
			{
				key: "verification.baidu",
				label: "Baidu",
				type: "text"
			},
			{
				key: "verification.naver",
				label: "Naver",
				type: "text"
			},
			{
				key: "verification.pinterest",
				label: "Pinterest",
				type: "text"
			},
			{
				key: "verification.facebook",
				label: "Facebook domain",
				type: "text"
			}
		]
	},
	{
		id: "crawlers",
		label: "Crawlers & AI",
		help: "robots.txt, crawler policy and AI usage signals.",
		fields: [
			{
				key: "robots.indexable",
				tab: "Access",
				label: "Site can be indexed",
				type: "boolean",
				default: true,
				help: "Turn off for staging: noindex everywhere."
			},
			{
				key: "robots.preset",
				label: "Crawler policy",
				type: "select",
				default: "no-training",
				options: Object.entries(PRESETS).map(([value, p]) => ({
					value,
					label: p.label
				}))
			},
			{
				key: "robots.disallow",
				label: "Blocked paths",
				type: "list",
				placeholder: "/admin/"
			},
			{
				key: "robots.rules",
				label: "Custom rules",
				type: "robotsRules"
			},
			{
				key: "robots.defaults.maxSnippet",
				tab: "Snippets",
				label: "Max snippet",
				type: "number",
				placeholder: "-1",
				help: "-1 = no limit, 0 = no snippet."
			},
			{
				key: "robots.defaults.maxImagePreview",
				label: "Image preview",
				type: "select",
				options: opts("large", "standard", "none")
			},
			{
				key: "robots.contentSignals.search",
				tab: "AI signals",
				label: "Search",
				type: "boolean",
				tristate: true
			},
			{
				key: "robots.contentSignals.aiInput",
				label: "AI answers",
				type: "boolean",
				tristate: true
			},
			{
				key: "robots.contentSignals.aiTrain",
				label: "AI training",
				type: "boolean",
				tristate: true,
				help: "Content-Signal line in robots.txt; unset says nothing."
			},
			{
				key: "robots.contentUsage",
				label: "Content-Usage (IETF AIPREF)",
				type: "text",
				placeholder: "train-ai=n"
			}
		]
	},
	{
		id: "files",
		label: "Sitemap & llms.txt",
		help: "Generated discovery files.",
		fields: [
			{
				key: "sitemap.enabled",
				tab: "Sitemap",
				label: "Publish sitemap",
				type: "boolean",
				default: true
			},
			{
				key: "sitemap.images",
				label: "Include images",
				type: "boolean",
				default: true
			},
			{
				key: "sitemap.lastmod",
				label: "Last modified from git",
				type: "boolean",
				default: true
			},
			{
				key: "sitemap.exclude",
				label: "Exclude paths",
				type: "list",
				placeholder: "/drafts/**"
			},
			{
				key: "llms.enabled",
				tab: "llms.txt",
				label: "Publish llms.txt",
				type: "boolean",
				default: true
			},
			{
				key: "llms.full",
				label: "Publish llms-full.txt",
				type: "boolean"
			},
			{
				key: "llms.markdownPages",
				label: "Publish .md copies of pages",
				type: "boolean",
				default: true
			},
			{
				key: "llms.summary",
				label: "Summary",
				type: "textarea",
				help: "One or two sentences; the blockquote under the title.",
				chars: [50, 300]
			},
			{
				key: "llms.details",
				label: "Details",
				type: "textarea"
			},
			{
				key: "llms.sections",
				label: "Extra sections",
				type: "llmsSections"
			},
			{
				key: "indexNow.enabled",
				tab: "IndexNow",
				label: "IndexNow (Bing, Yandex)",
				type: "boolean"
			},
			{
				key: "indexNow.key",
				label: "Key",
				type: "text"
			},
			{
				key: "ads.adsTxt",
				tab: "Ads",
				label: "ads.txt lines",
				type: "list"
			},
			{
				key: "ads.appAdsTxt",
				label: "app-ads.txt lines",
				type: "list"
			}
		]
	},
	{
		id: "languages",
		label: "Languages",
		help: "Locales, hreflang and the default language.",
		fields: [
			{
				key: "languages.locales",
				label: "Locales",
				type: "locales"
			},
			{
				key: "languages.defaultLocale",
				label: "Default locale",
				type: "text",
				format: "lang"
			},
			{
				key: "languages.xDefault",
				label: "x-default locale",
				type: "text",
				format: "lang"
			}
		]
	},
	{
		id: "feeds",
		label: "Feeds",
		help: "RSS, Atom and JSON feeds.",
		fields: [{
			key: "feeds",
			label: "Feeds",
			type: "feeds"
		}]
	},
	{
		id: "redirects",
		label: "Redirects",
		help: "Old URLs and where they go.",
		fields: [{
			key: "redirects",
			label: "Redirects",
			type: "redirects"
		}]
	},
	{
		id: "tags",
		label: "Tags & consent",
		help: "Analytics and marketing tags, and the cookie banner.",
		fields: [
			{
				key: "tags",
				tab: "Tags",
				label: "Tags",
				type: "tags",
				help: `Presets: ${TAG_PRESETS.map((p) => p.label).join(", ")}.`
			},
			{
				key: "consent.enabled",
				tab: "Consent",
				label: "Cookie consent",
				type: "boolean"
			},
			{
				key: "consent.googleConsentMode",
				label: "Google Consent Mode v2",
				type: "boolean",
				default: true
			},
			{
				key: "consent.respectGpc",
				label: "Honor Global Privacy Control",
				type: "boolean",
				default: true
			},
			{
				key: "consent.googleMode",
				label: "Google tags before consent",
				type: "select",
				default: "advanced",
				options: [{
					value: "advanced",
					label: "Load, cookieless pings (advanced)"
				}, {
					value: "basic",
					label: "Wait for consent (basic)"
				}]
			},
			{
				key: "consent.regions",
				label: "Consent regions",
				type: "list",
				placeholder: "GB, DE, FR…",
				help: "Empty = ask everywhere."
			},
			{
				key: "consent.version",
				label: "Policy version",
				type: "text",
				help: "Change it to ask everyone again."
			},
			{
				key: "consent.expiryDays",
				label: "Remember for (days)",
				type: "number",
				placeholder: "180"
			},
			{
				key: "consent.position",
				tab: "Banner",
				label: "Position",
				type: "select",
				default: "bottom",
				options: opts("bottom", "bottom-left", "bottom-right")
			},
			{
				key: "consent.text.title",
				label: "Title",
				type: "text"
			},
			{
				key: "consent.text.message",
				label: "Text",
				type: "textarea"
			},
			{
				key: "consent.policyUrl",
				label: "Policy link",
				type: "url",
				format: "url"
			}
		]
	},
	{
		id: "security",
		label: "Security & legal",
		help: "security.txt, response headers and legal pages.",
		fields: [
			{
				key: "security.txt.contact",
				tab: "security.txt",
				label: "Contacts",
				type: "list",
				placeholder: "security@example.com"
			},
			{
				key: "security.txt.expires",
				label: "Expires",
				type: "date",
				help: "Required; defaults to a year from each build."
			},
			{
				key: "security.txt.policy",
				label: "Disclosure policy",
				type: "url",
				format: "url"
			},
			{
				key: "security.headers.enabled",
				tab: "Headers",
				label: "Security headers (_headers)",
				type: "boolean"
			},
			{
				key: "security.headers.hsts",
				label: "HSTS",
				type: "boolean"
			},
			{
				key: "security.headers.referrerPolicy",
				label: "Referrer-Policy",
				type: "text",
				placeholder: "strict-origin-when-cross-origin"
			},
			{
				key: "security.headers.csp",
				label: "Content-Security-Policy",
				type: "textarea"
			},
			{
				key: "legal.privacy",
				tab: "Legal pages",
				label: "Privacy policy",
				type: "url",
				format: "url"
			},
			{
				key: "legal.terms",
				label: "Terms",
				type: "url",
				format: "url"
			},
			{
				key: "legal.cookies",
				label: "Cookie policy",
				type: "url",
				format: "url"
			},
			{
				key: "legal.imprint",
				label: "Imprint",
				type: "url",
				format: "url"
			}
		]
	},
	{
		id: "advanced",
		label: "Advanced",
		help: "Resource hints and custom JSON-LD.",
		fields: [
			{
				key: "hints.preconnect",
				label: "Preconnect",
				type: "list",
				placeholder: "https://fonts.gstatic.com"
			},
			{
				key: "hints.dnsPrefetch",
				label: "DNS prefetch",
				type: "list"
			},
			{
				key: "schema.extra",
				label: "Site-wide JSON-LD nodes",
				type: "json"
			}
		]
	}
];
function getPath(obj, path) {
	return path.split(".").reduce((v, k) => v && typeof v === "object" ? v[k] : void 0, obj);
}
/** Immutable set; empty strings / empty arrays / undefined remove the key and prune empty parents. */
function setPath(obj, path, value) {
	const [head, ...rest] = path.split(".");
	const src = obj && typeof obj === "object" ? obj : {};
	const out = { ...src };
	const next = rest.length ? setPath(src[head], rest.join("."), value) : value;
	if (next === void 0 || next === "" || Array.isArray(next) && !next.length || next && typeof next === "object" && !Array.isArray(next) && !Object.keys(next).length) delete out[head];
	else out[head] = next;
	return out;
}
// src/shared/page.ts
function pageHead(site, page, resolved, text) {
	const graph = buildGraph({
		site,
		page,
		resolved,
		text
	});
	const llms = site.llms?.enabled !== false;
	const md = llms && site.llms?.markdownPages !== false && resolved.robots.indexable;
	const mdPath = markdownPath(resolved.path);
	return {
		head: buildHead(resolved, site, {
			jsonLd: graph,
			markdownUrl: md ? absolute(mdPath, resolved.siteUrl) ?? mdPath : void 0,
			llmsUrl: llms ? absolute("/llms.txt", resolved.siteUrl) ?? "/llms.txt" : void 0
		}),
		graph
	};
}
function renderPage({ site, page = {}, path, html, siteUrl, lastmod, tags = true, announce }) {
	const detected = detect(html);
	const resolved = resolvePage({
		site,
		page,
		path,
		detected,
		siteUrl,
		lastmod
	});
	const analysis = analyze(html);
	const { head, graph } = pageHead(site, page, resolved, analysis.text);
	const t = tags ? renderTags(site, {
		path: resolved.path,
		page
	}) : {};
	const notes = site.announcements?.enabled === false ? "" : announceBody(announce);
	return {
		html: inject(html, {
			head,
			lang: resolved.lang,
			...t,
			bodyEnd: (t.bodyEnd ?? "") + notes
		}),
		head,
		resolved,
		graph,
		detected,
		analysis
	};
}
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
export { BOTS, CONSENT_KEY, DEFAULT_ROBOTS, ENUMS, IMAGES, MARK, NESTED, PAGE_SPEC, PRESETS, SCHEMA_TYPES, SERP, SITE_FILE, SITE_SPEC, TAG_PRESETS, VOID, absolute, adsTxt, aeoScore, alternatePaths, analyze, announceBody, announceClient, applyTemplate, auditSite, blockedBots, buildGraph, buildHead, cardEnabled, cardPath, checkFormat, checkImage, checkPage, checkRedirects, checkSchema, checkSite, clip, collapse, consentBody, consentHead, decode, detect, entryKey, escapeHtml, escapeXml, expand, feed, feedItems, feedType, find, findAll, fromAstroI18n, getPath, headersFile, hold, humanize, ids, imageType, inLlms, inSitemap, indexNowFile, indexNowKey, indexNowRequest, inject, innerRange, internalPath, isAbsolute, isRecord, isUtilityPath, isoDate, link, llmsFullTxt, llmsSections, llmsTxt, localeOf, localizedPath, markdownPath, markdownUrl, matchPath, merge, meta, nonEmpty, normalizePath, ogLocaleOf, openGraphTags, origin, pageHead, pageKey, pageSettings, parseAttrs, prefixOf, renderHead, renderPage, renderTag, renderTags, resolvePage, robotsContent, robotsTxt, routeFor, schemaType, scriptJson, securityHeaders, securityTxt, setPath, sidecarFor, siteFiles, siteHeaders, sitePage, sitemaps, tabsOf, tagApplies, tagKey, tagPreset, textOf, textWidth, toAstro, toMarkdown, toNginx, toRedirectsFile, toVercel, tokens, tree, truncateTo, twitterTags, webManifest, wordCount };
