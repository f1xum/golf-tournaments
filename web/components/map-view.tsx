'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { GolfClub } from '@/lib/types';

// Fix default marker icons in Next.js/webpack
const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const accentIcon = L.divIcon({
  className: '',
  html: `<div style="
    width: 12px; height: 12px;
    background: #2d6a4f;
    border: 2px solid white;
    border-radius: 50%;
    box-shadow: 0 1px 4px rgba(0,0,0,0.3);
  "></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6],
  popupAnchor: [0, -8],
});

interface Props {
  clubs: GolfClub[];
  tournamentCounts: Record<string, number>;
}

export default function MapView({ clubs, tournamentCounts }: Props) {
  // Bavaria center
  const center: [number, number] = [48.8, 11.5];

  return (
    <MapContainer center={center} zoom={8} className="h-full w-full" scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {clubs.map((club) => {
        if (!club.latitude || !club.longitude) return null;
        const count = tournamentCounts[club.id] || 0;
        return (
          <Marker
            key={club.id}
            position={[club.latitude, club.longitude]}
            icon={accentIcon}
          >
            <Popup>
              <div className="text-sm">
                <div className="font-semibold">{club.name}</div>
                {club.city && <div className="text-gray-500">{club.city}</div>}
                {count > 0 && (
                  <div className="mt-1 text-accent font-medium">
                    {count} kommende Turnier{count !== 1 ? 'e' : ''}
                  </div>
                )}
                {club.website && (
                  <a
                    href={club.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline text-xs mt-1 block"
                  >
                    Website
                  </a>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
