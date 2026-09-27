import { describe, it, expect, vi } from 'vitest';
import { cleanHtml, csvCell, encrypt, decrypt } from '@/lib/server/security';
import { retryDelay } from '@/lib/email/retryHandler';
describe('security and retry policy', () => {
  it('removes executable HTML and CSS while keeping email formatting', () => {
    const html = cleanHtml(
      '<script>alert(1)</script><img src="https://acme.org/a.png" onerror="alert(1)"><a href="javascript:alert(1)">bad</a><p style="color:#ff0000;position:fixed">Hello</p>',
    );
    expect(html).not.toMatch(/script|onerror|position/);
    expect(html).toContain('color:#ff0000');
    expect(html).toContain('https://acme.org/a.png');
  });
  it('escapes CSV quotes and formula prefixes', () => {
    expect(csvCell('=1+2')).toBe('"\'=1+2"');
    expect(csvCell('a"b')).toBe('"a""b"');
  });
  it('encrypts keys and rejects tampering', () => {
    vi.stubEnv('PROVIDER_KEY_ENCRYPTION_KEY', 'ab'.repeat(32));
    const encrypted = encrypt('re_secret');
    expect(encrypted).not.toContain('re_secret');
    expect(decrypt(encrypted)).toBe('re_secret');
    const parts = encrypted.split('.');
    parts[2] = Buffer.from('tampered').toString('base64');
    expect(() => decrypt(parts.join('.'))).toThrow();
    vi.unstubAllEnvs();
  });
  it('only retries transient failures and stops after three retries', () => {
    expect([0, 1, 2, 3].map((n) => retryDelay(n, 429))).toEqual([1000, 5000, 30000, null]);
    expect(retryDelay(0, 400)).toBeNull();
    expect(retryDelay(0, 503)).toBe(1000);
  });
});
