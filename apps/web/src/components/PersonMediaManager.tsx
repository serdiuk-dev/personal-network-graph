import { CONTACT_ICONS, createContactIconFile } from './contactIcons';
import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../auth/client';

const MAX_BYTES = 5 * 1024 * 1024;

export function PersonMediaManager({ personId, personName, onClose }: {
  personId: string;
  personName: string;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [selected, setSelected] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const lifetime = useRef<AbortController | null>(null);
  const currentURL = useRef<string | null>(null);
  const previewURL = useRef<string | null>(null);
  const endpoint = `/api/v1/people/${encodeURIComponent(personId)}/photo`;

  function replaceCurrent(url: string | null) {
    if (currentURL.current) URL.revokeObjectURL(currentURL.current);
    currentURL.current = url;
    setCurrent(url);
  }
  function clearSelection() {
    if (previewURL.current) URL.revokeObjectURL(previewURL.current);
    previewURL.current = null;
    setPreview(null);
    setSelected(null);
    if (input.current) input.current.value = '';
  }
  async function readPhoto(signal: AbortSignal) {
    const response = await apiFetch(endpoint, { signal });
    if (signal.aborted) return;
    if (response.status === 404) { replaceCurrent(null); return; }
    if (!response.ok) throw new Error('Unable to load photo. Try again.');
    const blob = await response.blob();
    if (signal.aborted) return;
    replaceCurrent(URL.createObjectURL(blob));
  }

  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    setLoading(true);
    readPhoto(controller.signal)
      .catch(err => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Unable to load photo.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => {
      controller.abort();
      if (currentURL.current) URL.revokeObjectURL(currentURL.current);
      if (previewURL.current) URL.revokeObjectURL(previewURL.current);
      currentURL.current = previewURL.current = null;
    };
    // Parent uses key={personId}; every contact gets an isolated request lifetime.
  }, [personId]);

  function choose(file?: File) {
    clearSelection();
    setError('');
    setNotice('');
    if (!file) return;
    if (!file.size || file.size > MAX_BYTES) { setError('Choose an image up to 5 MB.'); return; }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Choose JPG, PNG or WebP. Export HEIC photos as JPG first.'); return;
    }
    const url = URL.createObjectURL(file);
    previewURL.current = url;
    setPreview(url);
    setSelected(file);
  }

  async function chooseIcon(id: string) {
    if (busy || loading || !lifetime.current) return;
    const signal = lifetime.current.signal;
    setBusy(true); setError(''); setNotice('');
    try {
      const file = await createContactIconFile(id);
      if (!signal.aborted) choose(file);
    } catch (err) {
      if (!signal.aborted) setError(err instanceof Error ? err.message : 'Unable to prepare icon.');
    } finally { if (!signal.aborted) setBusy(false); }
  }

  async function save() {
    if (!selected || busy || !lifetime.current) return;
    const signal = lifetime.current.signal;
    setBusy(true); setError(''); setNotice('');
    try {
      const body = new FormData();
      body.append('file', selected);
      const response = await apiFetch(endpoint, { method: 'POST', body, signal });
      if (!response.ok) {
        const messages: Record<number, string> = {
          400: 'Invalid image. Use a non-animated JPG, PNG or WebP up to 25 megapixels.',
          413: 'Image exceeds the upload size limit (5 MB).',
          415: 'Only JPG, PNG and WebP images are supported.',
          404: 'This contact no longer exists.',
          503: 'Image processing is busy. Try again shortly.',
        };
        throw new Error(messages[response.status] || 'Unable to save photo. Try again.');
      }
      if (signal.aborted) return;
      clearSelection();
      setNotice('Photo saved.');
      await readPhoto(signal);
    } catch (err) {
      if (!signal.aborted) setError(err instanceof Error ? err.message : 'Unable to save photo.');
    } finally { if (!signal.aborted) setBusy(false); }
  }

  async function remove() {
    if (busy || !lifetime.current || !window.confirm(`Remove the photo / icon for ${personName}?`)) return;
    const signal = lifetime.current.signal;
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await apiFetch(endpoint, { method: 'DELETE', signal });
      if (!response.ok) throw new Error('Unable to remove photo. Try again.');
      if (signal.aborted) return;
      replaceCurrent(null); clearSelection(); setNotice('Photo removed.');
    } catch (err) {
      if (!signal.aborted) setError(err instanceof Error ? err.message : 'Unable to remove photo.');
    } finally { if (!signal.aborted) setBusy(false); }
  }

  return <section className="pnet-media" aria-label={`Photo / Icon: ${personName}`} aria-busy={busy || loading}>
    <h2>Photo / Icon — {personName}</h2>
    <p>JPG, PNG or WebP · up to 5 MB / 25 megapixels. Transparent icons are supported. Visible only after sign-in.</p>
    <div className="pnet-media-preview">
      {loading ? <span role="status">Loading photo…</span> : (preview || current) ?
        <img src={preview || current || ''} alt={preview ? `Selected image for ${personName}` : `Photo of ${personName}`}
          onError={() => { if (preview) { clearSelection(); setError('Cannot preview this image. Choose another file.'); } }} /> :
        <span>No photo / icon</span>}
    </div>
    {preview && <p role="status">Preview — save to upload this image.</p>}
    <div className="pnet-field">
      <input ref={input} type="file" hidden accept="image/jpeg,image/png,image/webp" disabled={busy || loading}
        onChange={event => choose(event.target.files?.[0])} />
      <button type="button" disabled={busy || loading} onClick={() => input.current?.click()}>
        {current ? 'Choose replacement' : 'Choose photo / icon'}
      </button>
      <span role="status">{selected ? selected.name : 'No file selected'}</span>
    </div>
    <fieldset className="pnet-icon-picker" disabled={busy || loading}>
      <legend>Choose a built-in icon</legend>
      <div className="pnet-icon-grid">
        {CONTACT_ICONS.map(icon => (
          <button key={icon.id} type="button" onClick={() => void chooseIcon(icon.id)}
            aria-label={`Choose ${icon.label} icon`}>
            <svg viewBox="0 0 24 24" width="40" height="40" aria-hidden="true" focusable="false">
              <rect width="24" height="24" fill="#eff6ff" />
              <path d={icon.path} fill="#2563eb" fillRule="evenodd" />
            </svg>
            <span>{icon.label}</span>
          </button>
        ))}
      </div>
      <p>Select an icon, then save to apply it.</p>
    </fieldset>
    <div className="pnet-media-actions">
      <button type="button" disabled={!selected || busy || loading} onClick={save}>{busy ? 'Please wait…' : 'Save photo / icon'}</button>
      {selected && <button type="button" disabled={busy} onClick={clearSelection}>Cancel selection</button>}
      {current && <button type="button" disabled={busy || loading} onClick={remove}>Remove photo / icon</button>}
      <button type="button" disabled={busy} onClick={onClose}>Close</button>
    </div>
    {error && <p className="pnet-error" role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
  </section>;
}
