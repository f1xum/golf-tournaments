// Username rules, in one place.
//
// Usernames are mandatory: they are collected during onboarding and enforced
// afterwards by <UsernameGate />, which blocks the app for any signed-in user
// who does not have one yet (accounts created before the requirement, and
// Google sign-ups that never finished onboarding).

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;

/** Strip anything not allowed, as the user types. Lowercase for case-insensitive uniqueness. */
export function normalizeUsername(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9_.-]/g, '').slice(0, USERNAME_MAX);
}

/**
 * Validation message for a username, or null when it is acceptable.
 * Returned in German because it is rendered straight into the UI.
 */
export function usernameError(raw: string): string | null {
  const u = raw.trim();
  if (u.length < USERNAME_MIN) {
    return `Mindestens ${USERNAME_MIN} Zeichen.`;
  }
  if (u.length > USERNAME_MAX) {
    return `Höchstens ${USERNAME_MAX} Zeichen.`;
  }
  if (!/^[a-z0-9][a-z0-9_.-]*$/.test(u)) {
    return 'Nur Kleinbuchstaben, Zahlen, Punkt, Bindestrich und Unterstrich. Muss mit einem Buchstaben oder einer Zahl beginnen.';
  }
  return null;
}

export function isValidUsername(raw: string): boolean {
  return usernameError(raw) === null;
}
