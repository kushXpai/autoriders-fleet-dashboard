import type { FleetRow } from './types';

export const num = (v: string | undefined): number =>
  isNaN(parseFloat(v ?? '')) ? 0 : parseFloat(v ?? '');

export const cr = (v: number): string => {
  const n = v / 1e7;
  if (n >= 1) return '₹' + n.toFixed(2) + ' Cr';
  const l = v / 1e5;
  if (l >= 1) return '₹' + l.toFixed(1) + ' L';
  return '₹' + Math.round(v).toLocaleString('en-IN');
};

export const getActivePct = (data: FleetRow[]): string => {
  const allVehicles = new Set(data.map(r => r['Registration Number']));
  const active = data.filter(r => num(r['Total Revenue']) > 0);
  const activeVehicles = new Set(active.map(r => r['Registration Number']));
  return allVehicles.size > 0
    ? (activeVehicles.size / allVehicles.size * 100).toFixed(1) + '%'
    : '0%';
};

export const getAvgRev = (data: FleetRow[]): string => {
  const active = data.filter(r => num(r['Total Revenue']) > 0);
  if (!active.length) return '—';
  const totalRevenue = active.reduce((s, r) => s + num(r['Total Revenue']), 0);
  const uniqueVehicles = new Set(active.map(r => r['Registration Number'])).size;
  const uniqueMonths = new Set(active.map(r => `${r.Month}|||${r.Year}`)).size;
  const avg = totalRevenue / uniqueVehicles / uniqueMonths;
  return cr(avg);
};

export const getTopBranch = (data: FleetRow[]): string => {
  const active = data.filter(r => num(r['Total Revenue']) > 0);
  const byBranch: Record<string, number> = {};
  active.forEach(r => {
    const branch = r.Branch || 'Unknown';
    byBranch[branch] = (byBranch[branch] || 0) + num(r['Total Revenue']);
  });
  const top = Object.entries(byBranch).sort((a, b) => b[1] - a[1])[0];
  return top ? top[0] : '—';
};

export const getUniqueVehicleCount = (data: FleetRow[]): number => {
  return new Set(data.map((r) => r["Registration Number"])).size;
};

export const aggregateByVehicle = (data: FleetRow[]): FleetRow[] => {
  const map = new Map<string, FleetRow>();
  data.forEach((r) => {
    const key = r["Registration Number"];
    if (!key) return;
    if (!map.has(key)) {
      map.set(key, { ...r });
    } else {
      const existing = map.get(key)!;
      const add = (field: keyof FleetRow) => {
        const a = parseFloat(existing[field] ?? "0") || 0;
        const b = parseFloat(r[field] ?? "0") || 0;
        (existing as unknown as Record<string, string>)[field] = String(a + b);
      };
      add("Total Revenue"); add("Total Cost"); add("Profit");
      add("Fuel Cost"); add("Repair Cost"); add("Chauffeur Cost");
      add("EMI"); add("Total KMS");
      add("CD Revenue"); add("SD Revenue"); add("STR Revenue");
    }
  });
  return [...map.values()];
};