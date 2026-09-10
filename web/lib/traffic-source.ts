'use client';

/**
 * Works out where a visit came from, so /api/track can store it alongside the
 * page view (migration 027).
 *
 * Three signals, in order of trustworthiness:
 *
 *   1. utm_source on the URL — we put it there ourselves (see /ig), so it is
 *      the only one that can name a placement ("bio" vs "story").
 *   2. The in-app browser signature — Instagram's and Facebook's webviews
 *      identify themselves in the user agent. Without this, an untagged visit
 *      from the Instagram app reads as "direct" (no referrer at all) or, worse,
 *      as "facebook" (Meta's link shim reports facebook.com for Instagram
 *      taps). It says which app the page is being viewed in, so it outranks a
 *      social referrer.
 *   3. The referring domain — a normal click from another site. It still wins
 *      whenever it is not social, since a search result or a club website is a
 *      real origin even when rendered inside an in-app browser.
 *
 * The result is remembered for the browser session, so page 5 of a visit is
 * still credited to Instagram even though the utm parameters are long gone
 * from the URL. Only the first view of a session is flagged as an entry —
 * that is what makes "visits" countable without any cross-request identifier.
 */

export interface TrafficSource {
  source: string;
  medium: string;
  campaign: string | null;
  referrerHost: string | null;
}

export interface ResolvedTrafficSource extends TrafficSource {
  /** First tracked view of this session — count these as visits. */
  isEntry: boolean;
}

const SESSION_KEY = 'thepin_src';

const DIRECT: TrafficSource = {
  source: 'direct',
  medium: 'none',
  campaign: null,
  referrerHost: null,
};

/**
 * Referring hosts worth a friendly name. Matched against the host with any
 * leading "www." removed, so a pattern covers its subdomains
 * (l.instagram.com, m.facebook.com, …).
 *
 * Order matters: webmail hosts sit above their search engines, or
 * mail.google.com would be filed as a Google search.
 */
const REFERRER_MAP: { test: RegExp; source: string; medium: string }[] = [
  // Webmail — before the search engines below
  { test: /(^|\.)mail\.google\.com$/, source: 'email', medium: 'email' },
  { test: /(^|\.)(outlook|mail)\.(live|com|office)\b/, source: 'email', medium: 'email' },
  { test: /(^|\.)(web\.de|gmx\.(net|de|at|ch))$/, source: 'email', medium: 'email' },

  // Social
  { test: /(^|\.)instagram\.com$/, source: 'instagram', medium: 'social' },
  { test: /(^|\.)(facebook\.com|fb\.com|fb\.me)$/, source: 'facebook', medium: 'social' },
  { test: /(^|\.)whatsapp\.com$/, source: 'whatsapp', medium: 'social' },
  { test: /(^|\.)(x\.com|twitter\.com)$|^t\.co$/, source: 'x', medium: 'social' },
  { test: /(^|\.)(linkedin\.com)$|^lnkd\.in$/, source: 'linkedin', medium: 'social' },
  { test: /(^|\.)(youtube\.com)$|^youtu\.be$/, source: 'youtube', medium: 'social' },
  { test: /(^|\.)tiktok\.com$/, source: 'tiktok', medium: 'social' },
  { test: /(^|\.)pinterest\.[a-z.]+$/, source: 'pinterest', medium: 'social' },
  { test: /(^|\.)reddit\.com$/, source: 'reddit', medium: 'social' },
  { test: /^t\.me$|(^|\.)telegram\.(me|org)$/, source: 'telegram', medium: 'social' },

  // Search
  { test: /(^|\.)google\.[a-z.]+$/, source: 'google', medium: 'organic' },
  { test: /(^|\.)bing\.com$/, source: 'bing', medium: 'organic' },
  { test: /(^|\.)duckduckgo\.com$/, source: 'duckduckgo', medium: 'organic' },
  { test: /(^|\.)ecosia\.org$/, source: 'ecosia', medium: 'organic' },
  { test: /(^|\.)search\.yahoo\.com$/, source: 'yahoo', medium: 'organic' },
  { test: /(^|\.)search\.brave\.com$/, source: 'brave', medium: 'organic' },
  { test: /(^|\.)(startpage\.com|qwant\.com)$/, source: 'startpage', medium: 'organic' },
  { test: /(^|\.)(yandex\.[a-z.]+|baidu\.com)$/, source: 'yandex', medium: 'organic' },
];

/** In-app browsers that hide the referrer but name themselves in the UA. */
const APP_BROWSERS: { test: RegExp; source: string; medium: string }[] = [
  { test: /Instagram/i, source: 'instagram', medium: 'social' },
  // FBAN/FBAV = Facebook app webview, FB_IAB = its Android variant
  { test: /FBAN|FBAV|FB_IAB/, source: 'facebook', medium: 'social' },
  { test: /TikTok|BytedanceWebview/i, source: 'tiktok', medium: 'social' },
  { test: /LinkedInApp/i, source: 'linkedin', medium: 'social' },
  { test: /Pinterest/i, source: 'pinterest', medium: 'social' },
];

/** Stand-in for sessionStorage when it is unavailable (private mode, etc.). */
let memorySource: TrafficSource | null = null;

function clean(value: string | null | undefined, max: number): string | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase().slice(0, max);
  return trimmed.length > 0 ? trimmed : null;
}

function stripWww(host: string): string {
  return host.replace(/^www\./, '');
}

/** utm_source & friends — the only signal that can carry a campaign. */
function fromUrl(params: URLSearchParams, referrerHost: string | null): TrafficSource | null {
  const source = clean(params.get('utm_source') ?? params.get('ref'), 48);
  if (!source) return null;
  return {
    source,
    medium: clean(params.get('utm_medium'), 48) ?? 'referral',
    campaign: clean(params.get('utm_campaign'), 64),
    referrerHost,
  };
}

function fromReferrer(referrerHost: string | null): TrafficSource | null {
  if (!referrerHost) return null;
  const known = REFERRER_MAP.find((r) => r.test.test(referrerHost));
  return {
    // An unmapped referrer becomes its own source, so a club site or forum
    // linking to us shows up by name instead of vanishing into "direct".
    source: known?.source ?? referrerHost,
    medium: known?.medium ?? 'referral',
    campaign: null,
    referrerHost,
  };
}

/**
 * The app whose webview this is, which beats a social referrer.
 *
 * Meta runs Instagram and Facebook clicks through shared link-shim
 * infrastructure, so a tap on an Instagram bio link routinely arrives with
 * `facebook.com` as the referrer — observed on the very first day of real
 * traffic, where all four visits reported facebook.com and one of them was
 * consequently filed under Facebook. The user agent is unambiguous about which
 * app the page is being viewed in, so it wins that tie.
 *
 * It only wins that tie, though. A referrer that maps to something other than
 * social — a search engine, a golf club's website — is a genuine click from
 * elsewhere that happens to be rendered in an in-app browser, and it keeps its
 * attribution.
 */
function fromAppBrowser(referrerHost: string | null): TrafficSource | null {
  const ua = navigator.userAgent || '';
  const app = APP_BROWSERS.find((a) => a.test.test(ua));
  if (!app) return null;

  if (referrerHost) {
    const known = REFERRER_MAP.find((r) => r.test.test(referrerHost));
    if (!known || known.medium !== 'social') return null;
  }

  // Keep the host: the source says Instagram, the referrer panel still reports
  // the facebook.com it actually came through.
  return { source: app.source, medium: app.medium, campaign: null, referrerHost };
}

function readSession(): TrafficSource | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw) return JSON.parse(raw) as TrafficSource;
  } catch {
    // private mode / storage disabled — fall through to the in-memory copy
  }
  return memorySource;
}

function writeSession(value: TrafficSource): void {
  memorySource = value;
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(value));
  } catch {
    // in-memory only: attribution then lasts for this page load
  }
}

function sameAttribution(a: TrafficSource, b: TrafficSource): boolean {
  return a.source === b.source && a.medium === b.medium && a.campaign === b.campaign;
}

/**
 * Resolve the source for the page view about to be reported.
 *
 * Note that `document.referrer` does not change during client-side navigation,
 * so it keeps pointing at Instagram for every view of the session — which is
 * exactly why the entry flag is tracked separately rather than inferred from
 * the referrer being external.
 */
export function resolveTrafficSource(): ResolvedTrafficSource {
  let referrerHost: string | null = null;
  try {
    if (document.referrer) {
      const host = stripWww(new URL(document.referrer).hostname.toLowerCase());
      // Our own pages are not a referrer; ignore them so the session keeps the
      // source it arrived with.
      if (host !== stripWww(window.location.hostname.toLowerCase())) {
        referrerHost = clean(host, 120);
      }
    }
  } catch {
    // unparseable referrer — treat as absent
  }

  const params = new URLSearchParams(window.location.search);
  // Order matters: the app webview beats a social referrer (Meta's shim reports
  // facebook.com for Instagram taps), but loses to a non-social one.
  const fresh =
    fromUrl(params, referrerHost) ??
    fromAppBrowser(referrerHost) ??
    fromReferrer(referrerHost);
  const stored = readSession();

  // A fresh utm-tagged click mid-session starts a new visit — someone tapping
  // the Instagram link again is a new arrival, not a continuation.
  const isNewCampaignClick =
    !!fresh && !!stored && !!params.get('utm_source') && !sameAttribution(fresh, stored);

  if (!stored || isNewCampaignClick) {
    const resolved = fresh ?? DIRECT;
    writeSession(resolved);
    return { ...resolved, isEntry: true };
  }

  // The session is already attributed, so this is a continuation — including a
  // reload of the utm-tagged landing page, which must not count twice.
  return { ...stored, isEntry: false };
}
