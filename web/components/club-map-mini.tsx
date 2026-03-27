'use client';

import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { GolfClub } from '@/lib/types';

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

const markerIcon = L.divIcon({
  className: '',
  html: `<div style="
    width: 14px; height: 14px;
    background: #2d6a4f;
    border: 2px solid white;
    border-radius: 50%;
    box-shadow: 0 1px 4px rgba(0,0,0,0.3);
  "></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
  popupAnchor: [0, -10],
});

interface Props {
  club: GolfClub;
}

export default function ClubMapMini({ club }: Props) {
  const isDark = useIsDark();
  if (!club.latitude || !club.longitude) return null;

  const center: [number, number] = [club.latitude, club.longitude];

  return (
    <MapContainer center={center} zoom={13} className="h-full w-full" scrollWheelZoom={false}>
      <TileLayer
        key={isDark ? 'dark' : 'light'}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
        url={isDark ? TILE_DARK : TILE_LIGHT}
      />
      <Marker position={center} icon={markerIcon}>
        <Popup>
          <div className="text-sm font-semibold">{club.name}</div>
          {club.city && <div className="text-xs text-gray-500">{club.city}</div>}
        </Popup>
      </Marker>
    </MapContainer>
  );
}
