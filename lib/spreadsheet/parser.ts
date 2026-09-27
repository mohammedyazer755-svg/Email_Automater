import * as XLSX from 'xlsx';
import type { Workbook } from './types';
export const MAX_FILE_SIZE = 10 * 1024 * 1024;
export async function parseSpreadsheet(input: File | ArrayBuffer): Promise<Workbook> {
  if (input instanceof ArrayBuffer ? input.byteLength > MAX_FILE_SIZE : input.size > MAX_FILE_SIZE)
    throw new Error('Files must be 10 MB or smaller.');
  if (!(input instanceof ArrayBuffer) && !/\.(csv|xlsx|xls)$/i.test(input.name))
    throw new Error('Choose a CSV, XLS, or XLSX file.');
  const book = XLSX.read(input instanceof ArrayBuffer ? input : await input.arrayBuffer(), {
    type: 'array',
    cellDates: false,
  });
  let cells = 0;
  const sheets = book.SheetNames.map((name) => {
    const sheet = book.Sheets[name];
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
    const totalRows = sheet['!ref'] ? range.e.r + 1 : 0,
      totalColumns = sheet['!ref'] ? range.e.c + 1 : 0;
    cells += totalRows * totalColumns;
    if (cells > 2000000)
      throw new Error('Workbook exceeds the 2 million cell limit. Split it into smaller files.');
    const rows = Array.from({ length: totalRows }, (_, r) =>
      Array.from({ length: totalColumns }, (_, c) =>
        String(sheet[XLSX.utils.encode_cell({ r, c })]?.v ?? ''),
      ),
    );
    return { name, rows, totalRows, totalColumns };
  });
  return { sheets };
}
