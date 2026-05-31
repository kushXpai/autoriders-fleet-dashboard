// app/lib/types.ts
export interface FleetRow {
  'Sr. No': string;
  'Branch': string;
  'Month': string;
  'Year': string;
  'Registration Number': string;
  'Model': string;
  'Registration Date': string;
  'Opening KMS': string;
  'Closing KMS': string;
  'Total KMS': string;
  'CD Kms': string;
  'SD Kms': string;
  'STR Kms': string;
  'Revenue KMS': string;
  'NRK': string;
  'CD Revenue': string;
  'SD Revenue': string;
  'STR Revenue': string;
  'Total Revenue': string;
  'Fuel Cost': string;
  'Repair Cost': string;
  'Chauffeur Cost': string;
  'EMI': string;
  'Total Cost': string;
  'Profit': string;
  'Profit %': string;
}

export interface MonthData {
  year: string;
  month: string;
  data: FleetRow[];
}