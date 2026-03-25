import type { Metadata } from 'next';
import Nav from '@/components/nav';
import BottomNav from '@/components/bottom-nav';
import RouteProgress from '@/components/route-progress';
import './globals.css';

export const metadata: Metadata = {
  title: 'The Pin – Golfturniere in Bayern',
  description: 'Finde und speichere Golfturniere in Bayern',
  viewport: 'width=device-width, initial-scale=1, viewport-fit=cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body className="antialiased">
        <RouteProgress />
        <Nav />
        <main className="max-w-4xl mx-auto px-4 pb-24 sm:pb-20">{children}</main>
        <BottomNav />
      </body>
    </html>
  );
}
