// Tag manager data: the per-page dataLayer, and the runtime that pushes events for clicks, submits and views.
// Plain ES2017, no dependencies. Events go to window.dataLayer; tags listen for them in the tag manager.
import type { PageSettings, SiteSettings, TagTrigger } from '../shared/types';

const js = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c');

/** Page variables, pushed before the tag manager so its first tags already see them. */
export function dataLayerHead(page: PageSettings | undefined): string {
  const entries = Object.entries(page?.dataLayer ?? {});
  if (!entries.length) return '';
  return `<script>window.dataLayer=window.dataLayer||[];window.dataLayer.push(${js(Object.fromEntries(entries))});</script>\n`;
}

/** Runtime for the site's triggers. Empty when there are none. */
export function triggersBody(site: SiteSettings): string {
  const triggers = (site.tagManager?.triggers ?? []).filter((t) => t.name && t.selector && ['click', 'submit', 'view'].includes(t.on));
  if (!triggers.length) return '';
  const cfg = triggers.map((t: TagTrigger) => ({ name: t.name, on: t.on, selector: t.selector, params: t.params ?? {} }));
  return `<script>${RUNTIME.replace('__TRIGGERS__', js(cfg))}</script>\n`;
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
