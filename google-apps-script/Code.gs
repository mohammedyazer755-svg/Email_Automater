/** Gmail HTTPS relay for MailAutomator.
 * Deploy as a Web App, execute as your Google account, accessible to anyone.
 * Keep RELAY_SECRET private and use the same value in MailAutomator settings.
 */
const GMAIL_SENDER = 'REPLACE_WITH_YOUR_GMAIL_ADDRESS';
function relaySecret() {
  return PropertiesService.getScriptProperties().getProperty('RELAY_SECRET') || '';
}

function setupRelay() {
  const props = PropertiesService.getScriptProperties();
  let secret = props.getProperty('RELAY_SECRET');
  if (!secret) {
    secret = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
    props.setProperty('RELAY_SECRET', secret);
  }
  console.log('Copy this relay secret into MailAutomator Settings: ' + secret);
}

function authorizeGmail() {
  // Run this once from the Apps Script editor and approve the Gmail permission.
  console.log('Gmail recipients remaining today: ' + MailApp.getRemainingDailyQuota());
}

function doPost(e) {
  try {
    const input = JSON.parse(e && e.postData && e.postData.contents || '{}');
    if (!constantTimeEqual(String(input.token || ''), relaySecret()))
      return json({ error: 'Invalid relay secret.' });
    if (input.action === 'verify') return json({ ok: true, email: GMAIL_SENDER });
    if (input.action !== 'send') return json({ error: 'Unknown action.' });
    if (String(input.email || '').toLowerCase() !== GMAIL_SENDER.toLowerCase())
      return json({ error: 'Sender address does not match the authorized Gmail account.' });
    const to = String(input.to || '');
    if (!/^[^\s,;<>@]+@[^\s,;<>@]+\.[^\s,;<>@]+$/.test(to))
      return json({ error: 'Invalid recipient address.' });
    const subject = String(input.subject || '').slice(0, 500);
    const html = String(input.html || '').slice(0, 200000);
    const text = String(input.text || html.replace(/<[^>]*>/g, ' ').slice(0, 200000));
    if (!subject || (!html && !text)) return json({ error: 'Subject and message body are required.' });
    const remaining = MailApp.getRemainingDailyQuota();
    if (remaining < 1) return json({ error: 'Daily Gmail sending limit reached. Try again tomorrow.' });
    const attachments = (input.attachments || []).slice(0, 10).map(function (item) {
      const data = Utilities.base64Decode(String(item.content || ''));
      if (data.length > 10 * 1024 * 1024) throw new Error('Attachment exceeds the size limit.');
      return Utilities.newBlob(data, 'application/octet-stream', String(item.filename || 'attachment'));
    });
    const digest = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      String(input.idempotencyKey || Utilities.getUuid()),
    );
    const cacheKey = 'sent-' + Utilities.base64EncodeWebSafe(digest);
    const cache = CacheService.getScriptCache();
    const cached = cache.get(cacheKey);
    if (cached) return json(JSON.parse(cached));
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const afterLock = cache.get(cacheKey);
      if (afterLock) return json(JSON.parse(afterLock));
      MailApp.sendEmail({
        to: to,
        subject: subject,
        body: text || 'This message contains HTML content.',
        htmlBody: html || undefined,
        name: String(input.name || GMAIL_SENDER).replace(/[\r\n<>]/g, '').slice(0, 100),
        replyTo: input.replyTo || undefined,
        attachments: attachments,
      });
      const result = { ok: true, messageId: Utilities.getUuid() };
      cache.put(cacheKey, JSON.stringify(result), 21600);
      return json(result);
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    return json({ error: error && error.message ? String(error.message).slice(0, 300) : 'Gmail send failed.' });
  }
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

function json(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
