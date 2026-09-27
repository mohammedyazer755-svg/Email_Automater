import { utils } from 'xlsx';
import { extractCandidates } from './emailDetector';
import { isValidEmail } from './validator';
import type { Workbook } from './types';
export function scoreColumns(workbook: Workbook) {
  return workbook.sheets.flatMap((sheet) =>
    Array.from({ length: sheet.totalColumns }, (_, columnIndex) => {
      let totalPopulatedCells = 0,
        emailCells = 0;
      const samples = new Set<string>();
      for (const row of sheet.rows) {
        const cell = row[columnIndex]?.trim();
        if (!cell) continue;
        totalPopulatedCells++;
        const emails = extractCandidates(cell).filter((email) => isValidEmail(email));
        if (emails.length) emailCells++;
        emails.forEach((email) => {
          if (samples.size < 3) samples.add(email);
        });
      }
      return {
        sheet: sheet.name,
        column: utils.encode_col(columnIndex),
        columnIndex,
        totalPopulatedCells,
        emailCells,
        confidence: totalPopulatedCells ? (emailCells / totalPopulatedCells) * 100 : 0,
        sampleEmails: [...samples],
      };
    }),
  );
}
