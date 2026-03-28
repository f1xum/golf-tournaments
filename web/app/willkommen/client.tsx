'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Profile, GolfClub } from '@/lib/types';
import { Flag, Search, ChevronRight, ChevronLeft, Sparkles, MapPin, Trophy, User, Target } from 'lucide-react';
import { FORMAT_LABELS } from '@/lib/constants';

const TOTAL_STEPS = 5;

interface Props {
  profile: Profile | null;
  clubs: Pick<GolfClub, 'id' | 'name' | 'city'>[];
  email: string;
}

export default function OnboardingClient({ profile, clubs, email }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');

  // Form state
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [handicap, setHandicap] = useState(profile?.handicap?.toString() ?? '');
  const [homeClubId, setHomeClubId] = useState(profile?.home_club_id ?? '');
  const [notifyReminder, setNotifyReminder] = useState(true);
  const [notifyNearby, setNotifyNearby] = useState(true);
  const [notifyHcp, setNotifyHcp] = useState(true);

  // Recommendation preferences
  const [recMaxDistance, setRecMaxDistance] = useState<string>('');
  const [recPreferHcp, setRecPreferHcp] = useState(false);
  const [recFormats, setRecFormats] = useState<string[]>([]);

  function next() {
    setDirection('forward');
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  }

  function back() {
    setDirection('back');
    setStep((s) => Math.max(s - 1, 0));
  }

  async function finish() {
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('profiles').update({
      display_name: displayName || null,
      handicap: handicap ? parseFloat(handicap) : null,
      home_club_id: homeClubId || null,
      notify_tournament_reminder: notifyReminder,
      notify_new_nearby: notifyNearby,
      notify_hcp_match: notifyHcp,
      recommendation_max_distance: recMaxDistance ? parseInt(recMaxDistance) : null,
      recommendation_prefer_hcp: recPreferHcp,
      recommendation_formats: recFormats.length > 0 ? recFormats : null,
      updated_at: new Date().toISOString(),
    }).eq('id', user.id);

    setDirection('forward');
    setStep(TOTAL_STEPS);
  }

  function goToApp() {
    router.push('/turniere');
    router.refresh();
  }

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center py-8 px-4">
      <div className="w-full max-w-md">
        {/* Progress bar */}
        {step > 0 && step < TOTAL_STEPS && (
          <div className="mb-8">
            <div className="flex justify-between text-xs text-gray-400 mb-2">
              <span>Schritt {step} von {TOTAL_STEPS - 1}</span>
              <span>{Math.round((step / (TOTAL_STEPS - 1)) * 100)}%</span>
            </div>
            <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-500 ease-out"
                style={{ width: `${(step / (TOTAL_STEPS - 1)) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Steps */}
        <div
          key={step}
          className={`transition-all duration-300 ease-out ${
            direction === 'forward'
              ? 'animate-in fade-in slide-in-from-right-4'
              : 'animate-in fade-in slide-in-from-left-4'
          }`}
        >
          {step === 0 && (
            <WelcomeStep
              email={email}
              onNext={next}
            />
          )}
          {step === 1 && (
            <ProfileStep
              displayName={displayName}
              handicap={handicap}
              onDisplayNameChange={setDisplayName}
              onHandicapChange={setHandicap}
              onNext={next}
              onBack={back}
            />
          )}
          {step === 2 && (
            <ClubStep
              clubs={clubs}
              homeClubId={homeClubId}
              onHomeClubChange={setHomeClubId}
              onNext={next}
              onBack={back}
            />
          )}
          {step === 3 && (
            <RecommendationStep
              maxDistance={recMaxDistance}
              preferHcp={recPreferHcp}
              formats={recFormats}
              onMaxDistanceChange={setRecMaxDistance}
              onPreferHcpChange={setRecPreferHcp}
              onFormatsChange={setRecFormats}
              onNext={next}
              onBack={back}
            />
          )}
          {step === 4 && (
            <NotificationStep
              notifyReminder={notifyReminder}
              notifyNearby={notifyNearby}
              notifyHcp={notifyHcp}
              onReminderChange={setNotifyReminder}
              onNearbyChange={setNotifyNearby}
              onHcpChange={setNotifyHcp}
              onFinish={finish}
              onBack={back}
              saving={saving}
            />
          )}
          {step === TOTAL_STEPS && (
            <FinishStep onGoToApp={goToApp} displayName={displayName} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Step 0: Welcome ─── */
function WelcomeStep({ email, onNext }: { email: string; onNext: () => void }) {
  return (
    <div className="text-center">
      <div className="w-20 h-20 bg-accent/10 rounded-2xl flex items-center justify-center mx-auto mb-6 dark:bg-[#1a3329]">
        <Flag size={36} className="text-accent" />
      </div>
      <h1 className="text-3xl font-bold mb-2">Willkommen bei The Pin</h1>
      <p className="text-gray-500 mb-8 text-lg">
        Dein persönlicher Golf-Turnierkalender.
      </p>
      <p className="text-sm text-gray-400 mb-8">
        Angemeldet als <span className="font-medium text-gray-600">{email}</span>
      </p>
      <button
        onClick={onNext}
        className="w-full py-3 bg-accent text-white font-semibold rounded-xl hover:bg-accent/90 transition-colors text-base flex items-center justify-center gap-2"
      >
        Los geht&apos;s
        <ChevronRight size={18} />
      </button>
      <button
        onClick={() => window.location.href = '/turniere'}
        className="w-full mt-3 py-2.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
      >
        Überspringen
      </button>
    </div>
  );
}

/* ─── Step 1: Profile ─── */
function ProfileStep({
  displayName,
  handicap,
  onDisplayNameChange,
  onHandicapChange,
  onNext,
  onBack,
}: {
  displayName: string;
  handicap: string;
  onDisplayNameChange: (v: string) => void;
  onHandicapChange: (v: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center dark:bg-blue-900/30">
          <User size={20} className="text-blue-500" />
        </div>
        <div>
          <h2 className="text-xl font-bold">Dein Profil</h2>
          <p className="text-sm text-gray-400">Wie sollen wir dich nennen?</p>
        </div>
      </div>

      <div className="space-y-4 mb-8">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Name
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => onDisplayNameChange(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
            placeholder="Dein Vorname oder Spitzname"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Handicap
          </label>
          <input
            type="number"
            step="0.1"
            min="-10"
            max="54"
            value={handicap}
            onChange={(e) => onHandicapChange(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
            placeholder="z.B. 18.4"
          />
          <p className="text-xs text-gray-400 mt-1.5">
            Damit zeigen wir dir passende Turniere.
          </p>
        </div>
      </div>

      <StepButtons onNext={onNext} onBack={onBack} />
    </div>
  );
}

/* ─── Step 2: Home Club ─── */
function ClubStep({
  clubs,
  homeClubId,
  onHomeClubChange,
  onNext,
  onBack,
}: {
  clubs: Pick<GolfClub, 'id' | 'name' | 'city'>[];
  homeClubId: string;
  onHomeClubChange: (id: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedClub = clubs.find((c) => c.id === homeClubId);

  const normalize = (s: string) => s.toLowerCase().replace(/[^a-zäöüß0-9]/g, '');
  const q = normalize(query);
  const filtered = q
    ? clubs.filter((c) => normalize(c.name + ' ' + (c.city ?? '')).includes(q)).slice(0, 6)
    : [];

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center dark:bg-[#1a3329]">
          <MapPin size={20} className="text-accent" />
        </div>
        <div>
          <h2 className="text-xl font-bold">Dein Heimatclub</h2>
          <p className="text-sm text-gray-400">Für Turniere in deiner Nähe.</p>
        </div>
      </div>

      {/* Selected club */}
      {selectedClub && (
        <div className="flex items-center justify-between bg-accent/5 border border-accent/20 rounded-xl px-4 py-3 mb-4 dark:bg-[#1a3329] dark:border-[#2d4a3a]">
          <div>
            <div className="text-sm font-semibold">{selectedClub.name}</div>
            {selectedClub.city && (
              <div className="text-xs text-gray-500">{selectedClub.city}</div>
            )}
          </div>
          <button
            onClick={() => onHomeClubChange('')}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            Ändern
          </button>
        </div>
      )}

      {/* Search */}
      {!selectedClub && (
        <>
          <div className="relative mb-3">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              placeholder="Club suchen..."
              autoFocus
            />
          </div>

          {q && filtered.length > 0 && (
            <div className="border border-gray-200 rounded-xl overflow-hidden mb-4 divide-y divide-gray-100">
              {filtered.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { onHomeClubChange(c.id); setQuery(''); }}
                  className="w-full text-left px-4 py-3 text-sm hover:bg-accent/5 transition-colors flex items-center justify-between"
                >
                  <div>
                    <span className="font-medium">{c.name}</span>
                    {c.city && <span className="text-gray-400 ml-1.5">({c.city})</span>}
                  </div>
                  <ChevronRight size={14} className="text-gray-300" />
                </button>
              ))}
            </div>
          )}

          {q && filtered.length === 0 && (
            <div className="text-center py-6 text-sm text-gray-400">
              Kein Club gefunden
            </div>
          )}
        </>
      )}

      <div className="mt-6">
        <StepButtons onNext={onNext} onBack={onBack} nextLabel={homeClubId ? 'Weiter' : 'Überspringen'} />
      </div>
    </div>
  );
}

/* ─── Step 3: Notifications ─── */
function NotificationStep({
  notifyReminder,
  notifyNearby,
  notifyHcp,
  onReminderChange,
  onNearbyChange,
  onHcpChange,
  onFinish,
  onBack,
  saving,
}: {
  notifyReminder: boolean;
  notifyNearby: boolean;
  notifyHcp: boolean;
  onReminderChange: (v: boolean) => void;
  onNearbyChange: (v: boolean) => void;
  onHcpChange: (v: boolean) => void;
  onFinish: () => void;
  onBack: () => void;
  saving: boolean;
}) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center dark:bg-amber-900/30">
          <Trophy size={20} className="text-amber-500" />
        </div>
        <div>
          <h2 className="text-xl font-bold">Benachrichtigungen</h2>
          <p className="text-sm text-gray-400">Verpasse kein Turnier mehr.</p>
        </div>
      </div>

      <div className="space-y-1 mb-8">
        <NotifOption
          label="Turnier-Erinnerungen"
          description="Erinnerung vor gespeicherten Turnieren"
          checked={notifyReminder}
          onChange={onReminderChange}
        />
        <NotifOption
          label="Neue Turniere in der Nähe"
          description="Turniere bei deinem Heimatclub"
          checked={notifyNearby}
          onChange={onNearbyChange}
        />
        <NotifOption
          label="HCP-passende Turniere"
          description="Turniere die zu deinem Handicap passen"
          checked={notifyHcp}
          onChange={onHcpChange}
        />
      </div>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="px-4 py-3 text-sm font-medium text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          onClick={onFinish}
          disabled={saving}
          className="flex-1 py-3 bg-accent text-white font-semibold rounded-xl hover:bg-accent/90 transition-colors text-base flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {saving ? 'Wird gespeichert...' : 'Profil speichern'}
          {!saving && <Sparkles size={16} />}
        </button>
      </div>
    </div>
  );
}

/* ─── Step 4: Finish ─── */
function FinishStep({ onGoToApp, displayName }: { onGoToApp: () => void; displayName: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setShow(true));
  }, []);

  return (
    <div className={`text-center transition-all duration-700 ${show ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
      {/* Animated checkmark */}
      <div className="relative w-24 h-24 mx-auto mb-6">
        <div className="absolute inset-0 bg-accent/10 rounded-full animate-ping" style={{ animationDuration: '2s' }} />
        <div className="relative w-24 h-24 bg-accent rounded-full flex items-center justify-center">
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-all duration-500 delay-300 ${show ? 'opacity-100' : 'opacity-0'}`}
          >
            <path d="M5 13l4 4L19 7" className={show ? 'animate-draw' : ''} />
          </svg>
        </div>
      </div>

      <h2 className="text-2xl font-bold mb-2">
        {displayName ? `Perfekt, ${displayName}!` : 'Alles fertig!'}
      </h2>
      <p className="text-gray-500 mb-2 text-base">
        Dein Profil ist eingerichtet.
      </p>
      <p className="text-sm text-gray-400 mb-8">
        Entdecke jetzt Golfturniere in ganz Deutschland.
      </p>

      <button
        onClick={onGoToApp}
        className="w-full py-3 bg-accent text-white font-semibold rounded-xl hover:bg-accent/90 transition-colors text-base flex items-center justify-center gap-2"
      >
        Turniere entdecken
        <ChevronRight size={18} />
      </button>
    </div>
  );
}

/* ─── Step 3: Recommendations ─── */
function RecommendationStep({
  maxDistance,
  preferHcp,
  formats,
  onMaxDistanceChange,
  onPreferHcpChange,
  onFormatsChange,
  onNext,
  onBack,
}: {
  maxDistance: string;
  preferHcp: boolean;
  formats: string[];
  onMaxDistanceChange: (v: string) => void;
  onPreferHcpChange: (v: boolean) => void;
  onFormatsChange: (v: string[]) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const formatOptions = Object.entries(FORMAT_LABELS);

  function toggleFormat(f: string) {
    if (formats.includes(f)) {
      onFormatsChange(formats.filter((x) => x !== f));
    } else {
      onFormatsChange([...formats, f]);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center dark:bg-purple-900/30">
          <Target size={20} className="text-purple-500" />
        </div>
        <div>
          <h2 className="text-xl font-bold">Turniere für dich</h2>
          <p className="text-sm text-gray-400">Wir empfehlen dir passende Turniere.</p>
        </div>
      </div>

      {/* Explanation */}
      <div className="bg-accent/5 dark:bg-[#1a3329] rounded-xl p-4 mb-6 text-sm text-gray-600 dark:text-[#b8b8b8]">
        <div className="flex items-start gap-2">
          <Sparkles size={16} className="text-accent shrink-0 mt-0.5" />
          <div>
            <span className="font-medium text-gray-900 dark:text-[#f5f5f5]">So funktioniert &quot;Für dich&quot;:</span>
            <ul className="mt-1.5 space-y-1 text-xs text-gray-500 dark:text-[#a0a0a0]">
              <li>Dein <strong>Handicap</strong> filtert Turniere, die du spielen kannst</li>
              <li>Dein <strong>Heimatclub</strong> bestimmt Turniere in deiner Nähe</li>
              <li>Deine <strong>Favoriten-Clubs</strong> werden bevorzugt</li>
              <li>Die Einstellungen unten verfeinern die Empfehlungen</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="space-y-5 mb-8">
        {/* Max distance */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
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
                type="button"
                onClick={() => onMaxDistanceChange(opt.value)}
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
          type="button"
          onClick={() => onPreferHcpChange(!preferHcp)}
          className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-left transition-colors ${
            preferHcp
              ? 'bg-accent/5 border border-accent/20 dark:bg-[#1a3329] dark:border-[#2d4a3a]'
              : 'bg-white border border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
            preferHcp ? 'bg-accent border-accent' : 'border-gray-300'
          }`}>
            {preferHcp && (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium">HCP-relevante Turniere bevorzugen</div>
            <div className="text-xs text-gray-400">Wichtig wenn du dein Handicap verbessern willst</div>
          </div>
        </button>

        {/* Preferred formats */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Bevorzugte Spielformen
          </label>
          <p className="text-xs text-gray-400 mb-2">Optional – leer lassen für alle Formate</p>
          <div className="flex flex-wrap gap-2">
            {formatOptions.map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => toggleFormat(value)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  formats.includes(value)
                    ? 'bg-accent text-white border-accent'
                    : 'bg-gray-100 text-gray-700 border-gray-200 hover:border-gray-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <StepButtons onNext={onNext} onBack={onBack} />
    </div>
  );
}

/* ─── Shared Components ─── */

function StepButtons({
  onNext,
  onBack,
  nextLabel = 'Weiter',
}: {
  onNext: () => void;
  onBack: () => void;
  nextLabel?: string;
}) {
  return (
    <div className="flex gap-3">
      <button
        onClick={onBack}
        className="px-4 py-3 text-sm font-medium text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
      >
        <ChevronLeft size={16} />
      </button>
      <button
        onClick={onNext}
        className="flex-1 py-3 bg-accent text-white font-semibold rounded-xl hover:bg-accent/90 transition-colors text-base flex items-center justify-center gap-2"
      >
        {nextLabel}
        <ChevronRight size={18} />
      </button>
    </div>
  );
}

function NotifOption({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-left transition-colors ${
        checked
          ? 'bg-accent/5 border border-accent/20 dark:bg-[#1a3329] dark:border-[#2d4a3a]'
          : 'bg-white border border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
        checked ? 'bg-accent border-accent' : 'border-gray-300'
      }`}>
        {checked && (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-gray-400">{description}</div>
      </div>
    </button>
  );
}
