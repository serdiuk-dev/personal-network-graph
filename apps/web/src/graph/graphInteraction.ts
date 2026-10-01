import { createGraphPhotos, drawGraphPhotos } from './graphPhotos';
import type Graph from 'graphology';
import type Sigma from 'sigma';
import { createGraphReturn } from './graphReturn';
import { boxHitsDisk, interpolate, intersects, separateDisks, type Box, type Disk, type Point } from './graphGeometry';

export type GraphInteraction = { restore: () => void; dispose: () => void };
export function installGraphInteraction(renderer: Sigma, graph: Graph, container: HTMLDivElement,
  selfId: string, select: (id: string) => void): GraphInteraction {
  const rest = new Map<string, Point>();
  const layer = renderer.createCanvas('pnet-contact-labels', { afterLayer: 'labels' });
  layer.style.pointerEvents = 'none';
  // Sigma's hover redraw would otherwise defeat the INNER/MIDDLE/OUTER depth order.
  for (const name of ['hovers', 'hoverNodes']) renderer.getCanvases()[name].style.visibility = 'hidden';
  let dead = false, frame = 0;
  let inspectedId: string | null = null;
  const autoReturn = createGraphReturn(restore);
  let returning = false, changed = false, suppressUntil = 0;
  let drag: { id: string; pointer: number; start: Point; latest: Point; positions: Map<string, Point>; moved: boolean; touch: boolean } | null = null;
  const pointers = new Set<number>();
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const canvas = layer.getContext('2d')!;
  const photos = createGraphPhotos(drawLabels);
  const oldTouchAction = container.style.touchAction;
  container.style.touchAction = 'none';
  const point = (event: PointerEvent): Point => {
    const rect = container.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const position = (id: string): Point => ({ x: graph.getNodeAttribute(id, 'x'), y: graph.getNodeAttribute(id, 'y') });
  const visible = () => graph.nodes().filter(id => id !== selfId && !renderer.getNodeDisplayData(id)?.hidden);
  const disk = (id: string, p = position(id)): Disk => {
    const data = renderer.getNodeDisplayData(id)!;
    return { id, ...renderer.graphToViewport(p), radius: renderer.scaleSize(data.size) };
  };
  const update = (positions: Map<string, Point>) => {
    graph.updateEachNodeAttributes((id, attributes) => positions.has(id) ? { ...attributes, ...positions.get(id)! } : attributes, { attributes: ['x', 'y'] });
    renderer.refresh();
  };
  const cancelFrame = () => { cancelAnimationFrame(frame); frame = 0; returning = false; };
  const radialBase = new Map(graph.nodes().map(id => [id, position(id)]));
  function saveRest() {
    // Re-solve the radial base on resize, never accumulate earlier viewport offsets.
    update(radialBase);
    const nodes = visible().map(id => disk(id));
    const center: Disk = { id: selfId, ...renderer.graphToViewport({ x: 0, y: 0 }), radius: 50, fixed: true };
    const separated = separateDisks([center, ...nodes]);
    const positions = new Map(separated.filter(n => n.id !== selfId).map(n => [n.id, renderer.viewportToGraph(n)]));
    update(positions);
    for (const id of graph.nodes()) rest.set(id, position(id));
  }
  function drawLabels() {
    if (dead) return;
    const { width, height } = renderer.getDimensions();
    // Canvas backing pixels and CSS layout pixels must stay separate on Retina.
    layer.style.width = `${width}px`;
    layer.style.height = `${height}px`;
    const ratio = devicePixelRatio || 1;
    if (layer.width !== Math.round(width * ratio) || layer.height !== Math.round(height * ratio)) {
      layer.width = Math.round(width * ratio); layer.height = Math.round(height * ratio);
    }
    canvas.setTransform(ratio, 0, 0, ratio, 0, 0);
    canvas.clearRect(0, 0, width, height);
    canvas.font = '500 11px Inter, system-ui, sans-serif';
    canvas.textBaseline = 'middle';
    const nodes = visible().map(id => ({ ...disk(id), initials: graph.getNodeAttribute(id, 'initials') as string | undefined, data: renderer.getNodeDisplayData(id)! }));
    // Request only nodes currently intersecting the viewport. Coordinates remain
    // CSS pixels; the existing Retina transform applies to both photos and labels.
    const inView = nodes.filter(node => node.x + node.radius >= 0 && node.y + node.radius >= 0
      && node.x - node.radius <= width && node.y - node.radius <= height);
    photos.request(inView.map(node => node.id));
    drawGraphPhotos(canvas, inView, photos.images);
    nodes.sort((a, b) => b.data.zIndex - a.data.zIndex || a.id.localeCompare(b.id));
    const boxes: Box[] = [];
    for (const node of nodes) {
      if (!node.data.label) continue;
      let text = String(node.data.label);
      const max = Math.max(60, Math.min(230, width - 24));
      while (text.length > 1 && canvas.measureText(text).width > max) text = text.slice(0, -2) + '…';
      const w = canvas.measureText(text).width + 8, h = 17, r = node.radius + 4;
      const candidates: Box[] = [
        { x: node.x + r, y: node.y - h / 2, width: w, height: h },
        { x: node.x - r - w, y: node.y - h / 2, width: w, height: h },
        { x: node.x - w / 2, y: node.y - r - h, width: w, height: h },
        { x: node.x - w / 2, y: node.y + r, width: w, height: h },
      ];
      const box = candidates.find(b => b.x >= 2 && b.y >= 2 && b.x + w <= width - 2 && b.y + h <= height - 2
        && !boxes.some(other => intersects(b, other)) && !nodes.some(other => boxHitsDisk(b, other)));
      if (!box) continue; // Full name remains available in search and selected-person details.
      boxes.push(box);
      canvas.fillStyle = 'rgba(248,251,252,0.93)'; canvas.fillRect(box.x, box.y, w, h);
      canvas.fillStyle = '#17233d'; canvas.fillText(text, box.x + 4, box.y + h / 2);
    }
  }
  function restore() {
    if (dead || drag) return;
    autoReturn.cancel();
    inspectedId = null;
    cancelFrame();
    if (!changed) return;
    const start = new Map(graph.nodes().map(id => [id, position(id)]));
    const begun = performance.now(); returning = true;
    const tick = (now: number) => {
      if (dead) return;
      const t = media.matches || document.hidden ? 1 : Math.min(1, (now - begun) / 600);
      update(new Map([...rest].map(([id, p]) => [id, t === 1 ? p : interpolate(start.get(id)!, p, t)])));
      if (t < 1) frame = requestAnimationFrame(tick);
      else { frame = 0; returning = false; changed = false; }
    };
    frame = requestAnimationFrame(tick);
  }
  function moveFrame() {
    frame = 0;
    if (!drag || !drag.moved) return;
    const dx = drag.latest.x - drag.start.x, dy = drag.latest.y - drag.start.y;
    const linked = new Set(graph.neighbors(drag.id));
    const pixels = visible().map(id => {
      const base = renderer.graphToViewport(drag!.positions.get(id)!);
      const distance = Math.hypot(base.x - drag!.start.x, base.y - drag!.start.y);
      const influence = id === drag!.id ? 1 : media.matches ? 0 : Math.max(linked.has(id) ? 0.15 : 0, 0.2 * Math.max(0, 1 - distance / 220));
      return { ...disk(id, drag!.positions.get(id)), x: base.x + dx * influence, y: base.y + dy * influence, fixed: id === drag!.id };
    });
    const center: Disk = { id: selfId, ...renderer.graphToViewport({ x: 0, y: 0 }), radius: 50, fixed: true };
    update(new Map(separateDisks([center, ...pixels], 5).filter(n => n.id !== selfId).map(n => [n.id, renderer.viewportToGraph(n)])));
    changed = true;
    autoReturn.moved();
  }
  function down(event: PointerEvent) {
    pointers.add(event.pointerId);
    if (pointers.size > 1) { finish(true); return; }
    if (event.button !== 0 || event.ctrlKey || event.metaKey) return;
    const p = point(event);
    const hit = visible().map(id => ({ ...disk(id), z: renderer.getNodeDisplayData(id)!.zIndex }))
      .filter(n => Math.hypot(n.x - p.x, n.y - p.y) <= n.radius + (event.pointerType === 'touch' ? 5 : 0))
      .sort((a, b) => b.z - a.z)[0];
    if (!hit) return;
    cancelFrame();
    inspectedId = hit.id;
    autoReturn.hold(true);
    drag = { id: hit.id, pointer: event.pointerId, start: p, latest: p,
      positions: new Map(graph.nodes().map(id => [id, position(id)])), moved: false, touch: event.pointerType !== 'mouse' };
    event.preventDefault(); event.stopImmediatePropagation();
    container.focus({ preventScroll: true });
    container.setPointerCapture(event.pointerId);
    container.style.cursor = 'grabbing';
  }
  function overInspected(p: Point) {
    if (!inspectedId || !graph.hasNode(inspectedId) || renderer.getNodeDisplayData(inspectedId)?.hidden) return false;
    const node = disk(inspectedId);
    return Math.hypot(p.x - node.x, p.y - node.y) <= node.radius + 3;
  }
  function move(event: PointerEvent) {
    if (!drag) {
      if (event.pointerType === 'mouse') autoReturn.hold(overInspected(point(event)));
      return;
    }
    if (event.pointerId !== drag.pointer) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const next = point(event);
    if (next.x === drag.latest.x && next.y === drag.latest.y) return;
    drag.latest = next;
    if (Math.hypot(drag.latest.x - drag.start.x, drag.latest.y - drag.start.y) > 4) drag.moved = true;
    if (drag.moved && !frame) frame = requestAnimationFrame(moveFrame);
  }
  function finish(cancelled: boolean) {
    if (!drag) return;
    if (frame) { cancelAnimationFrame(frame); frame = 0; moveFrame(); }
    const current = drag; drag = null;
    if (container.hasPointerCapture(current.pointer)) container.releasePointerCapture(current.pointer);
    container.style.cursor = 'default'; suppressUntil = performance.now() + 350;
    if (!current.moved && !cancelled) select(current.id);
    autoReturn.hold(!current.touch && !cancelled && overInspected(current.latest));
    if (cancelled) restore();
  }
  function up(event: PointerEvent) {
    pointers.delete(event.pointerId);
    if (drag?.pointer !== event.pointerId) return;
    event.preventDefault(); event.stopImmediatePropagation(); finish(false);
  }
  function cancel(event: PointerEvent) { pointers.delete(event.pointerId); if (drag?.pointer === event.pointerId) finish(true); }
  function click(event: MouseEvent) {
    if (performance.now() < suppressUntil) { event.preventDefault(); event.stopImmediatePropagation(); }
  }
  function wheel(event: WheelEvent) { if (drag) { event.preventDefault(); event.stopImmediatePropagation(); } }
  function touch(event: TouchEvent) { if (drag) { event.preventDefault(); event.stopImmediatePropagation(); } }
  function leave() { if (!drag) autoReturn.hold(false); }
  function keyboard(event: KeyboardEvent) { if (event.key === 'Escape') { finish(true); restore(); } }
  function blur() { pointers.clear(); finish(true); restore(); }
  function visibility() { if (document.hidden) { blur(); cancelFrame(); if (changed) { update(rest); changed = false; } } }
  function resized() { if (!drag && !changed && !returning) { saveRest(); drawLabels(); } }

  renderer.setCustomBBox(renderer.getBBox()); // Keep camera normalization stable during dragging/return.
  saveRest();
  renderer.on('afterRender', drawLabels);
  renderer.on('resize', resized);
  container.addEventListener('pointerdown', down, true);
  container.addEventListener('pointermove', move, true);
  window.addEventListener('pointerup', up, true);
  container.addEventListener('pointercancel', cancel, true);
  container.addEventListener('lostpointercapture', cancel, true);
  container.addEventListener('click', click, true);
  container.addEventListener('touchstart', touch, { capture: true, passive: false });
  container.addEventListener('touchmove', touch, { capture: true, passive: false });
  container.addEventListener('wheel', wheel, { capture: true, passive: false });
  container.addEventListener('pointerleave', leave);
  container.addEventListener('keydown', keyboard);
  window.addEventListener('blur', blur);
  document.addEventListener('visibilitychange', visibility);
  drawLabels();
  return { restore, dispose() {
    dead = true; photos.dispose(); autoReturn.dispose(); cancelFrame();
    const pointer = drag?.pointer; drag = null;
    if (pointer !== undefined && container.hasPointerCapture(pointer)) container.releasePointerCapture(pointer);
    renderer.off('afterRender', drawLabels); renderer.off('resize', resized);
    container.removeEventListener('pointerdown', down, true); container.removeEventListener('pointermove', move, true);
    window.removeEventListener('pointerup', up, true); container.removeEventListener('pointercancel', cancel, true);
    container.removeEventListener('lostpointercapture', cancel, true); container.removeEventListener('click', click, true);
    container.removeEventListener('touchstart', touch, true); container.removeEventListener('touchmove', touch, true);
    container.removeEventListener('wheel', wheel, true);
    container.removeEventListener('pointerleave', leave); container.removeEventListener('keydown', keyboard);
    window.removeEventListener('blur', blur); document.removeEventListener('visibilitychange', visibility);
    container.style.touchAction = oldTouchAction; container.style.cursor = 'default'; layer.remove();
  } };
}
