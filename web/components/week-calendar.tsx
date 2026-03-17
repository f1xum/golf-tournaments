'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Tournament, GolfClub } from '@/lib/types';
import { DAY_NAMES } from '@/lib/constants';
import { getMonday, toISO, formatDateShort } from '@/lib/utils';
import CalendarCard from './calendar-card';

interface Props {
  tournaments: Tournament[];
  clubs: Record<string, GolfClub>;
}

export default function WeekCalendar({ tournaments, clubs }: Props) {
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const boardRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchStartScroll = useRef(0);

  const prevWeek = useCallback(() => {
    setWeekStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });
  }, []);

  const nextWeek = useCallback(() => {
    setWeekStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d;
    });
  }, []);

  const goToday = useCallback(() => {
    setWeekStart(getMonday(new Date()));
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prevWeek();
      if (e.key === 'ArrowRight') nextWeek();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [prevWeek, nextWeek]);

  // Mobile scroll to today on week change
  useEffect(() => {
    const board = boardRef.current;
    if (!board || window.innerWidth >= 768) return;

    const todayStr = toISO(new Date());
    const cols = board.querySelectorAll<HTMLDivElement>('[data-date]');
    let targetIdx = 0;
    cols.forEach((col, i) => {
      if (col.dataset.date === todayStr) targetIdx = i;
    });
    cols[targetIdx]?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
  }, [weekStart]);

  // Group tournaments by date
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const fromStr = toISO(weekStart);
  const toStr = toISO(weekEnd);

  const weekTournaments = tournaments.filter(
    (t) => t.date_start >= fromStr && t.date_start <= toStr
  );

  const byDate: Record<string, Tournament[]> = {};
  weekTournaments.forEach((t) => {
    if (!byDate[t.date_start]) byDate[t.date_start] = [];
    byDate[t.date_start].push(t);
  });

  // Build days
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    const dateStr = toISO(date);
    return {
      dateStr,
      dayName: DAY_NAMES[i],
      dayNum: `${date.getDate()}.${(date.getMonth() + 1).toString().padStart(2, '0')}.`,
      isToday: dateStr === toISO(new Date()),
      isWeekend: i >= 5,
      tournaments: byDate[dateStr] || [],
    };
  });

  // Touch handlers for edge-swipe week navigation
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartScroll.current = boardRef.current?.scrollLeft ?? 0;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(diff) < 100) return;
    const board = boardRef.current;
    if (!board) return;
    const atLeft = touchStartScroll.current <= 0;
    const atRight = touchStartScroll.current >= board.scrollWidth - board.clientWidth - 5;
    if (diff > 0 && atLeft) prevWeek();
    else if (diff < 0 && atRight) nextWeek();
  };

  return (
    <div>
      {/* Week navigation */}
      <div className="flex items-center justify-center gap-3 mb-3">
        <button
          onClick={prevWeek}
          className="px-3 py-1.5 border border-gray-200 rounded-md bg-white text-base hover:bg-gray-50"
        >
          &larr;
        </button>
        <span className="text-sm font-semibold min-w-[160px] text-center">
          {formatDateShort(weekStart)} – {formatDateShort(weekEnd)}
        </span>
        <button
          onClick={nextWeek}
          className="px-3 py-1.5 border border-gray-200 rounded-md bg-white text-base hover:bg-gray-50"
        >
          &rarr;
        </button>
        <button
          onClick={goToday}
          className="px-3 py-1.5 border border-accent rounded-md text-accent text-sm font-medium hover:bg-accent-light"
        >
          Heute
        </button>
      </div>

      {/* Day columns */}
      <div
        ref={boardRef}
        className="flex gap-2 overflow-x-auto snap-x snap-mandatory pb-2 md:overflow-x-visible"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {days.map((day) => (
          <div
            key={day.dateStr}
            data-date={day.dateStr}
            className="flex-shrink-0 w-[85%] snap-start md:flex-1 md:w-auto md:min-w-0"
          >
            {/* Header */}
            <div
              className={`text-center py-2.5 px-2 border border-gray-200 rounded-t-lg text-sm font-semibold ${
                day.isToday
                  ? 'bg-accent text-white border-accent'
                  : day.isWeekend
                    ? 'bg-weekend'
                    : 'bg-white'
              }`}
            >
              <div className={`text-xs uppercase tracking-wide ${day.isToday ? 'text-white/80' : 'text-gray-500'}`}>
                {day.dayName}
              </div>
              <div className="text-lg mt-0.5">{day.dayNum}</div>
            </div>

            {/* Body */}
            <div
              className={`border border-t-0 border-gray-200 rounded-b-lg p-2 min-h-[80px] flex flex-col gap-1.5 ${
                day.isWeekend ? 'bg-weekend' : ''
              }`}
            >
              {day.tournaments.length === 0 ? (
                <div className="text-center py-4 text-gray-400 text-sm italic">—</div>
              ) : (
                day.tournaments.map((t) => (
                  <CalendarCard key={t.id} tournament={t} club={clubs[t.club_id || '']} />
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
