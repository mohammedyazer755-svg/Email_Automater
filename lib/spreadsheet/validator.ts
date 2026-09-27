import type { EmailEntry } from './types';
export function isValidEmail(email: string, rejectExamples = true): boolean {
  if (email.length > 254 || /\s/.test(email)) return false;
  const parts = email.split('@');
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (
    !local ||
    local.length > 64 ||
    local.startsWith('.') ||
    local.endsWith('.') ||
    local.includes('..') ||
    !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(local)
  )
    return false;
  const labels = domain.split('.');
  if (labels.length < 2 || !/^[a-z]{2,63}$/i.test(labels.at(-1)!)) return false;
  if (labels.some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))) return false;
  return (
    !rejectExamples ||
    !['test@test.com', 'example@example.com', 'test@example.com'].includes(email.toLowerCase())
  );
}
export function validateEmails(entries: EmailEntry[], rejectExamples = true) {
  return {
    valid: entries.filter((e) => isValidEmail(e.email, rejectExamples)),
    invalid: entries.filter((e) => !isValidEmail(e.email, rejectExamples)),
  };
}
