import type { Metadata, Viewport } from 'next';
import Nav from '@/components/nav';
import BottomNav from '@/components/bottom-nav';
import RouteProgress from '@/components/route-progress';
import './globals.css';
import { Analytics } from "@vercel/analytics/next"

export const metadata: Metadata = {
  title: {
    default: 'The Pin – Golfturniere in Deutschland finden & vergleichen',
    template: '%s | The Pin',
  },
  description: 'Finde, vergleiche und speichere Golfturniere in ganz Deutschland. Über 800 Golfclubs, tausende Turniere – kostenlos auf The Pin.',
  keywords: ['Golfturnier', 'Golf', 'Turniere', 'Deutschland', 'Golfclub', 'Turnierkalender', 'HCP', 'Stableford', 'Golfplatz'],
  metadataBase: new URL('https://thepin.app'),
  openGraph: {
    type: 'website',
    locale: 'de_DE',
    url: 'https://thepin.app',
    siteName: 'The Pin',
    title: 'The Pin – Golfturniere in Deutschland',
    description: 'Finde, vergleiche und speichere Golfturniere in ganz Deutschland. Über 800 Golfclubs, tausende Turniere.',
  },
  twitter: {
    card: 'summary',
    title: 'The Pin – Golfturniere in Deutschland',
    description: 'Finde, vergleiche und speichere Golfturniere in ganz Deutschland.',
  },
  alternates: {
    canonical: 'https://thepin.app',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            try {
              var theme = localStorage.getItem('theme') || 'system';
              var dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
              if (dark) document.documentElement.classList.add('dark');
            } catch(e) {}
          })();
        `}} />
      </head>
      <body className="antialiased">
        <RouteProgress />
        <Nav />
        <main className="max-w-4xl mx-auto px-4 pb-24 sm:pb-20">{children}</main>
        <BottomNav />
        <Analytics />
      </body>
    </html>
  );
}
