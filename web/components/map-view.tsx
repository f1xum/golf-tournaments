'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { GolfClub } from '@/lib/types';
import { distanceKm } from '@/lib/utils';
import { Locate } from 'lucide-react';

const TILE_LIGHT = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png';
const TILE_DARK = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}';

function useIsDark() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
    const observer = new MutationObserver(() => {
      setDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return dark;
}

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

const favoriteIcon = L.divIcon({
  className: '',
  html: `<div style="
    width: 14px; height: 14px;
    background: #ef4444;
    border: 2px solid white;
    border-radius: 50%;
    box-shadow: 0 1px 4px rgba(0,0,0,0.3);
  "></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
  popupAnchor: [0, -9],
});

const userIcon = L.divIcon({
  className: '',
  html: `<div style="
    width: 14px; height: 14px;
    background: #3b82f6;
    border: 3px solid white;
    border-radius: 50%;
    box-shadow: 0 1px 6px rgba(59,130,246,0.5);
  "></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

function FlyTo({ position, zoom }: { position: [number, number]; zoom: number }) {
  const map = useMap();
  const posKey = `${position[0]},${position[1]}`;
  const lastKey = useRef('');

  useEffect(() => {
    if (lastKey.current !== posKey) {
      lastKey.current = posKey;
      map.flyTo(position, zoom, { duration: 1 });
    }
  }, [map, position, zoom, posKey]);

  return null;
}

interface Props {
  clubs: GolfClub[];
  tournamentCounts: Record<string, number>;
  savedClubIds?: string[];
}

export default function MapView({ clubs, tournamentCounts, savedClubIds = [] }: Props) {
  const center: [number, number] = [48.8, 11.5];
  const isDark = useIsDark();
  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  const [flyTarget, setFlyTarget] = useState<{ pos: [number, number]; zoom: number } | null>(null);
  const [locating, setLocating] = useState(false);

  const handleLocate = useCallback(() => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setUserPos(coords);
        setFlyTarget({ pos: coords, zoom: 11 });
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  return (
    <div className="relative h-full w-full">
      <MapContainer center={center} zoom={8} className="h-full w-full" scrollWheelZoom>
        <TileLayer
          key={isDark ? 'dark' : 'light'}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
          url={isDark ? TILE_DARK : TILE_LIGHT}
        />

        {flyTarget && <FlyTo position={flyTarget.pos} zoom={flyTarget.zoom} />}

        {/* User position */}
        {userPos && (
          <>
            <Marker position={userPos} icon={userIcon}>
              <Popup>
                <div className="text-sm font-medium">Mein Standort</div>
              </Popup>
            </Marker>
            <Circle
              center={userPos}
              radius={500}
              pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.1, weight: 1 }}
            />
          </>
        )}

        {/* Club markers */}
        {clubs.map((club) => {
          if (!club.latitude || !club.longitude) return null;
          const count = tournamentCounts[club.id] || 0;
          const isFavorite = savedClubIds.includes(club.id);
          const dist = userPos
            ? distanceKm(userPos[0], userPos[1], club.latitude, club.longitude)
            : null;
          return (
            <Marker
              key={club.id}
              position={[club.latitude, club.longitude]}
              icon={isFavorite ? favoriteIcon : accentIcon}
            >
              <Popup>
                <a href={`/clubs/${club.id}`} className="block text-sm no-underline text-inherit">
                  <div className="font-semibold">{club.name}</div>
                  {club.city && <div className="text-gray-500">{club.city}</div>}
                  {dist != null && (
                    <div className="text-xs text-blue-500 mt-0.5">
                      {dist < 1 ? `${Math.round(dist * 1000)} m` : `${dist.toFixed(1)} km`} entfernt
                    </div>
                  )}
                  <div className="mt-1 text-accent font-medium">
                    {count > 0
                      ? `${count} kommende Turnier${count !== 1 ? 'e' : ''} →`
                      : 'Club ansehen →'}
                  </div>
                </a>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Locate button */}
      <button
        onClick={handleLocate}
        disabled={locating}
        className="absolute top-3 right-3 z-[1000] bg-white border border-gray-300 rounded-lg p-2.5 shadow-md hover:bg-gray-50 transition-colors disabled:opacity-50"
        title="Mein Standort"
      >
        <Locate
          size={20}
          className={`${userPos ? 'text-blue-500' : 'text-gray-600'} ${locating ? 'animate-pulse' : ''}`}
        />
      </button>
    </div>
  );
}
