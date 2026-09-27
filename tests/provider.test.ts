import { afterEach, describe, expect, it, vi } from 'vitest';
import { Resend } from 'resend';
import { ResendProvider } from '@/lib/email/provider';
import { ProviderError } from '@/lib/email/retryHandler';
import { body, page } from '@/lib/server/http';
import { validateAttachmentBytes } from '@/lib/server/attachments';
afterEach(() => vi.restoreAllMocks());
describe('provider and request boundaries', () => {
  it('sends to a single recipient with a stable idempotency key', async () => {
    const sdk = new Resend('re_test_not_live');
    const send = vi
      .spyOn(sdk.emails, 'send')
      .mockResolvedValue({ data: { id: 'message-id' }, error: null, headers: null });
    const provider = new ResendProvider(sdk);
    const message = {
      from: 'Sender <sender@acme.org>',
      to: 'person@acme.org',
      subject: 'Hello',
      html: '<p>Hello</p>',
    };
    expect(await provider.sendEmail(message, 'queue-id')).toEqual({ messageId: 'message-id' });
    await provider.sendEmail(message, 'queue-id');
    expect(send.mock.calls.map((c) => c[1])).toEqual([
      { idempotencyKey: 'queue-id' },
      { idempotencyKey: 'queue-id' },
    ]);
    expect(send.mock.calls[0][0].to).toBe('person@acme.org');
  });
  it('preserves provider error codes for retry classification', async () => {
    const sdk = new Resend('re_test_not_live');
    vi.spyOn(sdk.emails, 'send').mockResolvedValue({
      data: null,
      error: { name: 'rate_limit_exceeded', message: 'Rate exceeded', statusCode: 429 },
      headers: null,
    });
    await expect(
      new ResendProvider(sdk).sendEmail(
        { from: 'a@acme.org', to: 'b@acme.org', subject: 'Test', html: 'Hi' },
        'queue-id',
      ),
    ).rejects.toEqual(new ProviderError('Rate exceeded', 429));
  });
  it('rejects invalid pagination and non-object JSON', async () => {
    expect(() => page(new Request('https://app.test/api/contacts?page=Infinity'))).toThrow(
      'Invalid pagination',
    );
    await expect(
      body(new Request('https://app.test', { method: 'POST', body: 'null' })),
    ).rejects.toThrow('Invalid JSON');
    expect(
      await body(new Request('https://app.test', { method: 'POST', body: '{"name":"ok"}' })),
    ).toEqual({ name: 'ok' });
  });
  it('checks attachment signatures', () => {
    expect(() =>
      validateAttachmentBytes('png', Buffer.from('<script>not an image</script>')),
    ).toThrow('contents');
    expect(() => validateAttachmentBytes('pdf', Buffer.from('%PDF-1.7 test'))).not.toThrow();
    expect(() => validateAttachmentBytes('exe', Buffer.from('MZ'))).toThrow();
  });
});
