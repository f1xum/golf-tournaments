import type { Metadata } from 'next';
import Nav from '@/components/nav';
import './globals.css';

export const metadata: Metadata = {
  title: 'Golf Turniere Bayern',
  description: 'Alle Golfturniere in Bayern auf einen Blick',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body className="antialiased">
        <Nav />
        <main className="max-w-4xl mx-auto px-4 pb-20">{children}</main>
      </body>
    </html>
  );
}
