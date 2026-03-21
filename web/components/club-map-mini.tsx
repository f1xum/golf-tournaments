'use client';

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { GolfClub } from '@/lib/types';

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
  if (!club.latitude || !club.longitude) return null;

  const center: [number, number] = [club.latitude, club.longitude];

  return (
    <MapContainer center={center} zoom={13} className="h-full w-full" scrollWheelZoom={false}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
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
