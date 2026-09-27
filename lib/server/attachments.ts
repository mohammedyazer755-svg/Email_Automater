import 'server-only';
import type { Attachment } from '@/lib/models';
import { admin, checked } from './db';
import { HttpError } from './http';
export const attachmentTypes: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  txt: 'text/plain',
  csv: 'text/csv',
};
export function validateAttachmentBytes(ext: string, bytes: Buffer) {
  if (!attachmentTypes[ext] || !bytes.length || bytes.length > 10485760)
    throw new HttpError(400, 'Invalid attachment type or size.');
  if (
    (ext === 'pdf' && !bytes.subarray(0, 5).equals(Buffer.from('%PDF-'))) ||
    (ext === 'png' &&
      !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
    (['jpg', 'jpeg'].includes(ext) && !(bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255))
  )
    throw new HttpError(400, 'File contents do not match the extension.');
}
export async function loadAttachments(user: string, attachments: Attachment[]) {
  if (attachments.reduce((n, a) => n + a.size, 0) > 10485760)
    throw new HttpError(400, 'Attachments must total 10 MB or less.');
  const result = [];
  for (const a of attachments) {
    if (!a.path.startsWith(user + '/') || a.path.includes('..'))
      throw new HttpError(400, 'Invalid attachment owner.');
    const file = checked(await admin().storage.from('campaign-attachments').download(a.path));
    if (!file || file.size !== a.size)
      throw new HttpError(400, 'Attachment missing or size mismatch.');
    const content = Buffer.from(await file.arrayBuffer()),
      ext = a.path.split('.').at(-1)!.toLowerCase();
    if (attachmentTypes[ext] !== a.mime || a.filename.split('.').at(-1)?.toLowerCase() !== ext)
      throw new HttpError(400, 'Attachment type mismatch.');
    validateAttachmentBytes(ext, content);
    result.push({ filename: a.filename, content });
  }
  return result;
}
