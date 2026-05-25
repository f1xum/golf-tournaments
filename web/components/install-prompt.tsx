'use client';

import { useEffect, useState } from 'react';
import { X, Share, Plus } from 'lucide-react';

const VISITS_KEY = 'pin_visits';
const DISMISSED_KEY = 'pin_install_dismissed';
const MIN_VISITS = 2;

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function isStandalone() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIOS() {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !('MSStream' in window);
}

function shouldShowInitially(): boolean {
  if (typeof window === 'undefined') return false;
  if (isStandalone()) return false;
  if (localStorage.getItem(DISMISSED_KEY) === '1') return false;

  const visits = Number(localStorage.getItem(VISITS_KEY) || '0') + 1;
  localStorage.setItem(VISITS_KEY, String(visits));
  if (visits < MIN_VISITS) return false;

  // On iOS show the manual hint immediately; on other platforms wait for
  // the beforeinstallprompt event before revealing the banner.
  return isIOS();
}

export default function InstallPrompt() {
  const [show, setShow] = useState(shouldShowInitially);
  const [bipEvent, setBipEvent] = useState<BIPEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isStandalone()) return;
    if (localStorage.getItem(DISMISSED_KEY) === '1') return;

    const onBIP = (e: Event) => {
      e.preventDefault();
      setBipEvent(e as BIPEvent);
      const visits = Number(localStorage.getItem(VISITS_KEY) || '0');
      if (visits >= MIN_VISITS) setShow(true);
    };
    window.addEventListener('beforeinstallprompt', onBIP);
    return () => window.removeEventListener('beforeinstallprompt', onBIP);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, '1');
    setShow(false);
    setShowIosHint(false);
  };

  const install = async () => {
    if (bipEvent) {
      await bipEvent.prompt();
      const { outcome } = await bipEvent.userChoice;
      if (outcome === 'accepted') {
        localStorage.setItem(DISMISSED_KEY, '1');
        setShow(false);
      }
    } else if (isIOS()) {
      setShowIosHint(true);
    }
  };

  if (!show) return null;

  return (
    <>
      <div
        className="fixed left-0 right-0 z-[9998] sm:hidden px-3 pb-[calc(env(safe-area-inset-bottom)+0.5rem)]"
        style={{ bottom: '4rem' }}
      >
        <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg bg-accent-light flex items-center justify-center flex-shrink-0"
            aria-hidden
          >
            <span className="text-lg">📌</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 leading-tight">
              The Pin als App
            </p>
            <p className="text-xs text-gray-600 leading-tight mt-0.5">
              Zur Startseite hinzufügen für schnellen Zugriff.
            </p>
          </div>
          <button
            onClick={install}
            className="text-xs font-medium px-3 py-2 rounded-lg bg-accent text-white flex-shrink-0"
          >
            {isIOS() ? 'Anleitung' : 'Installieren'}
          </button>
          <button
            onClick={dismiss}
            aria-label="Hinweis schließen"
            className="text-gray-400 hover:text-gray-600 flex-shrink-0"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {showIosHint && (
        <div
          className="fixed inset-0 z-[10000] bg-black/40 flex items-end sm:hidden"
          onClick={dismiss}
        >
          <div
            className="bg-white w-full rounded-t-2xl p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-3">
              <h2 className="text-base font-semibold text-gray-900">
                The Pin zur Startseite hinzufügen
              </h2>
              <button
                onClick={dismiss}
                aria-label="Schließen"
                className="text-gray-400 -mr-1 -mt-1"
              >
                <X size={20} />
              </button>
            </div>
            <ol className="text-sm text-gray-700 space-y-3">
              <li className="flex items-start gap-2">
                <span className="font-semibold text-gray-900">1.</span>
                <span className="flex items-center gap-1.5 flex-wrap">
                  Tippe auf <Share size={16} className="inline text-blue-500" /> unten in
                  Safari
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-semibold text-gray-900">2.</span>
                <span className="flex items-center gap-1.5 flex-wrap">
                  Wähle <Plus size={14} className="inline" /> &nbsp;&bdquo;Zum
                  Home-Bildschirm&ldquo;
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-semibold text-gray-900">3.</span>
                <span>Best&auml;tige mit &bdquo;Hinzuf&uuml;gen&ldquo;</span>
              </li>
            </ol>
          </div>
        </div>
      )}
    </>
  );
}
