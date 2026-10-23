// app/lib/credentials.ts
// SERVER-ONLY: never import this from a client component. Credentials live here
// (instead of auth.ts) so they are not shipped in the browser bundle.
import type { User } from "./auth";

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

