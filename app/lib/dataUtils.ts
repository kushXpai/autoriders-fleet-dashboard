import type { FleetRow } from './types';

export const num = (v: string | undefined): number =>
  isNaN(parseFloat(v ?? '')) ? 0 : parseFloat(v ?? '');

export const getFinancialYear = (month: string, year: string): string => {
  const janToMarch = ['January', 'February', 'March'];
  const y = parseInt(year, 10);
  if (isNaN(y)) return '';
  if (janToMarch.includes(month)) {
    return `FY ${y - 1}-${String(y).slice(2)}`;
  }
  return `FY ${y}-${String(y + 1).slice(2)}`;
};

export const parseDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  const trimmed = String(dateStr).trim();
  if (!trimmed) return null;

  // Handle Excel serial numbers (pure numeric values)
  const asNum = Number(trimmed);
  if (!isNaN(asNum) && asNum > 0 && String(asNum) === trimmed) {
    const excelEpoch = new Date(1900, 0, 1);
    const dayOffset = asNum > 59 ? asNum - 2 : asNum - 1;
    const result = new Date(excelEpoch.getTime() + dayOffset * 86400000);
    if (!isNaN(result.getTime()) && result.getFullYear() >= 1980) return result;
    return null;
  }

  // Try DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY first (Indian date format)
  const parts = trimmed.split(/[\/\-\.]/);
  if (parts.length === 3) {
    const [a, b, c] = parts.map(Number);
    if (isNaN(a) || isNaN(b) || isNaN(c)) return null;
    let result: Date;
    if (a > 31) {
      // YYYY-MM-DD
      result = new Date(a, b - 1, c);
    } else if (c > 31 || c >= 1980) {
      // DD-MM-YYYY
      result = new Date(c, b - 1, a);
    } else {
      // DD-MM-YY
      result = new Date(c < 100 ? c + 2000 : c, b - 1, a);
    }
    if (!isNaN(result.getTime()) && result.getFullYear() >= 1980) return result;
  }

  // Fallback to native Date parsing
  const d = new Date(trimmed);
  if (!isNaN(d.getTime()) && d.getFullYear() >= 1980) return d;

  return null;
};

export const formatDateDDMMYYYY = (dateStr: string): string => {
  const d = parseDate(dateStr);
  if (!d) return dateStr || '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
};

export const getVehicleAgeYears = (dateStr: string): number => {
  const d = parseDate(dateStr);
  if (!d) return 0;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  return diffMs / (1000 * 60 * 60 * 24 * 365.25);
};

export const getVehicleAgeBucket = (dateStr: string): string => {
  const age = getVehicleAgeYears(dateStr);
  if (age <= 0) return 'Unknown';
  if (age < 1) return '<1 Year';
  if (age < 2) return '1-2 Years';
  if (age < 3) return '2-3 Years';
  if (age < 5) return '3-5 Years';
  return '5+ Years';
};

export const cr = (v: number): string => {
  const n = v / 1e7;
  if (n >= 1) return '₹' + n.toFixed(2) + ' Cr';
  const l = v / 1e5;
  if (l >= 1) return '₹' + l.toFixed(1) + ' L';
  return '₹' + Math.round(v).toLocaleString('en-IN');
};

export const getActivePct = (data: FleetRow[]): string => {
  const allVehicles = new Set(data.map(r => r['Registration Number']).filter(Boolean));
  const activeVehicles = new Set(
    data.filter(r => num(r['Total Revenue']) > 0).map(r => r['Registration Number'])
  );
  return allVehicles.size > 0
    ? (activeVehicles.size / allVehicles.size * 100).toFixed(1) + '%'
    : '0%';
};

export const getAvgRev = (data: FleetRow[]): string => {
  const totalRevenue = data.reduce((s, r) => s + num(r['Total Revenue']), 0);
  if (totalRevenue === 0) return '—';
  const uniqueVehicles = new Set(data.map(r => r['Registration Number']).filter(Boolean)).size;
  const uniqueMonths = new Set(data.map(r => `${r.Month}|||${r.Year}`).filter(v => v !== '|||')).size;
  if (!uniqueVehicles || !uniqueMonths) return '—';
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
  return new Set(data.map(r => r['Registration Number']).filter(Boolean)).size;
};

export function aggregateByVehicle(data: FleetRow[]): FleetRow[] {
  const map = new Map<string, FleetRow[]>();
  data.forEach(r => {
    const reg = r['Registration Number'];
    if (!reg) return;
    if (!map.has(reg)) map.set(reg, []);
    map.get(reg)!.push(r);
  });

  return [...map.entries()].map(([, rows]) => {
    const totalKms = rows.reduce((s, r) => s + num(r['Total KMS']), 0);
    const totalRev = rows.reduce((s, r) => s + num(r['Total Revenue']), 0);
    const totalCost = rows.reduce((s, r) => s + num(r['Total Cost']), 0);
    const profit = rows.reduce((s, r) => s + num(r['Profit']), 0);
    const fuel = rows.reduce((s, r) => s + num(r['Fuel Cost']), 0);
    const repair = rows.reduce((s, r) => s + num(r['Repair Cost']), 0);
    const chauffeur = rows.reduce((s, r) => s + num(r['Chauffeur Cost']), 0);
    const emi = rows.reduce((s, r) => s + num(r['EMI']), 0);
    const margin = totalRev > 0 ? (profit / totalRev * 100).toFixed(1) : '0';

    return {
      ...rows[0],
      'Total KMS': String(totalKms),
      'CD Kms': String(rows.reduce((s, r) => s + num(r['CD Kms']), 0)),
      'SD Kms': String(rows.reduce((s, r) => s + num(r['SD Kms']), 0)),
      'STR Kms': String(rows.reduce((s, r) => s + num(r['STR Kms']), 0)),
      'Revenue KMS': String(rows.reduce((s, r) => s + num(r['Revenue KMS']), 0)),
      'NRK': String(rows.reduce((s, r) => s + num(r['NRK']), 0)),
      'CD Revenue': String(rows.reduce((s, r) => s + num(r['CD Revenue']), 0)),
      'SD Revenue': String(rows.reduce((s, r) => s + num(r['SD Revenue']), 0)),
      'STR Revenue': String(rows.reduce((s, r) => s + num(r['STR Revenue']), 0)),
      'Total Revenue': String(totalRev),
      'Fuel Cost': String(fuel),
      'Repair Cost': String(repair),
      'Chauffeur Cost': String(chauffeur),
      'EMI': String(emi),
      'Total Cost': String(totalCost),
      'Profit': String(profit),
      'Profit %': margin,
    } as FleetRow;
  });
}