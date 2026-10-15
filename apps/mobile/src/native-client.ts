import { Capacitor, registerPlugin } from '@capacitor/core';

type Session = { authenticated: boolean };
type NativeResponse = { status: number; contentType: string; body: string };
export type LoginFields = { gatewayUser: string; gatewayPassword: string; login: string; password: string; code: string };
interface NativeTransport {
  session(): Promise<Session>;
  login(fields: LoginFields): Promise<Session>;
  logout(): Promise<Session>;
  request(options: { id: string; path: string; method: string; body?: string }): Promise<NativeResponse>;
  resetLocal(): Promise<void>;
  cancel(options: { id: string }): Promise<void>;
}
const native = registerPlugin<NativeTransport>('PNETTransport');
const expired = new EventTarget();
let generation = 0;
let authenticated = false;
let checking: Promise<boolean> | null = null;
const pending = new Set<string>();

function requireNative() {
  if (Capacitor.getPlatform() !== 'ios' || !Capacitor.isPluginAvailable('PNETTransport')) {
    throw new Error('Open the installed iPhone app. Native transport is unavailable.');
  }
}
function cancelPending() {
  generation++;
  for (const id of pending) void native.cancel({ id }).catch(() => {});
  pending.clear();
}
export function clearSession() {
  authenticated = false;
  cancelPending();
  expired.dispatchEvent(new Event('expired'));
}
export function onSessionExpired(listener: () => void) {
  expired.addEventListener('expired', listener);
  return () => expired.removeEventListener('expired', listener);
}
export async function checkSession(signal?: AbortSignal): Promise<boolean> {
  requireNative();
  signal?.throwIfAborted();
  if (!checking) {
    const before = generation;
    checking = native.session().then(result => {
      if (before !== generation) return false;
      authenticated = result.authenticated === true;
      if (!authenticated) clearSession();
      return authenticated;
    }).finally(() => { checking = null; });
  }
  const result = await checking;
  signal?.throwIfAborted();
  return result;
}
export async function signIn(fields: LoginFields): Promise<void> {
  requireNative();
  if (checking) await checking;
  const result = await native.login(fields);
  if (result.authenticated !== true) throw new Error('Sign-in failed.');
  cancelPending();
  authenticated = true;
}
export async function reconnectDevice(): Promise<void> {
  requireNative();
  await native.resetLocal();
  clearSession();
}
export async function signOut(): Promise<void> {
  requireNative();
  cancelPending();
  await native.logout();
  clearSession();
}
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  requireNative();
  init.signal?.throwIfAborted();
  if (!authenticated) throw new Error('Authentication required.');
  // Native code independently applies a route/method allowlist and sets all credentials.
  if (!/^\/api\/v1\/[A-Za-z0-9/-]+$/.test(path)) throw new Error('Invalid API path.');
  const method = (init.method ?? 'GET').toUpperCase();
  const uuid = '[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}';
  const relationship = new RegExp(`^/api/v1/relationships/${uuid}$`).test(path);
  const taxonomyItem = new RegExp(`^/api/v1/(?:categories|interests)/${uuid}$`).test(path);
  const assignment = new RegExp(`^/api/v1/people/${uuid}/(?:categories|interests)/${uuid}$`).test(path);
  const eventCollection = new RegExp(`^/api/v1/people/${uuid}/contact-events$`).test(path);
  const eventOrReminder = new RegExp(`^/api/v1/(?:contact-events|reminders)/${uuid}$`).test(path);
  const channelCollection = new RegExp(`^/api/v1/people/${uuid}/contact-channels$`).test(path);
  const channelItem = new RegExp(`^/api/v1/contact-channels/${uuid}$`).test(path);
  const mutationAllowed =
    (method === 'POST' && ['/api/v1/people', '/api/v1/relationships', '/api/v1/categories', '/api/v1/interests'].includes(path)) ||
    (method === 'PATCH' && (new RegExp(`^/api/v1/people/${uuid}$`).test(path) || relationship || taxonomyItem)) ||
    (method === 'DELETE' && (relationship || taxonomyItem)) ||
    ((method === 'POST' || method === 'DELETE') && assignment) ||
    (method === 'POST' && eventCollection) ||
    ((method === 'PATCH' || method === 'DELETE') && eventOrReminder) ||
    (method === 'POST' && channelCollection) ||
    ((method === 'PATCH' || method === 'DELETE') && channelItem);
  if (method !== 'GET' && !mutationAllowed) throw new Error('This action is not enabled in the iPhone app.');
  if ((method === 'GET' || method === 'DELETE' || assignment) && init.body != null) throw new Error('Invalid request body.');
  if (init.body !== undefined && init.body !== null && typeof init.body !== 'string') {
    throw new Error('Photo uploads are not enabled in the first connected checkpoint.');
  }
  const headers = new Headers(init.headers);
  for (const [key, value] of headers) {
    if (key !== 'content-type' || value.toLowerCase() !== 'application/json') throw new Error('Unsupported request header.');
  }
  const id = crypto.randomUUID();
  const before = generation;
  const cancel = () => { void native.cancel({ id }).catch(() => {}); };
  pending.add(id);
  try {
    // Dispatch before installing the abort handler: cancel must follow request on the bridge.
    const request = native.request({ id, path, method, ...(typeof init.body === 'string' ? { body: init.body } : {}) });
    init.signal?.addEventListener('abort', cancel, { once: true });
    if (init.signal?.aborted) cancel();
    const result = await request;
    init.signal?.throwIfAborted();
    if (before !== generation) throw new Error('Session changed.');
    if (!Number.isInteger(result.status) || result.status < 200 || result.status > 599) throw new Error('Invalid server response.');
    const bytes = Uint8Array.from(atob(result.body), c => c.charCodeAt(0));
    return new Response([204, 205, 304].includes(result.status) ? null : bytes, {
      status: result.status,
      headers: { 'Content-Type': result.contentType, 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    if (before === generation && (error as { code?: string })?.code === 'SESSION_EXPIRED') clearSession();
    init.signal?.throwIfAborted();
    throw error;
  } finally {
    init.signal?.removeEventListener('abort', cancel);
    pending.delete(id);
  }
}
