// Announcements: a strip above the page, a popup or a corner toast, managed in the uni1 dashboard and fetched
// live with the site key, so they change without a rebuild. This is the shape the public API returns.

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

export type AnnounceConfig = {
  /** The uni1 API origin, e.g. https://api.example.com */
  api?: string;
  /** The property's site key. */
  key?: string;
  /** Show these instead of fetching, right away and ignoring dates and how often (the dashboard's preview). */
  items?: Announcement[];
  preview?: boolean;
  lang?: string;
};
