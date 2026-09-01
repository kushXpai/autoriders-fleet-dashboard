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

export interface RevenueRow {
  "PAYMENT STATUS"?: string;
  "BOOKING REFERENCE NUMBER"?: string;
  "INVOICE NUMBER"?: string;
  "CORPORATE NAME"?: string;
  "SOURCE BRANCH"?: string;
  "CUSTOMER NAME"?: string;
  "GROUP CODE"?: string;
  "BOOKER NAME"?: string;
  "DUTY CITY"?: string;
  "CAR BOOKED"?: string;
  "CAR SENT"?: string;
  "UPGRADE"?: string;
  "MODIFIED USAGE TYPE"?: string;
  "OPENING DATE"?: string;
  "OPENING TIME"?: string;
  "REPORTING DATE"?: string;
  "REPORTING TIME"?: string;
  "RELEASE DATE"?: string;
  "RELEASE TIME"?: string;
  "CLOSING DATE"?: string;
  "CLOSING TIME"?: string;
  "INVOICE DATE"?: string;
  "INVOICE MONTH"?: string;
  "DRIVER NAME"?: string;
  "VEHICLE NUMBER"?: string;
  "OWNERSHIP TYPE"?: string;
  "VENDOR NAME"?: string;
  "ACTUAL DUTY TIME"?: string;
  "REVENUE KMS"?: string;
  "DRY RUN KMS"?: string;
  "EXTRA KMS"?: string;
  "EXTRA HRS"?: string;
  "BASIC RATE"?: string;
  "EXTRA KM COST"?: string;
  "EXTRA HR COST"?: string;
  "EXTRA KMS AMOUNT"?: string;
  "EXTRA HRS AMOUNT"?: string;
  "RATE PER KM BILLED"?: string;
  "RATE PER KM ACTUAL"?: string;
  "PARKING AMOUNT"?: string;
  "TOLL"?: string;
  "SUB TOTAL"?: string;
  "SUNDRIES"?: string;
  "DRIVER ALLOWANCE"?: string;
  "NIGHT ALLOWANCE"?: string;
  "TOTAL CHARGES"?: string;
  "CGST"?: string;
  "SGST"?: string;
  "IGST"?: string;
  "TOTAL TAX"?: string;
  "TOTAL"?: string;
  "APP DUTY"?: string;
  "RECEIPT NUMBER"?: string;
  "CN NUMBER"?: string;
  "CN AMOUNT"?: string;
  [key: string]: string | undefined;
}