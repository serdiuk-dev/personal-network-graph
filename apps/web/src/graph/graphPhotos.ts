import { apiFetch, onSessionExpired } from '../auth/client';

async function decodeThumbnail(blob: Blob): Promise<ImageBitmap> {
  const full = await createImageBitmap(blob);
  const scale = Math.min(1, 128 / Math.max(full.width, full.height));
  if (scale === 1) return full;
  try {
    return await createImageBitmap(full, {
      resizeWidth: Math.max(1, Math.round(full.width * scale)),
      resizeHeight: Math.max(1, Math.round(full.height * scale)),
      resizeQuality: 'high',
    });
  } finally { full.close(); }
}

// Owned by one graph view: no localStorage, public image URL or cross-session cache.
export function createGraphPhotos(onChange: () => void, dependencies: {
  fetch?: typeof apiFetch;
  decode?: (blob: Blob) => Promise<ImageBitmap>;
  onExpired?: typeof onSessionExpired;
} = {}) {
  const fetchPhoto = dependencies.fetch ?? apiFetch;
  const decode = dependencies.decode ?? decodeThumbnail;
  const images = new Map<string, ImageBitmap>();
  const requested = new Set<string>();
  const queue: string[] = [];
  const abort = new AbortController();
  let disposed = false, active = 0;
  let unsubscribe = () => {};

  function dispose() {
    if (disposed) return;
    disposed = true;
    abort.abort();
    queue.length = 0;
    requested.clear();
    for (const bitmap of images.values()) bitmap.close();
    images.clear();
    unsubscribe();
  }
  unsubscribe = (dependencies.onExpired ?? onSessionExpired)(() => {
    dispose(); onChange();
  });

  async function load(id: string) {
    try {
      const response = await fetchPhoto(`/api/v1/people/${encodeURIComponent(id)}/photo`, { signal: abort.signal });
      if (disposed || !response.ok) return; // No photo or unavailable: retain the regular node.
      const blob = await response.blob();
      if (disposed) return;
      const bitmap = await decode(blob);
      if (disposed) { bitmap.close(); return; }
      images.set(id, bitmap);
      onChange();
    } catch {
      // A failed image must not break graph interaction or hide the regular node.
    } finally {
      active--; pump();
    }
  }
  function pump() {
    while (!disposed && active < 4 && queue.length) {
      active++;
      void load(queue.shift()!);
    }
  }
  return {
    images,
    request(ids: string[]) {
      if (disposed) return;
      for (const id of ids) {
        if (requested.has(id)) continue;
        requested.add(id); queue.push(id);
      }
      pump();
    },
    dispose,
  };
}

export type PhotoNode = {
  id: string; x: number; y: number; radius: number;
  data: { zIndex: number; color: string; label?: string | null };
};

export function drawGraphPhotos(canvas: CanvasRenderingContext2D, nodes: PhotoNode[], images: ReadonlyMap<string, ImageBitmap>) {
  if (!images.size) return;
  // Repaint ALL visible disks in the same depth order, so a photo never floats
  // over a nearer node without a photo. Labels are drawn afterwards by the caller.
  const ordered = [...nodes].sort((a, b) => a.data.zIndex - b.data.zIndex || a.id.localeCompare(b.id));
  for (const node of ordered) {
    if (!Number.isFinite(node.radius) || node.radius <= 0) continue;
    canvas.save();
    canvas.beginPath();
    canvas.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
    canvas.fillStyle = node.data.color;
    canvas.fill();
    const bitmap = images.get(node.id);
    const inset = Math.min(3, Math.max(1.5, node.radius * 0.12));
    const radius = node.radius - inset;
    if (bitmap && radius > 0) {
      canvas.beginPath();
      canvas.arc(node.x, node.y, radius, 0, Math.PI * 2);
      canvas.clip();
      // Retain the color ring and fade non-neighbors when a contact is selected.
      canvas.globalAlpha = node.data.label ? 1 : 0.18;
      const side = Math.min(bitmap.width, bitmap.height);
      canvas.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2,
        side, side, node.x - radius, node.y - radius, radius * 2, radius * 2);
    }
    canvas.restore();
  }
}
