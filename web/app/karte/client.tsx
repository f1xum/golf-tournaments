'use client';

import dynamic from 'next/dynamic';
import { GolfClub } from '@/lib/types';

const MapView = dynamic(() => import('@/components/map-view'), { ssr: false });

interface Props {
  clubs: GolfClub[];
  tournamentCounts: Record<string, number>;
  savedClubIds: string[];
}

export default function MapWrapper({ clubs, tournamentCounts, savedClubIds }: Props) {
  return <MapView clubs={clubs} tournamentCounts={tournamentCounts} savedClubIds={savedClubIds} />;
}
