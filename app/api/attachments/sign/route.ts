import { z } from 'zod';
import { session, handle, body, limit, HttpError } from '@/lib/server/http';
import { checked } from '@/lib/server/db';
import { attachmentTypes } from '@/lib/server/attachments';
export async function POST(req: Request) {
  return handle(async () => {
    const { user, db } = await session(req);
    await limit(user.id, 'uploads', 100);
    const input = z
      .object({
        filename: z.string().min(1).max(200),
        size: z.number().int().positive().max(10485760),
      })
      .parse(await body(req));
    const ext = input.filename.split('.').at(-1)!.toLowerCase(),
      mime = attachmentTypes[ext];
    if (!mime) throw new HttpError(400, 'Supported attachments: PDF, PNG, JPG, TXT, CSV.');
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const result = checked(
      await db.storage.from('campaign-attachments').createSignedUploadUrl(path),
    );
    if (!result) throw new HttpError(500, 'Unable to authorize upload.');
    return { ...input, mime, path, token: result.token };
  });
}
