// Announcements: a strip, a popup or a corner toast. The site keeps them in src/site.u1wc.json (`announcements`), the
// CMS edits that file like any other, and u1webcore puts the ones that are on into each page at build.

export type AnnouncementKind = 'bar' | 'popup' | 'toast';
export type AnnouncementTone = 'brand' | 'dark' | 'light' | 'custom';

export type AnnouncementText = { title?: string; body?: string; ctaLabel?: string };

export type Announcement = {
  id: string;
  /** Bumped when the content changes: people who closed the old one see the new one. */
  version: number;
  name: string;
  kind: AnnouncementKind;
  title: string;
  /** Plain text; **bold** and [links](https://…) work. */
  body: string;
  cta: { label: string; url: string; newTab?: boolean } | null;
  image: string | null;
  /** By language code ("fr"), from <html lang>. Missing parts fall back to the main text. */
  translations: Record<string, AnnouncementText>;
  appearance: {
    tone: AnnouncementTone;
    /** custom tone */
    background?: string;
    color?: string;
    /** Button colour; defaults to the site's --u1a-accent. */
    accent?: string;
    /** toast: bottom-right | bottom-left; popup: center | bottom */
    position?: 'bottom-right' | 'bottom-left' | 'center' | 'bottom';
    /** Show a close button (popups always have one). */
    dismissible: boolean;
    /** link: the button as text with an arrow (quieter, for strips). */
    ctaStyle?: 'button' | 'link';
  };
  trigger: { on: 'load' | 'delay' | 'scroll' | 'exit'; seconds?: number; percent?: number };
  /** Paths may use * (e.g. /blog/*). Language prefixes (/fr/…) are ignored when matching. */
  pages: { mode: 'all' | 'only' | 'except'; paths: string[] };
  /**
   * until-closed: every page until closed. always: every page view. session: once per visit.
   * once: only ever once. days: at most once every `days` days.
   */
  frequency: { mode: 'until-closed' | 'always' | 'session' | 'once' | 'days'; days?: number };
  startsAt: string | null;
  endsAt: string | null;
};

/** One announcement as the site stores it (src/site.u1wc.json → announcements[]). */
export type SiteAnnouncement = {
  id: string;
  name: string;
  kind: AnnouncementKind;
  status: 'on' | 'off';
  /** Bumped when what visitors see changes, so people who closed it see it again. */
  version?: number;
  content: { title?: string; body?: string; cta?: Announcement['cta']; image?: string | null };
  translations?: Record<string, AnnouncementText>;
  appearance: Announcement['appearance'];
  trigger: Announcement['trigger'];
  pages: { mode: Announcement['pages']['mode']; paths?: string[] };
  frequency: Announcement['frequency'];
  startsAt?: string | null;
  endsAt?: string | null;
};

/** The shape the page script shows. */
export const toAnnouncement = (a: SiteAnnouncement): Announcement => ({
  id: a.id,
  version: a.version ?? 1,
  name: a.name,
  kind: a.kind,
  title: a.content.title ?? '',
  body: a.content.body ?? '',
  cta: a.content.cta ?? null,
  image: a.content.image ?? null,
  translations: a.translations ?? {},
  appearance: a.appearance,
  trigger: a.trigger,
  pages: { mode: a.pages.mode, paths: a.pages.paths ?? [] },
  frequency: a.frequency,
  startsAt: a.startsAt ?? null,
  endsAt: a.endsAt ?? null,
});

export type AnnounceConfig = {
  /** Optional: the uni1 API origin and site key, only to count views, clicks and closes. */
  api?: string;
  key?: string;
  /** The announcements that are on, from the site's settings. */
  items?: Announcement[];
  /** Show inside frames too (astro dev: the CMS editor's preview is a frame). */
  frames?: boolean;
  /** Show them right away, ignoring dates and how often (the CMS preview). */
  preview?: boolean;
  lang?: string;
};
