'use client';

import { Children, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';

export function ExpandableList({
  children,
  initialCount = 3,
  expandedCount = 5,
  viewMoreHref,
  viewMoreLabel = 'Alle Turniere',
}: {
  children: ReactNode;
  initialCount?: number;
  expandedCount?: number;
  viewMoreHref?: string;
  viewMoreLabel?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const items = Children.toArray(children);
  const cap = expanded ? expandedCount : initialCount;
  const visible = items.slice(0, cap);
  const canExpand = items.length > initialCount;
  const hasMoreBeyondExpanded = items.length > expandedCount;

  return (
    <div className="space-y-2">
      {visible}
      {(canExpand || viewMoreHref) && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {canExpand && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-accent bg-white border border-gray-200 rounded-lg hover:border-accent/30 transition-colors"
            >
              {expanded ? (
                <>
                  <ChevronUp size={14} /> Weniger anzeigen
                </>
              ) : (
                <>
                  <ChevronDown size={14} /> Mehr anzeigen
                </>
              )}
            </button>
          )}
          {viewMoreHref && (expanded ? hasMoreBeyondExpanded : true) && (
            <Link
              href={viewMoreHref}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent-light rounded-lg transition-colors"
            >
              {viewMoreLabel} <ArrowRight size={14} />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
