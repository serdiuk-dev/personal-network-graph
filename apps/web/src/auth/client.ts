let csrf = '';
let generation = 0;
const expired = new EventTarget();
const pending = new Set<AbortController>();
const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('pnet-auth');

export function clearSession(broadcast = false) {
  csrf = '';
  generation++;
  for (const controller of pending) controller.abort();
  pending.clear();
  expired.dispatchEvent(new Event('expired'));
  if (broadcast) channel?.postMessage('logout');
}
if (channel) channel.onmessage = event => { if (event.data === 'logout') clearSession(); };
export function onSessionExpired(listener: () => void) {
  expired.addEventListener('expired', listener);
  return () => expired.removeEventListener('expired', listener);
}
export async function checkSession(signal?: AbortSignal): Promise<boolean> {
  const before = generation;
  const response = await fetch('/api/v1/auth/session', { credentials: 'same-origin', cache: 'no-store', signal });
  if (before !== generation || signal?.aborted) return false;
  if (response.status === 401) { clearSession(); return false; }
  if (!response.ok) throw new Error('Unable to verify session. Try again.');
  const body = await response.json();
  if (before !== generation || signal?.aborted) return false;
  if (typeof body.csrf !== 'string' || !/^[a-f0-9]{64}$/.test(body.csrf)) throw new Error('Invalid session response.');
  csrf = body.csrf;
  return true;
}
export async function signIn(login: string, password: string, code: string) {
  const response = await fetch('/api/v1/auth/login', {
    method: 'POST', credentials: 'same-origin', cache: 'no-store',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ login, password, code }),
  });
  if (!response.ok) {
    if (response.status === 429) throw new Error('Too many attempts. Wait 15 minutes before trying again.');
    if (response.status === 401 || response.status === 400) throw new Error('Login, password or verification code is incorrect.');
    throw new Error('Unable to sign in. Try again later.');
  }
  const body = await response.json();
  if (typeof body.csrf !== 'string' || !/^[a-f0-9]{64}$/.test(body.csrf)) throw new Error('Invalid session response.');
  csrf = body.csrf;
  generation++;
}
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const url = new URL(path, window.location.origin);
  if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/v1/')) throw new Error('Invalid API URL');
  if (!csrf) throw new Error('Authentication required');
  const before = generation;
  const headers = new Headers(init.headers);
  if (!['GET', 'HEAD', 'OPTIONS'].includes((init.method ?? 'GET').toUpperCase())) headers.set('X-Pnet-CSRF', csrf);
  const controller = new AbortController();
  pending.add(controller);
  const signal = init.signal ? AbortSignal.any([init.signal, controller.signal]) : controller.signal;
  try {
    const response = await fetch(url, { ...init, headers, signal, credentials: 'same-origin', cache: 'no-store', redirect: 'error' });
    if (before !== generation) throw new Error('Session changed');
    if (response.status === 401) { clearSession(true); throw new Error('Session expired. Please sign in again.'); }
    return response;
  } finally { pending.delete(controller); }
}
export async function signOut() {
  const response = await apiFetch('/api/v1/auth/logout', { method: 'POST' });
  if (!response.ok) throw new Error('Sign out failed. Please retry.');
  clearSession(true);
}
