import type { Metadata, Viewport } from 'next';
import Nav from '@/components/nav';
import BottomNav from '@/components/bottom-nav';
import RouteProgress from '@/components/route-progress';
import ProfileCompletionBanner from '@/components/profile-completion-banner';
import UsernameGate from '@/components/username-gate';
import QueryProvider from '@/components/query-provider';
import './globals.css';
import ConditionalVercelAnalytics from '@/components/conditional-vercel-analytics';
import PageTracker from '@/components/page-tracker';
import CookieConsentManager from '@/components/cookie-consent';
import SiteFooter from '@/components/site-footer';
import InstallPrompt from '@/components/install-prompt';

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
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'The Pin',
    statusBarStyle: 'default',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#2d6a4f' },
    { media: '(prefers-color-scheme: dark)', color: '#171717' },
  ],
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
        <QueryProvider>
          <RouteProgress />
          <Nav />
          <ProfileCompletionBanner />
          <main className="max-w-4xl lg:max-w-5xl mx-auto px-4">{children}</main>
          <SiteFooter />
          <BottomNav />
          <InstallPrompt />
          <UsernameGate />
          <ConditionalVercelAnalytics />
          <PageTracker />
        </QueryProvider>
        <CookieConsentManager />
      </body>
    </html>
  );
}
