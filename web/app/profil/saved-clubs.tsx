'use client';

import Link from 'next/link';
import { GolfClub } from '@/lib/types';
import { Heart, MapPin, ChevronRight } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';

interface Props {
  clubs: GolfClub[];
}

export default function SavedClubs({ clubs }: Props) {
  return (
    <div id="saved-clubs" className="mt-8">
      <div className="flex items-center gap-2 mb-4">
        <Heart size={18} className="text-red-500" />
        <h2 className="text-lg font-bold">Favoriten-Clubs</h2>
        {clubs.length > 0 && (
          <span className="text-xs bg-red-50 text-red-500 px-2 py-0.5 rounded-full font-medium dark:bg-[#2a1515] dark:text-[#f87171]">
            {clubs.length}
          </span>
        )}
      </div>

      {clubs.length === 0 ? (
        <EmptyState
          icon={Heart}
          title="Noch keine Favoriten-Clubs gespeichert"
          action={{ label: 'Clubs entdecken', href: '/clubs' }}
        />
      ) : (
        <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
          {clubs.map((club) => (
            <Link
              key={club.id}
              href={`/clubs/${club.id}`}
              className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-gray-50 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-sm leading-snug">{club.name}</div>
                {(club.city || club.region) && (
                  <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                    <MapPin size={12} className="shrink-0" />
                    <span className="truncate">
                      {[club.city, club.region].filter(Boolean).join(', ')}
                    </span>
                  </div>
                )}
              </div>
              <ChevronRight size={16} className="shrink-0 text-gray-300" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
