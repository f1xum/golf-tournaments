'use client';

import { useEffect, useState, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useIsFetching } from '@tanstack/react-query';

export default function RouteProgress() {
  const pathname = usePathname();
  const isFetching = useIsFetching();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const prevPathname = useRef(pathname);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Start when link is clicked
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const anchor = (e.target as HTMLElement).closest('a');
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;

      if (href !== pathname) {
        setLoading(true);
        setProgress(15);

        if (completeTimerRef.current) {
          clearTimeout(completeTimerRef.current);
          completeTimerRef.current = null;
        }
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

  // Complete only when pathname has changed AND no React Query fetches are in flight.
  // Debounce by 200ms so we don't finish before the new page has mounted its queries.
  useEffect(() => {
    if (!loading) return;

    const pathChanged = pathname !== prevPathname.current;

    if (pathChanged && isFetching === 0) {
      if (completeTimerRef.current) clearTimeout(completeTimerRef.current);
      completeTimerRef.current = setTimeout(() => {
        prevPathname.current = pathname;
        if (intervalRef.current) clearInterval(intervalRef.current);
        setProgress(100);
        setTimeout(() => {
          setLoading(false);
          setProgress(0);
        }, 300);
        completeTimerRef.current = null;
      }, 200);
    } else if (completeTimerRef.current) {
      // A new fetch started before the debounce fired — cancel and keep waiting.
      clearTimeout(completeTimerRef.current);
      completeTimerRef.current = null;
    }
  }, [loading, pathname, isFetching]);

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
