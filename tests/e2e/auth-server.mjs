// Local browser-test fixture only. Never imported by the application.
import { createServer } from 'node:http';
const user = {
  id: '11111111-1111-4111-8111-111111111111',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'tester@acme.example',
  email_confirmed_at: '2026-01-01T00:00:00Z',
  created_at: '2026-01-01T00:00:00Z',
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: { full_name: 'Test User' },
};
createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.url === '/health') {
    res.end('{}');
    return;
  }
  if (req.url?.startsWith('/auth/v1/user') && req.headers.authorization?.startsWith('Bearer ')) {
    res.end(JSON.stringify(user));
    return;
  }
  res.statusCode = 401;
  res.end(JSON.stringify({ message: 'Not authenticated' }));
}).listen(54329, '127.0.0.1');
