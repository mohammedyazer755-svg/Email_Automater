import { parseSpreadsheet } from './parser';
import { detectEmails } from './emailDetector';
import { validateEmails } from './validator';
import { deduplicate } from './deduplicator';
import { scoreColumns } from './confidenceScorer';
import type { ImportResult } from './types';
export async function processWorkbook(
  input: File | ArrayBuffer,
  filename = 'workbook.xlsx',
): Promise<ImportResult> {
  const workbook = await parseSpreadsheet(input);
  const entries = detectEmails(workbook),
    { valid, invalid } = validateEmails(entries),
    result = deduplicate(valid);
  return {
    summary: {
      filename: input instanceof ArrayBuffer ? filename : input.name,
      totalSheets: workbook.sheets.length,
      totalRows: workbook.sheets.reduce((n, s) => n + s.totalRows, 0),
      totalCells: workbook.sheets.reduce((n, s) => n + s.totalRows * s.totalColumns, 0),
      totalEmailsDetected: entries.length,
      validEmails: valid.length,
      invalidEmails: invalid.length,
      duplicatesRemoved: result.totalDuplicatesRemoved,
      blankCells: workbook.sheets.reduce(
        (n, s) => n + s.rows.reduce((m, r) => m + r.filter((c) => !c.trim()).length, 0),
        0,
      ),
      uniqueRecipients: result.unique.length,
      emailColumns: scoreColumns(workbook).filter((c) => c.confidence > 50),
    },
    recipients: result.unique,
    invalidEntries: invalid,
    duplicateEntries: result.duplicates,
  };
}
