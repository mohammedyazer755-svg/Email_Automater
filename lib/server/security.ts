import 'server-only';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import sanitizeHtml from 'sanitize-html';
export function cleanHtml(html: string) {
  return sanitizeHtml(html, {
    allowedTags: [
      'p',
      'br',
      'strong',
      'b',
      'em',
      'i',
      'u',
      's',
      'h1',
      'h2',
      'h3',
      'ul',
      'ol',
      'li',
      'a',
      'img',
      'blockquote',
      'hr',
      'span',
      'div',
      'table',
      'thead',
      'tbody',
      'tr',
      'td',
      'th',
    ],
    allowedAttributes: {
      '*': ['style'],
      a: ['href', 'title'],
      img: ['src', 'alt', 'width', 'height'],
    },
    allowedSchemes: ['https', 'http', 'mailto'],
    allowedStyles: {
      '*': {
        color: [/^#[0-9a-f]{3,8}$/i, /^rgb\([\d,\s]+\)$/],
        'text-align': [/^(left|center|right|justify)$/],
      },
    },
  });
}
function key() {
  const value = process.env.PROVIDER_KEY_ENCRYPTION_KEY;
  if (!value || !/^[a-f0-9]{64}$/i.test(value))
    throw new Error('Configure a 32-byte encryption key before saving provider keys.');
  return Buffer.from(value, 'hex');
}
export function encrypt(value: string) {
  const iv = randomBytes(12),
    cipher = createCipheriv('aes-256-gcm', key(), iv);
  const body = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map((b) => b.toString('base64')).join('.');
}
export function decrypt(value: string) {
  const [iv, tag, body] = value.split('.').map((s) => Buffer.from(s, 'base64'));
  const cipher = createDecipheriv('aes-256-gcm', key(), iv);
  cipher.setAuthTag(tag);
  return Buffer.concat([cipher.update(body), cipher.final()]).toString('utf8');
}
export function csvCell(value: unknown) {
  const text = String(value ?? '');
  return '"' + (/^[=+@\-\t\r]/.test(text) ? "'" : '') + text.replaceAll('"', '""') + '"';
}
