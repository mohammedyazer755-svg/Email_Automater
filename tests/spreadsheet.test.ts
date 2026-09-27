import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { processWorkbook } from '@/lib/spreadsheet/processWorkbook';
import { isValidEmail } from '@/lib/spreadsheet/validator';
import { extractCandidates } from '@/lib/spreadsheet/emailDetector';
import { scoreColumns } from '@/lib/spreadsheet/confidenceScorer';
describe('spreadsheet pipeline', () => {
  it('scans multiple sheets, deduplicates normalized addresses, and preserves first source', async () => {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      book,
      XLSX.utils.aoa_to_sheet([
        ['Name', 'Email'],
        ['A', 'Contact: HELLO@acme.org / 98765'],
        ['B', 'hello@acme.org'],
        ['C', 'bad@@acme.org'],
        ['D', 'test@test.com'],
        ['E', ''],
      ]),
      'People',
    );
    XLSX.utils.book_append_sheet(
      book,
      XLSX.utils.aoa_to_sheet([['second@acme.org, hello@acme.org']]),
      'Other',
    );
    const r = await processWorkbook(XLSX.write(book, { type: 'array', bookType: 'xlsx' }));
    expect(r.summary).toMatchObject({
      totalSheets: 2,
      totalRows: 7,
      totalEmailsDetected: 6,
      validEmails: 4,
      invalidEmails: 2,
      duplicatesRemoved: 2,
      uniqueRecipients: 2,
      blankCells: 1,
    });
    expect(r.recipients[0]).toMatchObject({
      email: 'hello@acme.org',
      source: { sheet: 'People', row: 2, column: 'B' },
      occurrences: 3,
    });
    expect(r.duplicateEntries[0].sources).toHaveLength(3);
  });
  it.each([
    'a..b@acme.org',
    'a@-acme.org',
    'a@acme-.org',
    'bad@@acme.org',
    'a@acme.c',
    'a@acme..org',
    'a b@acme.org',
    '.a@acme.org',
    'a.@acme.org',
    'test@test.com',
  ])('rejects malformed %s', (e) => expect(isValidEmail(e)).toBe(false));
  it('accepts plus addressing and rejects a malformed whole token', () => {
    expect(isValidEmail('person+event@sub.acme.org')).toBe(true);
    expect(extractCandidates('bad@@acme.org')).toEqual(['bad@@acme.org']);
  });
  it('counts valid cells once when calculating column confidence', () => {
    const result = scoreColumns({
      sheets: [
        {
          name: 'Sheet',
          rows: [['Email'], ['a@acme.org b@acme.org'], ['c@acme.org'], ['']],
          totalRows: 4,
          totalColumns: 1,
        },
      ],
    });
    expect(result[0].emailCells).toBe(2);
    expect(result[0].confidence).toBeCloseTo(66.6667);
  });
  it('handles 10,000 recipients without truncation', async () => {
    const data = Array.from({ length: 10000 }, (_, i) => [`user${i}@acme.org`]);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(data), 'Recipients');
    const r = await processWorkbook(XLSX.write(book, { type: 'array', bookType: 'xlsx' }));
    expect(r.recipients).toHaveLength(10000);
  });
  it('rejects oversized buffers', async () => {
    await expect(processWorkbook(new ArrayBuffer(10485761))).rejects.toThrow('10 MB');
  });
});
