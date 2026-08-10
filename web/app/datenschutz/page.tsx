import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Datenschutzerklärung',
  description: 'Datenschutzerklärung von The Pin – Informationen zur Verarbeitung personenbezogener Daten nach DSGVO.',
  alternates: { canonical: 'https://thepin.app/datenschutz' },
  robots: { index: true, follow: false },
};

export default function DatenschutzPage() {
  return (
    <article className="max-w-2xl mx-auto py-8 text-sm leading-relaxed text-gray-700 dark:text-gray-300 [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:mb-6 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-6 [&_h2]:mb-2 [&_p]:mb-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-4 [&_li]:mb-1 [&_a]:text-accent [&_a]:underline hover:[&_a]:no-underline">
      <h1>Datenschutzerklärung</h1>

      <p className="text-sm text-gray-500">
        Stand: August 2026
      </p>

      <h2>1. Verantwortlicher</h2>
      <p>
        Verantwortlich für die Datenverarbeitung auf dieser Website ist:
      </p>
      <p>
        Phillip Kickum<br />
        Karolinenplatz 2<br />
        80333 München<br />
        Deutschland<br />
        E-Mail: <a href="mailto:info@thepin.app">info@thepin.app</a>
      </p>

      <h2>2. Allgemeines zur Datenverarbeitung</h2>
      <p>
        Wir verarbeiten personenbezogene Daten nur, soweit dies zur Bereitstellung einer
        funktionsfähigen Website sowie unserer Inhalte und Leistungen erforderlich ist oder du
        eingewilligt hast. Rechtsgrundlagen sind in der Regel Art. 6 Abs. 1 lit. a DSGVO
        (Einwilligung), Art. 6 Abs. 1 lit. b DSGVO (Vertrag/vorvertragliche Maßnahmen) und
        Art. 6 Abs. 1 lit. f DSGVO (berechtigte Interessen).
      </p>

      <h2>3. Hosting (Vercel)</h2>
      <p>
        Diese Website wird bei Vercel Inc., 340 S Lemon Ave #4133, Walnut, CA 91789, USA gehostet.
        Beim Aufruf werden technisch notwendige Daten (insbesondere IP-Adresse, Zeitstempel,
        aufgerufene URL, Browser-Informationen) verarbeitet. Vercel betreibt EU-Edge-Knoten;
        ergänzend kann eine Übermittlung in die USA stattfinden, abgesichert über die
        Standardvertragsklauseln der EU-Kommission. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO
        (Betrieb der Website).
      </p>
      <p>
        Weitere Informationen:{' '}
        <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">
          vercel.com/legal/privacy-policy
        </a>
        .
      </p>

      <h2>4. Konto und Login (Supabase)</h2>
      <p>
        Wenn du dich registrierst, verarbeiten wir deine E-Mail-Adresse, ein verschlüsseltes
        Passwort sowie freiwillige Profilangaben (Anzeigename, Heimatclub, Handicap,
        Benachrichtigungseinstellungen). Authentifizierung und Datenspeicherung erfolgen über
        Supabase (Supabase Inc., 970 Toa Payoh North, Singapore) auf Servern in der EU
        (Region eu-central-1, Frankfurt). Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO
        (Nutzungsvertrag).
      </p>
      <p>
        Speicherdauer: bis zur Löschung deines Kontos.
      </p>

      <h2>5. E-Mail-Benachrichtigungen (Resend)</h2>
      <p>
        Wenn du Benachrichtigungen aktiviert hast (z. B. Erinnerungen an Turniere), versenden wir
        E-Mails über den Dienstleister Resend (Resend, Inc., 2261 Market Street #5039, San
        Francisco, CA 94114, USA). Übertragen werden deine E-Mail-Adresse sowie die Inhalte der
        jeweiligen Benachrichtigung. Datentransfer in die USA auf Basis der EU-Standardvertrags&shy;klauseln.
        Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO bzw. Art. 6 Abs. 1 lit. a DSGVO bei
        opt-in-basierten Benachrichtigungen. Du kannst Benachrichtigungen jederzeit in deinen
        Profil-Einstellungen deaktivieren.
      </p>

      <h2>6. Reichweitenmessung (Vercel Analytics)</h2>
      <p>
        Wir nutzen Vercel Web Analytics zur datenschutzfreundlichen Erfassung anonymisierter
        Nutzungsstatistiken (z. B. Seitenaufrufe). Vercel Analytics verwendet <strong>keine
        Cookies</strong> und speichert keine IP-Adressen. Rechtsgrundlage: Art. 6 Abs. 1 lit. f
        DSGVO (berechtigtes Interesse an einer statistischen Auswertung).
      </p>

      <h2>7. Eigene Reichweitenmessung</h2>
      <p>
        Zusätzlich erfassen wir in unserer eigenen Datenbank (Supabase, siehe Ziffer 4), welche
        Seiten aufgerufen werden. Gespeichert werden der Pfad der aufgerufenen Seite und der
        Zeitpunkt des Aufrufs. <strong>Keine</strong> IP-Adressen, Geräte- oder
        Browserinformationen. Bist du eingeloggt, wird zusätzlich deine Nutzer-ID gespeichert,
        damit wir Aufrufe angemeldeter Nutzer von denen nicht angemeldeter Besucher unterscheiden
        können. Nicht angemeldete Aufrufe werden ohne jede Kennung gespeichert und lassen sich
        keiner Person zuordnen.
      </p>
      <p>
        Zweck: Wir wollen erkennen, welche Turniere und Clubs gefragt sind und ob angemeldete
        Nutzer die Plattform tatsächlich verwenden. Die Auswertung erfolgt ausschließlich intern
        und wird nicht an Dritte weitergegeben. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO
        (berechtigtes Interesse an einer statistischen Auswertung und Verbesserung des Angebots).
        Löschst du dein Konto, wird die Nutzer-ID aus den Aufrufdaten entfernt; die verbleibenden
        Aufrufe sind dann anonym. Du kannst der Erfassung jederzeit widersprechen (Art. 21 DSGVO)
        – eine Nachricht an <a href="mailto:info@thepin.app">info@thepin.app</a> genügt.
      </p>

      <h2>8. Analyse mit Einwilligung (Contentsquare / Hotjar)</h2>
      <p>
        <strong>Nur mit deiner ausdrücklichen Einwilligung</strong> setzen wir das Analyse-Tool
        Contentsquare (vormals Hotjar) ein. Anbieter ist die Contentsquare SAS, 8 rue Saint
        Fiacre, 75002 Paris, Frankreich. Contentsquare erstellt mit Hilfe von Cookies und
        ähnlichen Technologien pseudonymisierte Nutzungsprofile, z. B. zu Klick- und
        Scrollverhalten sowie Sitzungsaufzeichnungen (Tastatureingaben werden dabei standardmäßig
        maskiert).
      </p>
      <p>
        Verarbeitete Daten: u. a. anonymisierte IP-Adresse, Geräte- und Browserinformationen,
        Referrer-URL, Interaktionsereignisse, ungefähre Standortdaten (Land/Region).
        Datenverarbeitung in der EU. Speicherdauer: bis zu 13 Monate. Rechtsgrundlage: Art. 6
        Abs. 1 lit. a DSGVO (Einwilligung), § 25 Abs. 1 TDDDG. Du kannst deine Einwilligung
        jederzeit über den Link „Cookie-Einstellungen“ im Footer widerrufen.
      </p>
      <p>
        Weitere Informationen:{' '}
        <a href="https://contentsquare.com/privacy/" target="_blank" rel="noopener noreferrer">
          contentsquare.com/privacy
        </a>
        .
      </p>

      <h2>9. Kartendarstellung (OpenStreetMap / CARTO)</h2>
      <p>
        Karten werden über den Tile-Dienst von CARTO (CARTO, 201 Moore St, Brooklyn, NY 11206,
        USA) auf Basis von OpenStreetMap-Daten ausgeliefert. Beim Laden der Karten wird deine
        IP-Adresse an die Server von CARTO übermittelt. Rechtsgrundlage: Art. 6 Abs. 1 lit. f
        DSGVO (berechtigtes Interesse an einer ansprechenden Darstellung von Standortdaten).
      </p>

      <h2>10. Cookies und lokale Speicherung</h2>
      <p>
        Wir verwenden ausschließlich technisch notwendige Cookies und solche, denen du aktiv
        zugestimmt hast. Notwendige Speicherung umfasst insbesondere deine Login-Session, deine
        Cookie-Einwilligung selbst sowie lokale Einstellungen (z. B. Dark-Mode, Filterzustand).
        Rechtsgrundlage für notwendige Cookies: § 25 Abs. 2 Nr. 2 TDDDG i.&nbsp;V.&nbsp;m. Art. 6
        Abs. 1 lit. f DSGVO.
      </p>

      <h2>11. Deine Rechte</h2>
      <p>
        Dir stehen folgende Rechte zu:
      </p>
      <ul>
        <li>Auskunft über die zu deiner Person verarbeiteten Daten (Art. 15 DSGVO)</li>
        <li>Berichtigung unrichtiger Daten (Art. 16 DSGVO)</li>
        <li>Löschung („Recht auf Vergessenwerden“, Art. 17 DSGVO)</li>
        <li>Einschränkung der Verarbeitung (Art. 18 DSGVO)</li>
        <li>Datenübertragbarkeit (Art. 20 DSGVO)</li>
        <li>Widerspruch gegen die Verarbeitung (Art. 21 DSGVO)</li>
        <li>Widerruf erteilter Einwilligungen mit Wirkung für die Zukunft (Art. 7 Abs. 3 DSGVO)</li>
      </ul>
      <p>
        Zur Ausübung deiner Rechte genügt eine formlose Nachricht an{' '}
        <a href="mailto:info@thepin.app">info@thepin.app</a>.
      </p>

      <h2>12. Beschwerderecht bei der Aufsichtsbehörde</h2>
      <p>
        Unbeschadet anderer Rechtsbehelfe steht dir ein Beschwerderecht bei einer
        Datenschutz-Aufsichtsbehörde zu, insbesondere in dem Mitgliedstaat deines gewöhnlichen
        Aufenthaltsorts (Art. 77 DSGVO). Zuständige Behörde in Bayern: Bayerisches
        Landesamt für Datenschutzaufsicht, Promenade 18, 91522 Ansbach.
      </p>

      <h2>13. Änderungen dieser Datenschutzerklärung</h2>
      <p>
        Wir behalten uns vor, diese Datenschutzerklärung anzupassen, damit sie stets den
        aktuellen rechtlichen Anforderungen entspricht oder um Änderungen unserer Leistungen
        umzusetzen. Für deinen erneuten Besuch gilt dann die neue Datenschutzerklärung.
      </p>
    </article>
  );
}
