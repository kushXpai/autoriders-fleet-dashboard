// app/lib/auth.ts
export interface User {
  username: string;
  role: 'developer' | 'superadmin' | 'admin' | 'manager' | 'branch';
  branches?: string[]; // manager accounts — list of branches they can access
}

// Bump this whenever credentials change and you want every existing
// logged-in session to be force-logged-out on their next page load.
const AUTH_VERSION = 2;

// Session length — after this, the stored session is treated as expired
// and the user is sent back to the login page.
const SESSION_DURATION_MS = 2 * 60 * 60 * 1000; // 2 hours

interface StoredSession {
  user: User;
  loginTime: number;
  version: number;
}

const CREDENTIALS: Record<string, { password: string; role: User['role']; branches?: string[] }> = {
  // ── System roles ────────────────────────────────────────────────────────
  developer:  { password: 'superadmin$123', role: 'developer' },
  superadmin: { password: 'superadmin$123', role: 'superadmin' },
  admin:      { password: 'admin$123',      role: 'admin' },

  // ── Named superadmin accounts ────────────────────────────────────────────
  'mithil@autoriders.in': { password: 'Auto@123', role: 'superadmin' },
  'atul@autoriders.in':   { password: 'Auto@123', role: 'superadmin' },

  // ── Named admin accounts (all branches, no upload) ───────────────────────
  'vijay@autoriders.in': { password: 'Auto@123', role: 'admin' },

  // ── Manager accounts (multi-branch, no upload) ───────────────────────────
  'hemant@autoriders.in':          { password: 'River1990$',  role: 'manager', branches: ['ahemdabad', 'bharuch', 'rajkot', 'surat', 'vadodara'] },
  'bangalorebm@autoriders.in':     { password: 'Tiger4264!',  role: 'manager', branches: ['bangalore', 'exxon'] },
  'rmnorth@autoriders.in':         { password: 'Aster8646#',  role: 'manager', branches: ['delhi', 'jaipur', 'lucknow', 'kolkata'] },
  'hyderabadbm@autoriders.in':     { password: 'Kite5002#',   role: 'manager', branches: ['hyderabad', 'vijaywada', 'vizag'] },
  'mumbaiabm@autoriders.in':       { password: 'Willow2843*', role: 'manager', branches: ['mumbai', 'novotel'] },
  'puneabm@autoriders.in':         { password: 'Ivory5772*',  role: 'manager', branches: ['pune'] },
  'chennaiops@autoriders.in':      { password: 'Flint5608#',  role: 'manager', branches: ['chennai', 'coimbatore'] },
  'cochin@autoriders.in':          { password: 'Grain8432#',  role: 'manager', branches: ['cochin'] },
  'project.manager@autorides.in':  { password: 'Nectar3774&', role: 'manager', branches: ['uberblack'] },
  'scb@autoriders.in':             { password: 'Quill9981!',  role: 'manager', branches: ['scb', 'niif'] },

  // ── Branch logins (single branch) ───────────────────────────────────────
  ahemdabad:  { password: 'Coral7543*',  role: 'branch' },
  bangalore:  { password: 'Flint2556!',  role: 'branch' },
  chennai:    { password: 'Falcon3679@', role: 'branch' },
  delhi:      { password: 'Coral1810#',  role: 'branch' },
  hyderabad:  { password: 'Basil5258&',  role: 'branch' },
  kolkata:    { password: 'Onyx7478!',   role: 'branch' },
  mumbai:     { password: 'River5659#',  role: 'branch' },
  novotel:    { password: 'River9000#',  role: 'branch' },
  pune:       { password: 'Flint1768*',  role: 'branch' },
  cochin:     { password: 'Iris8129*',   role: 'branch' },
  coimbatore: { password: 'Aster6232*',  role: 'branch' },
  jaipur:     { password: 'Coral4622$',  role: 'branch' },
  vadodara:   { password: 'Amber7483@',  role: 'branch' },
  lucknow:    { password: 'Nectar7761*', role: 'branch' },
  vizag:      { password: 'Quartz2287@', role: 'branch' },
  surat:      { password: 'Pixel5466@',  role: 'branch' },
  bharuch:    { password: 'Basil4298$',  role: 'branch' },
  vijaywada:  { password: 'Cedar5296#',  role: 'branch' },
  scb:        { password: 'Haze8326#',   role: 'branch' },
  niif:       { password: 'River6966@',  role: 'branch' },
  exxon:      { password: 'Ivory2185&',  role: 'branch' },
  uberblack:  { password: 'Moss8154*',   role: 'branch' },
};

export function authenticate(username: string, password: string): User | null {
  const lower = username.toLowerCase().trim();
  const cred = CREDENTIALS[lower];
  if (!cred) return null;
  if (cred.password !== password) return null;
  return { username: lower, role: cred.role, branches: cred.branches };
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