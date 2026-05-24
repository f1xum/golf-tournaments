import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Impressum',
  description: 'Impressum und Anbieterkennzeichnung von The Pin.',
  alternates: { canonical: 'https://thepin.app/impressum' },
  robots: { index: true, follow: false },
};

// Hinweis: §5 TMG wurde 2024 in §5 DDG (Digitale-Dienste-Gesetz) überführt – inhaltlich
// identisch. Bezeichnung „TMG“ ist weiterhin geläufig und rechtlich unschädlich.

export default function ImpressumPage() {
  return (
    <article className="max-w-2xl mx-auto py-8 text-sm leading-relaxed text-gray-700 dark:text-gray-300 [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:mb-6 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-6 [&_h2]:mb-2 [&_p]:mb-4 [&_a]:text-accent [&_a]:underline hover:[&_a]:no-underline">
      <h1>Impressum</h1>

      <p className="text-sm text-gray-500">
        Angaben gemäß § 5 TMG
      </p>

      <h2>Anbieter</h2>
      <p>
        Phillip Kickum<br />
        Karolinenplatz 2<br />
        80333 München<br />
        Deutschland
      </p>

      <h2>Kontakt</h2>
      <p>
        E-Mail: <a href="mailto:info@thepin.app">info@thepin.app</a>
      </p>

      <h2>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
      <p>
        Phillip Kickum<br />
        Anschrift wie oben
      </p>

      <h2>EU-Streitschlichtung</h2>
      <p>
        Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:{' '}
        <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noopener noreferrer">
          https://ec.europa.eu/consumers/odr/
        </a>
        . Unsere E-Mail-Adresse findest du oben im Impressum.
      </p>

      <h2>Verbraucherstreitbeilegung / Universalschlichtungsstelle</h2>
      <p>
        Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer
        Verbraucherschlichtungsstelle teilzunehmen.
      </p>

      <h2>Haftung für Inhalte</h2>
      <p>
        Als Diensteanbieter sind wir gemäß § 7 Abs. 1 TMG für eigene Inhalte auf diesen Seiten nach
        den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 TMG sind wir als Diensteanbieter
        jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen
        oder nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen.
        Verpflichtungen zur Entfernung oder Sperrung der Nutzung von Informationen nach den
        allgemeinen Gesetzen bleiben hiervon unberührt.
      </p>
      <p>
        Turnier- und Clubdaten auf The Pin werden aus öffentlich zugänglichen Quellen (insb.
        PC&nbsp;CADDIE-Webportalen der jeweiligen Golfclubs) aggregiert. Für die inhaltliche
        Richtigkeit und Aktualität der einzelnen Turnierausschreibungen sind die jeweiligen
        Veranstalter verantwortlich. Hinweise zu fehlerhaften Inhalten bitte an{' '}
        <a href="mailto:info@thepin.app">info@thepin.app</a>.
      </p>

      <h2>Haftung für Links</h2>
      <p>
        Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen
        Einfluss haben. Deshalb können wir für diese fremden Inhalte auch keine Gewähr übernehmen.
        Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der
        Seiten verantwortlich.
      </p>

      <h2>Urheberrecht</h2>
      <p>
        Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen dem
        deutschen Urheberrecht. Beiträge Dritter sind als solche gekennzeichnet.
      </p>
    </article>
  );
}
