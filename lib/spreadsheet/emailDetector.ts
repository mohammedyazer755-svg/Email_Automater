import { utils } from 'xlsx';
import type { EmailEntry, Workbook } from './types';
export function extractCandidates(cell: string): string[] {
  // Capture whole candidate tokens so malformed addresses cannot become valid substrings.
  return (cell.match(/[^\s<>(),;:"\[\]\\]+@[^\s<>(),;:"\[\]\\]+/g) || []).map((s) =>
    s.replace(/[.!?]+$/g, '').toLowerCase(),
  );
}
export function detectEmails(workbook: Workbook): EmailEntry[] {
  const entries: EmailEntry[] = [];
  for (const sheet of workbook.sheets)
    sheet.rows.forEach((row, r) =>
      row.forEach((cell, c) => {
        for (const email of extractCandidates(cell))
          entries.push({
            email,
            source: { sheet: sheet.name, row: r + 1, column: utils.encode_col(c) },
          });
      }),
    );
  return entries;
}
