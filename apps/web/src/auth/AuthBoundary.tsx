import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { checkSession, onSessionExpired, signIn, signOut } from './client';

export function AuthBoundary({ children }: { children: ReactNode }) {
  const [state, setState] = useState<'checking' | 'signedOut' | 'signedIn' | 'error'>('checking');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const remove = onSessionExpired(() => { setState('signedOut'); setError(''); });
    checkSession(controller.signal).then(ok => {
      if (!controller.signal.aborted) setState(ok ? 'signedIn' : 'signedOut');
    }).catch(() => { if (!controller.signal.aborted) { setState('error'); setError('Unable to verify session. Check your connection and retry.'); } });
    return () => { controller.abort(); remove(); };
  }, [attempt]);
  useEffect(() => {
    if (state === 'signedIn') return;
    document.title = 'Sign in — Personal Network';
  }, [state]);
  useEffect(() => {
    if (state !== 'signedIn') return;
    const verify = () => {
      if (document.visibilityState !== 'visible') return;
      checkSession().catch(() => { setState('error'); setError('Unable to verify session. Retry to continue.'); });
    };
    window.addEventListener('pageshow', verify);
    window.addEventListener('focus', verify);
    return () => { window.removeEventListener('pageshow', verify); window.removeEventListener('focus', verify); };
  }, [state]);
  if (state === 'signedIn') return children;
  return <main className="pnet-auth" aria-label="Owner sign in">
    <section className="pnet-auth-card">
      <h1>Personal Network</h1>
      {state === 'checking' && <p role="status">Checking session…</p>}
      {state === 'error' && <><p role="alert">{error}</p><button type="button" onClick={() => { setState('checking'); setAttempt(value => value + 1); }}>Retry</button></>}
      {state === 'signedOut' && <LoginForm onSuccess={() => setState('signedIn')} />}
    </section>
  </main>;
}
function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const loginRef = useRef<HTMLInputElement>(null);
  useEffect(() => { loginRef.current?.focus(); }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try { await signIn(login.trim(), password, code.trim()); onSuccess(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to sign in.'); }
    finally { setBusy(false); setPassword(''); setCode(''); }
  }
  return <form onSubmit={submit} aria-busy={busy}>
    <p>Private access for the owner of this installation.</p>
    <label htmlFor="owner-login">Login</label>
    <input ref={loginRef} id="owner-login" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} value={login} onChange={e => setLogin(e.target.value)} required minLength={3} maxLength={64} disabled={busy} />
    <label htmlFor="owner-password">Password</label>
    <input id="owner-password" name="password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required maxLength={128} disabled={busy} />
    <label htmlFor="owner-code">Authenticator or recovery code</label>
    <input id="owner-code" name="code" type="password" autoComplete="one-time-code" autoCapitalize="none" spellCheck={false} value={code} onChange={e => setCode(e.target.value)} required maxLength={32} disabled={busy} aria-describedby="owner-code-help" />
    <p id="owner-code-help">Enter the current 6-digit code, or one unused recovery code. Your password is required in both cases.</p>
    {error && <p role="alert">{error}</p>}
    <button type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
    <p>No guest access or public registration. Account recovery is managed from your server.</p>
  </form>;
}
export function SignOutButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <div className="pnet-auth-actions">
    <button type="button" disabled={busy} onClick={async () => {
      setBusy(true); setError('');
      try { await signOut(); }
      catch (cause) { setError(cause instanceof Error ? cause.message : 'Sign out failed. Please retry.'); }
      finally { setBusy(false); }
    }}>{busy ? 'Signing out…' : 'Sign out'}</button>
    {error && <span role="alert">{error}</span>}
  </div>;
}
