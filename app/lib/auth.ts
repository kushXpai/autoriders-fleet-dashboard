// app/lib/auth.ts
export interface User {
  username: string;
  role: 'developer' | 'superadmin' | 'admin' | 'manager' | 'branch';
  branches?: string[]; // manager accounts — list of branches they can access
}

// Bump this whenever credentials change and you want every existing
// logged-in session to be force-logged-out on their next page load.
const AUTH_VERSION = 3;

// Session length — after this, the stored session is treated as expired
// and the user is sent back to the login page.
const SESSION_DURATION_MS = 2 * 60 * 60 * 1000; // 2 hours

interface StoredSession {
  user: User;
  loginTime: number;
  version: number;
}

export function getStoredUser(): User | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem('fleet_user');
  if (!stored) return null;

  try {
    const session = JSON.parse(stored) as StoredSession;

    // Old sessions saved before this change won't have a version/loginTime
    // at all — treat those as invalid too, so this rollout force-logs-out
    // everyone currently signed in.
    if (!session.version || session.version !== AUTH_VERSION) {
      clearUser();
      return null;
    }

    const expired = Date.now() - session.loginTime > SESSION_DURATION_MS;
    if (expired) {
      clearUser();
      return null;
    }

    return session.user;
  } catch {
    clearUser();
    return null;
  }
}

export function storeUser(user: User): void {
  const session: StoredSession = {
    user,
    loginTime: Date.now(),
    version: AUTH_VERSION,
  };
  localStorage.setItem('fleet_user', JSON.stringify(session));
}

export function clearUser(): void {
  localStorage.removeItem('fleet_user');
}

/** Ends the server session (cookie) and clears the local copy. */
export async function signOut(): Promise<void> {
  try {
    await fetch('/api/logout', { method: 'POST' });
  } catch {
    // ignore — local session is cleared regardless
  }
  clearUser();
}

// How much longer (ms) the current session has, or 0 if there is none /
// it's expired. Useful for a "you'll be logged out in..." warning in the UI.
export function getSessionTimeRemaining(): number {
  if (typeof window === 'undefined') return 0;
  const stored = localStorage.getItem('fleet_user');
  if (!stored) return 0;
  try {
    const session = JSON.parse(stored) as StoredSession;
    if (!session.version || session.version !== AUTH_VERSION) return 0;
    const remaining = SESSION_DURATION_MS - (Date.now() - session.loginTime);
    return remaining > 0 ? remaining : 0;
  } catch {
    return 0;
  }
}