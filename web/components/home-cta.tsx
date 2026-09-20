'use client';

import Link from 'next/link';
import { Sparkles, UserPlus, MapPin, Target, Heart, SlidersHorizontal, ArrowRight } from 'lucide-react';
import { useViewer } from '@/lib/use-viewer';

/**
 * The only part of the homepage that depends on who is looking. Kept client-side
 * so the page itself stays static — the signed-out version is what gets
 * prerendered and what crawlers see.
 */
export default function HomeCta() {
  const { userId } = useViewer();
  const isLoggedIn = !!userId;

  return (
    <>
      {/* For You CTA — logged in */}
      {isLoggedIn && (
        <Link
          href="/fuer-dich"
          className="group block mb-8 bg-accent text-white rounded-xl p-5 shadow-sm hover:shadow-md hover:bg-accent/95 transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0">
              <Sparkles size={24} className="text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-base leading-snug">
                Zeig mir meine personalisierten Turniere
              </div>
              <div className="text-sm text-white/80 mt-0.5">
                Empfehlungen basierend auf deinem Profil
              </div>
            </div>
            <ArrowRight size={20} className="text-white/80 group-hover:translate-x-0.5 transition-transform shrink-0" />
          </div>
        </Link>
      )}

      {/* For You CTA — not logged in */}
      {!isLoggedIn && (
        <div className="mb-8 bg-accent-light dark:bg-[#1a2b22] border border-accent/20 dark:border-[#2d4a3a] rounded-xl p-6">
          <div className="text-center mb-4">
            <Sparkles size={22} className="text-accent mx-auto mb-2" />
            <h2 className="text-lg font-bold mb-1">Golfturniere, die zu dir passen</h2>
            <p className="text-sm text-gray-600 dark:text-[#b8b8b8]">
              Für dich personalisierte Empfehlungen basierend auf deinem Profil
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-5 text-left">
            <div className="flex items-start gap-2 bg-white/60 dark:bg-white/5 rounded-lg px-3 py-2.5">
              <MapPin size={14} className="text-accent shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-semibold">In deiner Nähe</div>
                <div className="text-[11px] text-gray-500">Turniere rund um deinen Heimatclub</div>
              </div>
            </div>
            <div className="flex items-start gap-2 bg-white/60 dark:bg-white/5 rounded-lg px-3 py-2.5">
              <Target size={14} className="text-accent shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-semibold">Passend zu deinem HCP</div>
                <div className="text-[11px] text-gray-500">Nur Turniere, die du spielen kannst</div>
              </div>
            </div>
            <div className="flex items-start gap-2 bg-white/60 dark:bg-white/5 rounded-lg px-3 py-2.5">
              <Heart size={14} className="text-accent shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-semibold">Deine Lieblingsclubs</div>
                <div className="text-[11px] text-gray-500">Turniere bei Clubs, die du liebst</div>
              </div>
            </div>
            <div className="flex items-start gap-2 bg-white/60 dark:bg-white/5 rounded-lg px-3 py-2.5">
              <SlidersHorizontal size={14} className="text-accent shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-semibold">Deine Spielformen</div>
                <div className="text-[11px] text-gray-500">Stableford, Scramble & mehr</div>
              </div>
            </div>
          </div>

          <div className="text-center">
            <Link
              href="/registrieren"
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors"
            >
              <UserPlus size={16} />
              Kostenlos registrieren
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
