import type { Metadata } from 'next';
import Nav from '@/components/nav';
import './globals.css';

export const metadata: Metadata = {
  title: 'The Pin – Golfturniere in Bayern',
  description: 'Finde und speichere Golfturniere in Bayern',
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
