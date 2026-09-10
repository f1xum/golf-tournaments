'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { shouldTrack } from '@/lib/tracking-opt-out';
import { resolveTrafficSource } from '@/lib/traffic-source';

export default function PageTracker() {
  const pathname = usePathname();
  const lastTracked = useRef('');

  useEffect(() => {
    // Avoid double-tracking the same path (e.g. re-renders)
    if (pathname === lastTracked.current) return;
    lastTracked.current = pathname;

    shouldTrack().then((ok) => {
      // Resolved only after the opt-out check, so an excluded viewer (admin,
      // manual opt-out) never even gets the session attribution written.
      if (!ok) return;
      const src = resolveTrafficSource();
      // Use sendBeacon for reliability (fires even on page unload)
      const data = JSON.stringify({ path: pathname, ...src });
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/track', new Blob([data], { type: 'application/json' }));
      } else {
        fetch('/api/track', { method: 'POST', body: data, keepalive: true });
      }
    });
  }, [pathname]);

  return null;
}
