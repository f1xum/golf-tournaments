'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { CheckCircle } from 'lucide-react';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
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
    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      setError('Registrierung fehlgeschlagen. Bitte versuche es erneut.');
      setLoading(false);
      return;
    }

    setSuccess(true);

    // If session exists, user is logged in immediately (no email confirmation required)
    if (data.session) {
      setTimeout(() => {
        router.push('/profil/einstellungen');
        router.refresh();
      }, 2000);
    } else {
      // Email confirmation required
      setNeedsConfirmation(true);
    }
  }

  if (success) {
    return (
      <div className="py-16 max-w-sm mx-auto text-center">
        <div className="w-16 h-16 bg-accent-light rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle size={32} className="text-accent" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Willkommen bei The Pin!</h1>
        {needsConfirmation ? (
          <>
            <p className="text-gray-500 mb-6">
              Wir haben dir eine E-Mail an <span className="font-medium text-gray-700">{email}</span> geschickt.
              Bitte bestätige deine E-Mail-Adresse, um fortzufahren.
            </p>
            <Link
              href="/login"
              className="inline-block px-6 py-2.5 bg-accent text-white font-medium rounded-lg hover:bg-accent/90 transition-colors"
            >
              Zur Anmeldung
            </Link>
          </>
        ) : (
          <>
            <p className="text-gray-500 mb-2">
              Dein Konto wurde erfolgreich erstellt.
            </p>
            <p className="text-sm text-gray-400">
              Du wirst gleich weitergeleitet...
            </p>
            <div className="mt-4">
              <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          </>
        )}
      </div>
    );
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
