'use client';

import { useState } from 'react';
import { Sparkles, ChevronDown, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Profile } from '@/lib/types';
import { FORMAT_OPTIONS } from '@/lib/constants';

interface Props {
  profile: Profile | null;
}

export default function RecommendationPrefs({ profile }: Props) {
  const [maxDistance, setMaxDistance] = useState(profile?.recommendation_max_distance?.toString() ?? '');
  const [preferHcp, setPreferHcp] = useState(profile?.recommendation_prefer_hcp ?? false);
  const [formats, setFormats] = useState<string[]>(profile?.recommendation_formats ?? []);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function toggleFormat(f: string) {
    setFormats((prev) =>
      prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]
    );
  }

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('profiles').update({
      recommendation_max_distance: maxDistance ? parseInt(maxDistance) : null,
      recommendation_prefer_hcp: preferHcp,
      recommendation_formats: formats.length > 0 ? formats : null,
      updated_at: new Date().toISOString(),
    }).eq('id', user.id);

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="mt-4">
      <details className="group bg-white border border-gray-200 rounded-xl overflow-hidden">
        <summary className="flex items-center justify-between px-4 py-3.5 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
          <div className="flex items-center gap-2.5">
            <Sparkles size={18} className="text-accent" />
            <div>
              <span className="text-sm font-semibold">Für dich – Empfehlungen</span>
              <p className="text-xs text-gray-400 mt-0.5">Welche Turniere sollen wir dir vorschlagen</p>
            </div>
          </div>
          <ChevronDown size={16} className="text-gray-400 transition-transform group-open:rotate-180" />
        </summary>

        <div className="px-4 pb-5 pt-2 border-t border-gray-100 space-y-5">
          {/* Explanation */}
          <div className="text-xs text-gray-400 leading-relaxed">
            Dein <strong className="text-gray-600">Handicap</strong>, <strong className="text-gray-600">Heimatclub</strong> und <strong className="text-gray-600">Favoriten-Clubs</strong> werden
            automatisch berücksichtigt. Hier kannst du die Empfehlungen weiter anpassen.
          </div>

          {/* Max distance */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Maximale Entfernung
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { value: '', label: 'Egal' },
                { value: '25', label: '25 km' },
                { value: '50', label: '50 km' },
                { value: '100', label: '100 km' },
                { value: '200', label: '200 km' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setMaxDistance(opt.value)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                    maxDistance === opt.value
                      ? 'bg-accent text-white border-accent'
                      : 'bg-gray-100 text-gray-700 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Prefer HCP */}
          <button
            onClick={() => setPreferHcp(!preferHcp)}
            className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-lg text-left text-sm transition-colors ${
              preferHcp
                ? 'bg-accent/5 border border-accent/20 dark:bg-[#1a3329] dark:border-[#2d4a3a]'
                : 'bg-gray-50 border border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className={`w-4.5 h-4.5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
              preferHcp ? 'bg-accent border-accent' : 'border-gray-300'
            }`}>
              {preferHcp && <Check size={11} className="text-white" strokeWidth={3} />}
            </div>
            <div>
              <div className="font-medium">HCP-relevante Turniere bevorzugen</div>
              <div className="text-xs text-gray-400 mt-0.5">Ideal zur Handicap-Verbesserung</div>
            </div>
          </button>

          {/* Preferred formats */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Bevorzugte Spielformen
            </label>
            <div className="flex flex-wrap gap-2">
              {FORMAT_OPTIONS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => toggleFormat(f.value)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                    formats.includes(f.value)
                      ? 'bg-accent text-white border-accent'
                      : 'bg-gray-100 text-gray-700 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1.5">Leer lassen für alle Formate</p>
          </div>

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={saving}
            className={`w-full py-2.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${
              saved
                ? 'bg-green-500 text-white'
                : 'bg-accent text-white hover:bg-accent/90'
            }`}
          >
            {saving ? 'Wird gespeichert...' : saved ? 'Gespeichert!' : 'Speichern'}
          </button>
        </div>
      </details>
    </div>
  );
}
