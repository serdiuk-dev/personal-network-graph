import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { checkSession, onSessionExpired, signIn, signOut, reconnectDevice, type LoginFields } from './native-client';

export function AuthBoundary({ children }: { children: ReactNode }) {
  const [state, setState] = useState<'checking' | 'signedOut' | 'signedIn' | 'error'>('checking');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const verification = useRef(0);
  const currentAuthState = useRef(state);
  currentAuthState.current = state;
  useEffect(() => {
    let alive = true;
    const verify = async () => {
      const version = ++verification.current;
      setState('checking');
      try {
        const ok = await checkSession();
        if (alive && version === verification.current) setState(ok ? 'signedIn' : 'signedOut');
      } catch (cause) {
        if (alive && version === verification.current) {
          setError(cause instanceof Error ? cause.message : 'Unable to verify session.');
          setState('error');
        }
      }
    };
    const remove = onSessionExpired(() => { if (alive && currentAuthState.current === 'signedIn') { setState('checking'); setError(''); setAttempt(n => n + 1); } });
    const visibility = () => {
      // Keep the unfinished login form mounted while using Authenticator.
      if (currentAuthState.current === 'signedOut') return;
      if (document.visibilityState === 'hidden') {
        verification.current++;
        setState('checking'); // Unmount contacts/photos before foreground revalidation.
      } else void verify();
    };
    document.addEventListener('visibilitychange', visibility);
    void verify();
    return () => { alive = false; verification.current++; remove(); document.removeEventListener('visibilitychange', visibility); };
  }, [attempt]);
  if (state === 'signedIn') return children;
  return <main className="pnet-auth" aria-label="Owner sign in"><section className="pnet-auth-card">
    <h1>Personal Network</h1>
    {state === 'checking' && <p role="status">Checking session…</p>}
    {state === 'error' && <><p role="alert">{error}</p><button onClick={() => setAttempt(n => n + 1)}>Retry Face ID</button><button onClick={async () => {
      if (!window.confirm('Forget local device access and sign in again? Revoke the old device in WEB to remove its server access.')) return;
      verification.current++;
      try { await reconnectDevice(); setError(''); setState('signedOut'); }
      catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to reconnect.'); }
    }}>Reconnect device</button></>}
    {state === 'signedOut' && <LoginForm onSuccess={() => setState('signedIn')} />}
  </section></main>;
}
function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const values = Object.fromEntries(data) as LoginFields;
    values.gatewayUser = values.gatewayUser.trim();
    values.login = values.login.trim(); values.code = values.code.trim();
    setBusy(true); setError('');
    try { await signIn(values); onSuccess(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to sign in.'); }
    finally {
      for (const key of ['gatewayPassword', 'password', 'code'] as const) {
        values[key] = '';
        const input = form.elements.namedItem(key) as HTMLInputElement | null;
        if (input) input.value = '';
      }
      setBusy(false);
    }
  }
  return <form onSubmit={submit} aria-busy={busy}>
    <p>Connect this iPhone once with website access and your owner account. Face ID will unlock it afterward.</p>
    <label htmlFor="gateway-user">Website access login</label>
    <input id="gateway-user" name="gatewayUser" autoComplete="off" autoCapitalize="none" spellCheck={false} required maxLength={128} disabled={busy} />
    <label htmlFor="gateway-password">Website access password</label>
    <input id="gateway-password" name="gatewayPassword" type="password" autoComplete="off" required maxLength={1024} disabled={busy} />
    <label htmlFor="owner-login">Owner login</label>
    <input id="owner-login" name="login" autoComplete="username" autoCapitalize="none" spellCheck={false} required minLength={3} maxLength={64} disabled={busy} />
    <label htmlFor="owner-password">Owner password</label>
    <input id="owner-password" name="password" type="password" autoComplete="current-password" required maxLength={128} disabled={busy} />
    <label htmlFor="owner-code">Authenticator or recovery code</label>
    <input id="owner-code" name="code" type="password" autoComplete="one-time-code" autoCapitalize="none" spellCheck={false} required maxLength={32} disabled={busy} />
    <p>Enter a fresh 6-digit code, or one unused recovery code. Device access is protected by Face ID on this iPhone. Reconnection is required after 30 days or 7 days without use.</p>
    {error && <p role="alert">{error}</p>}
    <button type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
  </form>;
}
export function SignOutButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <div className="pnet-auth-actions">
    <button disabled={busy} onClick={async () => {
      setBusy(true); setError('');
      try { await signOut(); }
      catch (cause) { setError(cause instanceof Error ? cause.message : 'Sign out failed.'); }
      finally { setBusy(false); }
    }}>{busy ? 'Signing out…' : 'Sign out'}</button>
    {error && <span role="alert">{error}</span>}
  </div>;
}
