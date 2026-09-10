import { NextRequest } from 'next/server';
import { campaignRedirect, type CampaignChannel } from '@/lib/campaign-redirect';

/**
 * thepin.app/ig — the link for the Instagram profile.
 *
 *   /ig                    → utm_campaign=bio      (the profile link)
 *   /ig?c=story            → utm_campaign=story    (a story sticker)
 *   /ig?c=reel-okt&to=/karte → a specific post, landing on the map
 *
 * Campaigns show up by name in /admin, so a story and the bio link can be
 * compared instead of both reading as "instagram".
 */
const CHANNEL: CampaignChannel = {
  source: 'instagram',
  medium: 'social',
  defaultCampaign: 'bio',
};

export function GET(request: NextRequest) {
  return campaignRedirect(request, CHANNEL);
}
