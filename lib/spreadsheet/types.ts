export interface Source {
  sheet: string;
  row: number;
  column: string;
}
export interface EmailEntry {
  email: string;
  source: Source;
  occurrences?: number;
  isValid?: boolean;
}
export interface Sheet {
  name: string;
  rows: string[][];
  totalRows: number;
  totalColumns: number;
}
export interface Workbook {
  sheets: Sheet[];
}
export interface ImportResult {
  summary: {
    filename: string;
    totalSheets: number;
    totalRows: number;
    totalCells: number;
    totalEmailsDetected: number;
    validEmails: number;
    invalidEmails: number;
    duplicatesRemoved: number;
    blankCells: number;
    uniqueRecipients: number;
    emailColumns: { sheet: string; column: string; confidence: number }[];
  };
  recipients: EmailEntry[];
  invalidEntries: EmailEntry[];
  duplicateEntries: { email: string; count: number; sources: Source[] }[];
}
