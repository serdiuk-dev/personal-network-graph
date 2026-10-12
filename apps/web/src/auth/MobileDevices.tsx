import { useEffect, useRef, useState } from 'react';
import { apiFetch } from './client';
type Device = { id: string; name: string; createdAt: string; lastUsedAt: string; expiresAt: string };
export function MobileDevices({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    dialog.current?.showModal();
    const controller = new AbortController();
    apiFetch('/api/v1/auth/mobile/devices', { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('Unable to load devices.');
      const rows = await response.json();
      if (!controller.signal.aborted) setDevices(rows);
    }).catch(cause => { if (!controller.signal.aborted) setError(cause.message); })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, []);
  async function revoke(device: Device) {
    if (!window.confirm(`Disconnect ${device.name}? This phone will need a full sign-in again.`)) return;
    setBusy(true); setError('');
    try {
      const response = await apiFetch(`/api/v1/auth/mobile/devices/${device.id}/revoke`, { method: 'POST' });
      if (!response.ok) throw new Error('Unable to revoke device. Please retry.');
      setDevices(rows => rows.filter(row => row.id !== device.id));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to revoke device.'); }
    finally { setBusy(false); }
  }
  return <dialog ref={dialog} onClose={onClose} aria-labelledby="device-heading" style={{
    maxWidth: 520, width: 'calc(100% - 40px)', maxHeight: '80vh', overflow: 'auto',
    padding: 24, borderRadius: 12, color: 'CanvasText', background: 'Canvas', border: '1px solid GrayText',
  }}>
    <h2 id="device-heading">Connected phones</h2>
    <p>Face ID unlocks the app. Device access expires after 30 days or 7 days without renewal.</p>
    {error && <p role="alert">{error}</p>}
    {busy && <p role="status">Please wait…</p>}
    {!busy && !error && !devices.length && <p>No connected phones.</p>}
    <ul style={{ paddingLeft: 20 }}>{devices.map(device => <li key={device.id} style={{ marginBottom: 18 }}>
      <strong>{device.name}</strong> · {device.id.slice(-8)}<br />
      Connected: {new Date(device.createdAt).toLocaleString()}<br />
      Last renewal: {new Date(device.lastUsedAt).toLocaleString()}<br />
      Expires: {new Date(device.expiresAt).toLocaleString()}<br />
      <button type="button" disabled={busy} onClick={() => void revoke(device)}>Revoke access</button>
    </li>)}</ul>
    <button type="button" onClick={() => dialog.current?.close()}>Close</button>
  </dialog>;
}
