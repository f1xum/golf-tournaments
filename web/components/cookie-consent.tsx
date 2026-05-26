'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';
import * as CookieConsent from 'vanilla-cookieconsent';
import 'vanilla-cookieconsent/dist/cookieconsent.css';
import { shouldTrack } from '@/lib/tracking-opt-out';

export default function CookieConsentManager() {
  const [analyticsAllowed, setAnalyticsAllowed] = useState(false);
  const [trackingOk, setTrackingOk] = useState(false);

  useEffect(() => {
    shouldTrack().then(setTrackingOk);
  }, []);

  useEffect(() => {
    CookieConsent.run({
      guiOptions: {
        consentModal: {
          layout: 'cloud',
          position: 'bottom right',
          equalWeightButtons: true,
          flipButtons: false,
        },
        preferencesModal: {
          layout: 'box',
          position: 'right',
          equalWeightButtons: true,
          flipButtons: false,
        },
      },
      categories: {
        necessary: {
          enabled: true,
          readOnly: true,
        },
        analytics: {
          enabled: false,
          autoClear: {
            cookies: [
              { name: /^_cs_/ },
              { name: /^_hj/ },
            ],
          },
        },
      },
      language: {
        default: 'de',
        translations: {
          de: {
            consentModal: {
              title: 'Cookies & Analyse',
              description:
                'Wir verwenden ein Analyse-Tool (Contentsquare), um zu verstehen, wie The Pin genutzt wird, und die Seite zu verbessern. Du entscheidest – auch ablehnen ist okay.',
              acceptAllBtn: 'Alle akzeptieren',
              acceptNecessaryBtn: 'Ablehnen',
              showPreferencesBtn: 'Einstellungen',
              footer:
                '<a href="/datenschutz">Datenschutz</a> · <a href="/impressum">Impressum</a>',
            },
            preferencesModal: {
              title: 'Cookie-Einstellungen',
              acceptAllBtn: 'Alle akzeptieren',
              acceptNecessaryBtn: 'Alle ablehnen',
              savePreferencesBtn: 'Auswahl speichern',
              closeIconLabel: 'Schließen',
              sections: [
                {
                  title: 'Worum geht es?',
                  description:
                    'The Pin verwendet nur die wirklich notwendigen Cookies. Optionale Analyse-Cookies helfen uns, die Seite zu verbessern – aber nur, wenn du zustimmst. Du kannst deine Auswahl jederzeit hier ändern.',
                },
                {
                  title: 'Notwendige Cookies',
                  description:
                    'Für den Betrieb der Seite erforderlich (z. B. Login-Session, gespeicherte Filter, dein Cookie-Consent selbst). Lassen sich nicht deaktivieren.',
                  linkedCategory: 'necessary',
                },
                {
                  title: 'Analyse (Contentsquare / Hotjar)',
                  description:
                    'Hilft uns zu verstehen, wie The Pin genutzt wird (Klicks, Scrollverhalten, Sitzungsaufzeichnungen ohne Eingabefelder). Anbieter: Contentsquare SAS, Frankreich. Datenübertragung in die EU. Speicherdauer: bis zu 13 Monate.',
                  linkedCategory: 'analytics',
                },
                {
                  title: 'Mehr Informationen',
                  description:
                    'Details findest du in unserer <a href="/datenschutz">Datenschutzerklärung</a>. Bei Fragen erreichst du uns unter <a href="mailto:info@thepin.app">info@thepin.app</a>.',
                },
              ],
            },
          },
        },
      },
      onConsent: () => {
        setAnalyticsAllowed(CookieConsent.acceptedCategory('analytics'));
      },
      onChange: () => {
        setAnalyticsAllowed(CookieConsent.acceptedCategory('analytics'));
      },
    });
  }, []);

  if (!analyticsAllowed || !trackingOk) return null;

  return (
    <Script
      src="https://t.contentsquare.net/uxa/97253ff038e20.js"
      strategy="afterInteractive"
    />
  );
}
