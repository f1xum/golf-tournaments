'use client';

import { useRef, useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

interface Props {
  onRefresh: () => Promise<void> | void;
  children: React.ReactNode;
  /** Distance in px the user must pull before release triggers a refresh. */
  threshold?: number;
}

const MAX_PULL = 120;

export default function PullToRefresh({ onRefresh, children, threshold = 80 }: Props) {
  const startY = useRef<number | null>(null);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const pullRef = useRef(0);

  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      if (refreshing) return;
      if (window.scrollY > 0) {
        startY.current = null;
        return;
      }
      startY.current = e.touches[0].clientY;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (startY.current === null || refreshing) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0) {
        setPull(0);
        pullRef.current = 0;
        return;
      }
      // Page hasn't scrolled — we're at top and pulling down. Dampen the pull.
      const damped = Math.min(MAX_PULL, dy * 0.5);
      setPull(damped);
      pullRef.current = damped;
    };

    const onTouchEnd = async () => {
      if (startY.current === null) return;
      startY.current = null;
      const final = pullRef.current;
      if (final >= threshold && !refreshing) {
        setRefreshing(true);
        setPull(threshold);
        pullRef.current = threshold;
        try {
          await onRefresh();
        } finally {
          setRefreshing(false);
          setPull(0);
          pullRef.current = 0;
        }
      } else {
        setPull(0);
        pullRef.current = 0;
      }
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', onTouchEnd);

    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [onRefresh, threshold, refreshing]);

  const progress = Math.min(1, pull / threshold);
  const rotation = progress * 270;
  const visible = pull > 0 || refreshing;

  return (
    <>
      <div
        aria-hidden={!visible}
        className="fixed left-0 right-0 z-[60] flex justify-center pointer-events-none transition-opacity sm:hidden"
        style={{
          top: 0,
          opacity: visible ? 1 : 0,
          transform: `translateY(${Math.max(0, pull - 32)}px)`,
        }}
      >
        <div className="mt-2 bg-white border border-gray-200 rounded-full shadow-sm w-9 h-9 flex items-center justify-center">
          <RefreshCw
            size={18}
            className={`text-accent ${refreshing ? 'animate-spin' : ''}`}
            style={refreshing ? undefined : { transform: `rotate(${rotation}deg)` }}
          />
        </div>
      </div>
      <div
        style={{
          transform: pull > 0 ? `translateY(${pull * 0.4}px)` : undefined,
          transition: pull === 0 ? 'transform 200ms ease-out' : undefined,
        }}
      >
        {children}
      </div>
    </>
  );
}
