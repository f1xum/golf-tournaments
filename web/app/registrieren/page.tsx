'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (password.length < 6) {
      setError('Das Passwort muss mindestens 6 Zeichen lang sein.');
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({ email, password });

    if (error) {
      setError('Registrierung fehlgeschlagen. Bitte versuche es erneut.');
      setLoading(false);
    } else {
      router.push('/profil');
      router.refresh();
    }
  }

  return (
    <div className="py-12 max-w-sm mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-center">Registrieren</h1>

      <form onSubmit={handleRegister} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            E-Mail
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
            placeholder="deine@email.de"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Passwort
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
            placeholder="Mindestens 6 Zeichen"
          />
        </div>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-accent text-white font-medium rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50"
        >
          {loading ? 'Wird registriert...' : 'Konto erstellen'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        Bereits registriert?{' '}
        <Link href="/login" className="text-accent hover:underline font-medium">
          Anmelden
        </Link>
      </p>
    </div>
  );
}
