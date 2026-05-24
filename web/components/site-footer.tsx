'use client';

import Link from 'next/link';
import * as CookieConsent from 'vanilla-cookieconsent';

export default function SiteFooter() {
  return (
    <footer className="mt-12 pb-24 sm:pb-8 px-4 text-center text-xs text-gray-400">
      <div className="flex items-center justify-center gap-3 flex-wrap">
        <Link href="/datenschutz" className="hover:text-gray-600 transition-colors">
          Datenschutz
        </Link>
        <span aria-hidden="true">·</span>
        <Link href="/impressum" className="hover:text-gray-600 transition-colors">
          Impressum
        </Link>
        <span aria-hidden="true">·</span>
        <a href="mailto:info@thepin.app" className="hover:text-gray-600 transition-colors">
          Kontakt
        </a>
        <span aria-hidden="true">·</span>
        <button
          type="button"
          onClick={() => CookieConsent.showPreferences()}
          className="hover:text-gray-600 transition-colors"
        >
          Cookie-Einstellungen
        </button>
      </div>
    </footer>
  );
}
