export interface User {
  username: string;
  role: 'superadmin' | 'admin' | 'branch';
}

const CREDENTIALS: Record<string, { password: string; role: User['role'] }> = {
  superadmin: { password: 'superadmin$123', role: 'superadmin' },
  admin: { password: 'admin$123', role: 'admin' },
  ahmedabad: { password: '123456789', role: 'branch' },
  bangalore: { password: '123456789', role: 'branch' },
  chennai: { password: '123456789', role: 'branch' },
  delhi: { password: '123456789', role: 'branch' },
  hyderabad: { password: '123456789', role: 'branch' },
  kolkatta: { password: '123456789', role: 'branch' },
  mumbai: { password: '123456789', role: 'branch' },
  novotel: { password: '123456789', role: 'branch' },
  pune: { password: '123456789', role: 'branch' },
  cochin: { password: '123456789', role: 'branch' },
  coimbatore: { password: '123456789', role: 'branch' },
  jaipur: { password: '123456789', role: 'branch' },
  vadodara: { password: '123456789', role: 'branch' },
  lucknow: { password: '123456789', role: 'branch' },
  vizag: { password: '123456789', role: 'branch' },
  surat: { password: '123456789', role: 'branch' },
  bharuch: { password: '123456789', role: 'branch' },
  vijaywada: { password: '123456789', role: 'branch' },
  scb: { password: '123456789', role: 'branch' },
  niif: { password: '123456789', role: 'branch' },
  exxon: { password: '123456789', role: 'branch' },
};

export function authenticate(username: string, password: string): User | null {
  const lower = username.toLowerCase().trim();
  const cred = CREDENTIALS[lower];
  if (!cred) return null;
  if (cred.password !== password) return null;
  return { username: lower, role: cred.role };
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