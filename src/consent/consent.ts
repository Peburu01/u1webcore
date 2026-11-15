// Consent manager: Google Consent Mode v2 defaults (first thing in <head>), a banner and a preferences
// dialog, versioned choices that expire, and Global Privacy Control. The banner is fixed-position
// (no layout shift) and built by script, so pages without JS show nothing and load no gated tags.
// Any element with [data-u1-consent-open] or href="#cookie-settings" reopens the dialog.
import type { SiteSettings } from '../shared/types';
import { escapeHtml } from '../shared/util';

export const CONSENT_KEY = 'u1-consent';

const DEFAULT_TEXT = {
  title: 'Cookies',
  message: 'We use cookies to understand how the site is used and to improve it. You can accept all, reject non-essential, or choose.',
  accept: 'Accept all',
  reject: 'Reject non-essential',
  customize: 'Choose',
  save: 'Save choices',
  necessary: 'Necessary',
  analytics: 'Analytics',
  marketing: 'Marketing',
  preferences: 'Preferences',
  policy: 'Privacy policy',
};

const js = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c');

/** Runs before any tag: Consent Mode defaults, then the stored choice re-applied synchronously. */
export function consentHead(site: SiteSettings): string {
  const c = site.consent ?? {};
  const version = c.version ?? '1';
  const google = c.googleConsentMode !== false;
  const denied = { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied', functionality_storage: 'denied', personalization_storage: 'denied', security_storage: 'granted' };
  const granted = Object.fromEntries(Object.keys(denied).map((k) => [k, 'granted']));
  const defaults = c.regions?.length
    ? `gtag('consent','default',${js(granted)});gtag('consent','default',${js({ ...denied, region: c.regions, wait_for_update: 500 })});`
    : `gtag('consent','default',${js({ ...denied, wait_for_update: 500 })});`;
  return `<script>(function(){window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}window.gtag=window.gtag||gtag;${
    google ? `${defaults}gtag('set','ads_data_redaction',true);gtag('set','url_passthrough',true);` : ''
  }try{var s=JSON.parse(localStorage.getItem(${js(CONSENT_KEY)})||'null');if(s&&s.v===${js(version)}&&s.exp>Date.now()){window.__u1consent=s.c;${
    google ? `gtag('consent','update',{analytics_storage:s.c.analytics?'granted':'denied',ad_storage:s.c.marketing?'granted':'denied',ad_user_data:s.c.marketing?'granted':'denied',ad_personalization:s.c.marketing?'granted':'denied',functionality_storage:s.c.preferences?'granted':'denied',personalization_storage:s.c.preferences?'granted':'denied'});` : ''
  }}}catch(e){}})();</script>\n`;
}

/** Banner, dialog and the activator for held-back scripts. */
export function consentBody(site: SiteSettings): string {
  const c = site.consent ?? {};
  const text = { ...DEFAULT_TEXT, ...Object.fromEntries(Object.entries(c.text ?? {}).filter(([, v]) => v)) };
  const used = new Set((site.tags ?? []).filter((t) => t.enabled !== false).map((t) => t.consent).filter(Boolean));
  const categories = (['analytics', 'marketing', 'preferences'] as const).filter((k) => used.has(k) || k !== 'preferences');
  const cfg = {
    key: CONSENT_KEY,
    v: c.version ?? '1',
    days: c.expiryDays ?? 180,
    gpc: c.respectGpc !== false,
    google: c.googleConsentMode !== false,
    pos: c.position ?? 'bottom',
    policy: c.policyUrl ?? site.legal?.cookies ?? site.legal?.privacy ?? '',
    cats: categories,
    t: Object.fromEntries(Object.entries(text).map(([k, v]) => [k, escapeHtml(String(v))])),
  };
  return `<script>${RUNTIME.replace('__CFG__', js(cfg))}</script>\n`;
}

// Plain ES2017 so it runs everywhere without a build step. Kept small and dependency-free.
const RUNTIME = `(function(){var C=__CFG__,d=document,w=window;
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
