'use client';

import { Analytics } from '@vercel/analytics/next';
import { useEffect, useState } from 'react';
import { shouldTrack } from '@/lib/tracking-opt-out';

export default function ConditionalVercelAnalytics() {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    shouldTrack().then(setOk);
  }, []);
  return ok ? <Analytics /> : null;
}
