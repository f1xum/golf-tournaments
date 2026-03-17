'use client';

import dynamic from 'next/dynamic';
import { GolfClub } from '@/lib/types';

const MapView = dynamic(() => import('@/components/map-view'), { ssr: false });

interface Props {
  clubs: GolfClub[];
  tournamentCounts: Record<string, number>;
}

export default function MapWrapper({ clubs, tournamentCounts }: Props) {
  return <MapView clubs={clubs} tournamentCounts={tournamentCounts} />;
}
