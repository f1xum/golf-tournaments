import { NextRequest, NextResponse } from 'next/server';

/**
 * Short campaign links: /ig → / with utm parameters attached.
 *
 * The point is that the link you paste into an Instagram bio stays short and
 * readable while the tagging happens server-side, where it cannot be trimmed
 * off by whoever copies the link. lib/traffic-source.ts then reads those
 * parameters on arrival and attributes the whole visit (migration 027).
 *
 * To add a channel, create web/app/<slug>/route.ts with a CHANNEL literal and
 * one call to campaignRedirect.
 */
export interface CampaignChannel {
  /** utm_source, e.g. 'instagram' — becomes the name in the admin dashboard. */
  source: string;
  /** utm_medium, e.g. 'social'. */
  medium: string;
  /** utm_campaign when the link does not name one via ?c=. */
  defaultCampaign: string;
}

function slug(value: string | null): string | null {
  if (!value) return null;
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-') // "story okt" → "story-okt", not "storyokt"
    .replace(/[^a-z0-9._-]/g, '')
    .slice(0, 32);
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * Only same-site paths may be redirected to. Anything else — an absolute URL, a
 * protocol-relative `//evil.com`, a backslash variant — would turn this route
 * into an open redirect, and a link on our own domain that forwards anywhere is
 * exactly what a phishing campaign wants.
 */
function safePath(value: string | null): string {
  if (!value) return '/';
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return '/';
  if (value.startsWith('/api')) return '/';
  return value;
}

export function campaignRedirect(request: NextRequest, channel: CampaignChannel): NextResponse {
  const incoming = request.nextUrl.searchParams;
  const url = new URL(safePath(incoming.get('to')), request.nextUrl.origin);

  url.searchParams.set('utm_source', channel.source);
  url.searchParams.set('utm_medium', channel.medium);
  url.searchParams.set('utm_campaign', slug(incoming.get('c')) ?? channel.defaultCampaign);

  // 307, not 308: the destination of a campaign link is ours to change later,
  // and a permanent redirect would sit in browser caches forever.
  const response = NextResponse.redirect(url, 307);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
