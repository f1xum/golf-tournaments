'use client';

import { useState } from 'react';
import { Flag, Image as ImageIcon, PlayCircle, X } from 'lucide-react';
import { CourseData } from '@/lib/types';

interface Props {
  data: CourseData;
}

export default function CourseDetails({ data }: Props) {
  const [activeHole, setActiveHole] = useState<number | null>(null);
  const [activePhoto, setActivePhoto] = useState<string | null>(null);

  const heroPhoto = data.photos?.[0];
  const extraPhotos = (data.photos ?? []).slice(1);
  const activeHoleData = data.holes?.find((h) => h.number === activeHole) ?? null;

  return (
    <section className="mb-8">
      {/* Section header */}
      <div className="flex items-center gap-2 mb-4">
        <Flag size={18} className="text-accent" />
        <h2 className="text-lg font-bold">Platz</h2>
      </div>

      {/* Hero photo */}
      {heroPhoto && (
        <button
          onClick={() => setActivePhoto(heroPhoto)}
          className="block w-full mb-4 rounded-xl overflow-hidden border border-gray-200 aspect-[16/9] bg-gray-100 group relative"
          aria-label="Großes Bild öffnen"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={heroPhoto}
            alt="Platz"
            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
            loading="lazy"
          />
        </button>
      )}

      {/* Description + meta */}
      {(data.description || data.architect || data.course_type) && (
        <div className="mb-6">
          {data.description && (
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
              {data.description}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
            {data.architect && (
              <span>
                <span className="text-gray-400">Architekt:</span>{' '}
                <span className="font-medium text-gray-700">{data.architect}</span>
              </span>
            )}
            {data.course_type && (
              <span>
                <span className="text-gray-400">Platztyp:</span>{' '}
                <span className="font-medium text-gray-700">{data.course_type}</span>
              </span>
            )}
            {data.year_designed && (
              <span>
                <span className="text-gray-400">Baujahr:</span>{' '}
                <span className="font-medium text-gray-700">{data.year_designed}</span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Scorecard table */}
      {data.tees && data.tees.length > 0 && (
        <div className="mb-6 bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 text-sm font-semibold text-gray-700">
            Platzdaten
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-[#1e1e1e]">
                <tr className="text-xs text-gray-500 uppercase tracking-wide">
                  <th className="text-left px-4 py-2 font-medium">Abschlag</th>
                  <th className="text-left px-4 py-2 font-medium">Geschlecht</th>
                  <th className="text-right px-4 py-2 font-medium">CR</th>
                  <th className="text-right px-4 py-2 font-medium">Slope</th>
                  <th className="text-right px-4 py-2 font-medium">Par</th>
                  <th className="text-right px-4 py-2 font-medium">Länge</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.tees.map((tee, i) => (
                  <tr key={`${tee.color}-${tee.gender}-${i}`} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="inline-block w-3 h-3 rounded-full border border-gray-300"
                          style={{ background: teeColorHex(tee.color) }}
                          aria-hidden
                        />
                        <span className="font-medium text-gray-900">{tee.color}</span>
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">{tee.gender}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium text-gray-900">
                      {tee.course_rating.toFixed(1)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium text-gray-900">
                      {tee.slope}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">
                      {tee.par}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">
                      {tee.length_m.toLocaleString('de-DE')} m
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Hole flyovers grid */}
      {data.holes && data.holes.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <PlayCircle size={16} className="text-accent" />
            <h3 className="text-sm font-semibold text-gray-700">Bahnenüberflug</h3>
            <span className="text-xs text-gray-400">{data.holes.length} Bahnen</span>
          </div>
          <div className="grid grid-cols-6 sm:grid-cols-9 gap-2">
            {data.holes
              .slice()
              .sort((a, b) => a.number - b.number)
              .map((hole) => (
                <button
                  key={hole.number}
                  onClick={() => hole.video_url && setActiveHole(hole.number)}
                  disabled={!hole.video_url}
                  className={`aspect-square rounded-lg border text-sm font-semibold transition-colors ${
                    hole.video_url
                      ? 'bg-white border-gray-200 hover:border-accent hover:bg-accent-light hover:text-accent cursor-pointer'
                      : 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed'
                  }`}
                  title={hole.video_url ? `Bahn ${hole.number} ansehen` : undefined}
                >
                  {hole.number}
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Additional photos strip */}
      {extraPhotos.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <ImageIcon size={16} className="text-accent" />
            <h3 className="text-sm font-semibold text-gray-700">Bilder</h3>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
            {extraPhotos.map((url, i) => (
              <button
                key={url}
                onClick={() => setActivePhoto(url)}
                className="shrink-0 w-32 h-24 rounded-lg overflow-hidden border border-gray-200 hover:border-accent transition-colors"
                aria-label={`Bild ${i + 2}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Source attribution */}
      {data.source_url && (
        <div className="text-xs text-gray-400">
          Platzdaten:{' '}
          <a
            href={data.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            offizielle Clubseite
          </a>
          {data.updated_at && <span> · aktualisiert {data.updated_at}</span>}
        </div>
      )}

      {/* Video modal */}
      {activeHoleData?.video_url && (
        <div
          className="fixed inset-0 z-[10000] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setActiveHole(null)}
        >
          <div
            className="relative w-full max-w-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setActiveHole(null)}
              aria-label="Schließen"
              className="absolute -top-10 right-0 text-white hover:text-gray-300"
            >
              <X size={24} />
            </button>
            <div className="bg-black rounded-lg overflow-hidden">
              <video
                key={activeHoleData.video_url}
                src={activeHoleData.video_url}
                controls
                autoPlay
                playsInline
                className="w-full"
              />
            </div>
            <div className="mt-2 text-center text-white text-sm">
              Bahn {activeHoleData.number}
            </div>
          </div>
        </div>
      )}

      {/* Photo lightbox */}
      {activePhoto && (
        <div
          className="fixed inset-0 z-[10000] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setActivePhoto(null)}
        >
          <div className="relative max-w-5xl max-h-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setActivePhoto(null)}
              aria-label="Schließen"
              className="absolute -top-10 right-0 text-white hover:text-gray-300"
            >
              <X size={24} />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activePhoto}
              alt=""
              className="max-w-full max-h-[80vh] object-contain rounded-lg"
            />
          </div>
        </div>
      )}
    </section>
  );
}

function teeColorHex(name: string): string {
  const n = name.toLowerCase();
  if (n.startsWith('schwarz') || n === 'black') return '#1f1f1f';
  if (n.startsWith('weiß') || n.startsWith('weiss') || n === 'white') return '#f3f4f6';
  if (n.startsWith('gelb') || n === 'yellow') return '#facc15';
  if (n.startsWith('blau') || n === 'blue') return '#3b82f6';
  if (n.startsWith('rot') || n === 'red') return '#ef4444';
  if (n.startsWith('grün') || n.startsWith('gruen') || n === 'green') return '#16a34a';
  if (n.startsWith('orange')) return '#f97316';
  return '#9ca3af';
}
