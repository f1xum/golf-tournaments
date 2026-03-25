'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { CheckCircle } from 'lucide-react';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
      <path d="M3.964 10.706A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.962L3.964 7.294C4.672 5.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

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

  async function handleGoogleSignUp() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/profil/einstellungen`,
      },
    });
  }

  return (
    <div className="py-12 max-w-sm mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-center">Registrieren</h1>

      <button
        onClick={handleGoogleSignUp}
        className="w-full flex items-center justify-center gap-3 py-2.5 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <GoogleIcon />
        Mit Google registrieren
      </button>

      <div className="flex items-center gap-3 my-5">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-xs text-gray-400">oder</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

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
