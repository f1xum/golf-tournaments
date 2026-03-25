'use client';

import { useEffect, useState, useRef } from 'react';
import { usePathname } from 'next/navigation';

export default function RouteProgress() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const prevPathname = useRef(pathname);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Detect navigation start by intercepting link clicks
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const anchor = (e.target as HTMLElement).closest('a');
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;

      // Internal navigation detected
      if (href !== pathname) {
        setLoading(true);
        setProgress(15);

        // Animate progress
        if (intervalRef.current) clearInterval(intervalRef.current);
        let p = 15;
        intervalRef.current = setInterval(() => {
          p += Math.random() * 12;
          if (p > 90) p = 90;
          setProgress(p);
        }, 200);
      }
    }

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [pathname]);

  // Complete when pathname changes
  useEffect(() => {
    if (pathname !== prevPathname.current) {
      prevPathname.current = pathname;

      if (loading) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setProgress(100);
        setTimeout(() => {
          setLoading(false);
          setProgress(0);
        }, 300);
      }
    }
  }, [pathname, loading]);

  if (!loading && progress === 0) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[10000] h-[3px]">
      <div
        className="h-full bg-accent transition-all ease-out"
        style={{
          width: `${progress}%`,
          transitionDuration: progress === 100 ? '200ms' : '400ms',
        }}
      />
    </div>
  );
}
