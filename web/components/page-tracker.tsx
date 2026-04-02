'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

export default function PageTracker() {
  const pathname = usePathname();
  const lastTracked = useRef('');

  useEffect(() => {
    // Avoid double-tracking the same path (e.g. re-renders)
    if (pathname === lastTracked.current) return;
    lastTracked.current = pathname;

    // Use sendBeacon for reliability (fires even on page unload)
    const data = JSON.stringify({ path: pathname });
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/track', new Blob([data], { type: 'application/json' }));
    } else {
      fetch('/api/track', { method: 'POST', body: data, keepalive: true });
    }
  }, [pathname]);

  return null;
}
