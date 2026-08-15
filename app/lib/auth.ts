// app/lib/auth.ts
export interface User {
  username: string;
  role: 'developer' | 'superadmin' | 'admin' | 'manager' | 'branch';
  branches?: string[]; // manager accounts — list of branches they can access
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
  'hemant@autoriders.in':          { password: 'Auto@123', role: 'manager', branches: ['ahemdabad', 'bharuch', 'rajkot', 'surat', 'vadodara'] },
  'bangalorebm@autoriders.in':     { password: 'Auto@123', role: 'manager', branches: ['bangalore', 'exxon'] },
  'rmnorth@autoriders.in':         { password: 'Auto@123', role: 'manager', branches: ['delhi', 'jaipur', 'lucknow', 'kolkata'] },
  'hyderabadbm@autoriders.in':     { password: 'Auto@123', role: 'manager', branches: ['hyderabad', 'vijaywada', 'vizag'] },
  'mumbaiabm@autoriders.in':       { password: 'Auto@123', role: 'manager', branches: ['mumbai', 'novotel'] },
  'puneabm@autoriders.in':         { password: 'Auto@123', role: 'manager', branches: ['pune'] },
  'chennaiops@autoriders.in':      { password: 'Auto@123', role: 'manager', branches: ['chennai', 'coimbatore'] },
  'cochin@autoriders.in':          { password: 'Auto@123', role: 'manager', branches: ['cochin'] },
  'project.manager@autorides.in':  { password: 'Auto@123', role: 'manager', branches: ['uberblack'] },
  'scb@autoriders.in':             { password: 'Auto@123', role: 'manager', branches: ['scb', 'niif'] },

  // ── Branch logins (single branch) ───────────────────────────────────────
  ahemdabad:  { password: '123456789', role: 'branch' },
  bangalore:  { password: '123456789', role: 'branch' },
  chennai:    { password: '123456789', role: 'branch' },
  delhi:      { password: '123456789', role: 'branch' },
  hyderabad:  { password: '123456789', role: 'branch' },
  kolkata:   { password: '123456789', role: 'branch' },
  mumbai:     { password: '123456789', role: 'branch' },
  novotel:    { password: '123456789', role: 'branch' },
  pune:       { password: '123456789', role: 'branch' },
  cochin:     { password: '123456789', role: 'branch' },
  coimbatore: { password: '123456789', role: 'branch' },
  jaipur:     { password: '123456789', role: 'branch' },
  vadodara:   { password: '123456789', role: 'branch' },
  lucknow:    { password: '123456789', role: 'branch' },
  vizag:      { password: '123456789', role: 'branch' },
  surat:      { password: '123456789', role: 'branch' },
  bharuch:    { password: '123456789', role: 'branch' },
  vijaywada:  { password: '123456789', role: 'branch' },
  scb:        { password: '123456789', role: 'branch' },
  niif:       { password: '123456789', role: 'branch' },
  exxon:      { password: '123456789', role: 'branch' },
  uberblack:  { password: '123456789', role: 'branch' },
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
    return JSON.parse(stored) as User;
  } catch {
    return null;
  }
}

export function storeUser(user: User): void {
  localStorage.setItem('fleet_user', JSON.stringify(user));
}

export function clearUser(): void {
  localStorage.removeItem('fleet_user');
}
