import type { Metadata } from 'next';
import Nav from '@/components/nav';
import BottomNav from '@/components/bottom-nav';
import RouteProgress from '@/components/route-progress';
import './globals.css';

export const metadata: Metadata = {
  title: 'The Pin – Golfturniere in Deutschland',
  description: 'Finde und speichere Golfturniere in Deutschland',
  viewport: 'width=device-width, initial-scale=1, viewport-fit=cover',
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
      </body>
    </html>
  );
}
