import data from "virtual:u1webcore/data";
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
const escapeHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
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
/** Route path → its markdown copy: "/" → "/index.md", "/a/b/" → "/a/b.md". */
const markdownPath = (path) => `${path.replace(/\/+$/, "").replace(/\.html$/, "") || "/index"}.md`;
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
			type: feedType(f),
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
const feedType = (f) => f.format === "atom" ? "application/atom+xml" : f.format === "json" ? "application/feed+json" : "application/rss+xml";
function renderTag(t) {
	const attrs = Object.entries(t.attrs).map(([k, v]) => v === "" && k === "crossorigin" ? ` ${k}` : ` ${k}="${escapeHtml(v)}"`).join("");
	if (t.tag === "title") return `<title>${escapeHtml(t.content ?? "")}</title>`;
	if (t.tag === "script") return `<script${attrs}>${t.content ?? ""}<\/script>`;
	return `<${t.tag}${attrs}>`;
}
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
	const webpage = clean({
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
		if (isRecord(main) && main.name) webpage.mainEntity = clean({
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
	if (!r.isHome) return clean(base);
	return clean({
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
	if (!full) return clean(light);
	const address = clean({
		"@type": "PostalAddress",
		...o.address ?? {}
	});
	return clean({
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
		contactPoint: o.contactPoints?.length ? o.contactPoints.map((c) => clean({
			"@type": "ContactPoint",
			...c
		})) : void 0,
		sameAs: site.social?.profiles?.length ? site.social.profiles : void 0,
		...o.identifiers ?? {}
	});
}
function person(p, id, siteUrl) {
	return clean({
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
	const out = (list ?? []).filter((e) => e.name?.trim()).map((e) => clean({
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
	return clean(node);
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
function clean(obj) {
	const out = {};
	for (const [k, v] of Object.entries(obj)) {
		if (v === void 0 || v === null || v === "") continue;
		if (isRecord(v) && !("@id" in v && Object.keys(v).length === 1)) {
			const c = clean(v);
			if (Object.keys(c).some((key) => key !== "@type")) out[k] = c;
			continue;
		}
		out[k] = v;
	}
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
.bar .r{display:flex;align-items:center;gap:12px;padding:9px 12px 9px 16px;font-size:14px;min-height:44px;max-width:var(--u1a-bar-width,1200px);margin:0 auto}
.bar .t{flex:1;min-width:0;display:flex;align-items:center;gap:10px}.bar .t>span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pill{flex:none;display:inline-flex;align-items:center;border:1px solid color-mix(in srgb,currentColor 25%,transparent);background:color-mix(in srgb,currentColor 14%,transparent);border-radius:6px;padding:3px 8px;font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}
.lk{flex:none;display:inline-flex;align-items:center;gap:6px;font-weight:800;font-size:12px;letter-spacing:.06em;text-transform:uppercase;text-decoration:none;white-space:nowrap}.lk:hover{opacity:.8}.lk svg{width:14px;height:14px}
@media (max-width:640px){.bar .lk .l{display:none}}
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
	const ARROW = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M5 12h14M13 6l6 6-6 6\"/></svg>";
	const cta = (a) => {
		if (!a.cta || !a.cta.url) return "";
		const label = esc(text(a, "ctaLabel"));
		const attrs = `data-cta href="${esc(safeUrl(a.cta.url))}"${a.cta.newTab ? " target=\"_blank\" rel=\"noopener\"" : ""}`;
		return (a.appearance || {}).ctaStyle === "link" ? `<a class="lk" ${attrs} aria-label="${label}"><span class="l">${label}</span>${ARROW}</a>` : `<a class="b" ${attrs}>${label}</a>`;
	};
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
		box.innerHTML = `<div class="bar" role="region" aria-label="${esc(title || "Announcement")}"><div class="r"><div class="t">${title ? `<span class="pill">${esc(title)}</span>` : ""}<span>${rich(text(a, "body"))}</span></div>${cta(a)}${ap.dismissible !== false ? `<button class="x" data-x aria-label="Close">${X}</button>` : ""}</div></div>`;
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
	if (cfg.items?.length) start(() => run(cfg.items));
}
const js = (v) => JSON.stringify(v).replace(/</g, "\\u003c");
/** The <script> that shows the site's announcements. Empty when none is on. */
function announceBody(cfg) {
	if (!cfg?.items?.length) return "";
	return `<script>(${announceClient.toString()})(${js({
		...cfg,
		api: cfg.api?.replace(/\/+$/, "")
	})});<\/script>\n`;
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
	const notes = announceBody(announce);
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
// src/astro/lastmod.ts
function lastmodFor(list, route) {
	for (const l of list) try {
		if (new RegExp(l.re).test(route) || new RegExp(l.re).test(route.replace(/\/$/, "")) || new RegExp(l.re).test(`${route.replace(/\/$/, "")}/`)) return l.at;
	} catch {}
}
// src/astro/middleware.ts
const current = () => globalThis[Symbol.for("u1webcore.live")]?.data?.() ?? data;
const onRequest = async (ctx, next) => {
	const d = current();
	const path = stripBase(ctx.url.pathname, d.config.base);
	const res = await next();
	if (!(res.headers.get("content-type") ?? "").includes("text/html")) return res;
	if (path.startsWith("/_") || path.startsWith("/@")) return res;
	const html = await res.text();
	const route = routeFor(d.routes, path, ctx.routePattern);
	const page = pageSettings(d.pages, route, path);
	let out;
	try {
		const r = renderPage({
			site: d.site,
			page,
			path,
			html,
			siteUrl: d.config.siteUrl,
			lastmod: lastmodFor(d.config.lastmod, path),
			tags: d.config.tags,
			announce: !ctx.isPrerendered && ctx.request.headers.get("x-u1webcore") ? null : d.config.announce
		});
		out = r.html;
		if (d.config.editor && route && !ctx.request.headers.get("x-u1webcore")) {
			const payload = {
				path,
				file: route.file,
				key: entryKey(route, path) || void 0,
				siteFile: SITE_FILE,
				siteUrl: d.config.siteUrl,
				detected: r.detected,
				analysis: {
					...r.analysis,
					text: clip(r.analysis.text, 2e4)
				}
			};
			const tag = `<script type="application/json" data-u1cms-ext="u1webcore">${scriptJson(payload)}<\/script>`;
			const at = out.lastIndexOf("</body>");
			out = at === -1 ? out + tag : out.slice(0, at) + tag + out.slice(at);
		}
	} catch (err) {
		console.error(`[u1webcore] ${path}:`, err);
		out = html;
	}
	const headers = new Headers(res.headers);
	headers.delete("content-length");
	return new Response(out, {
		status: res.status,
		statusText: res.statusText,
		headers
	});
};
function stripBase(pathname, base) {
	const b = base.replace(/\/+$/, "");
	return b && pathname.startsWith(b) ? pathname.slice(b.length) || "/" : pathname;
}
export { onRequest };
