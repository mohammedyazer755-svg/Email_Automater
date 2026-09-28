async function request(method: string, body?: unknown) {
  const response = await fetch('/api/local-auth', {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  return response.ok
    ? { data, error: null }
    : { data: { user: null }, error: { message: data.error || 'Login failed' } };
}
export const localClient = {
  auth: {
    signInWithPassword: (credentials: { email: string; password: string }) =>
      request('POST', credentials),
    getUser: () => request('GET'),
    signOut: () => request('DELETE'),
    signInWithOAuth: async () => ({ error: { message: 'Use your local email and password.' } }),
  },
};
