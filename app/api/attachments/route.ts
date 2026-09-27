import { session, handle, HttpError, limit } from '@/lib/server/http';
import { checked } from '@/lib/server/db';
const allowed: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  txt: 'text/plain',
  csv: 'text/csv',
};
export async function POST(req: Request) {
  return handle(async () => {
    const { user, db } = await session(req);
    await limit(user.id, 'uploads', 100);
    if (Number(req.headers.get('content-length') || 0) > 11 * 1024 * 1024)
      throw new HttpError(413, 'Maximum attachment size is 10 MB.');
    const form = await req.formData(),
      file = form.get('file');
    if (!(file instanceof File) || file.size > 10485760 || !file.size)
      throw new HttpError(400, 'Choose a file up to 10 MB.');
    const ext = file.name.split('.').at(-1)!.toLowerCase(),
      mime = allowed[ext];
    if (!mime) throw new HttpError(400, 'Supported attachments: PDF, PNG, JPG, TXT, CSV.');
    const bytes = Buffer.from(await file.arrayBuffer());
    if (
      (ext === 'pdf' && !bytes.subarray(0, 5).equals(Buffer.from('%PDF-'))) ||
      (ext === 'png' &&
        !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
      (['jpg', 'jpeg'].includes(ext) && !(bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255))
    )
      throw new HttpError(400, 'File contents do not match the extension.');
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    checked(
      await db.storage.from('campaign-attachments').upload(path, bytes, { contentType: mime }),
    );
    return { filename: file.name, path, size: file.size, mime };
  });
}
