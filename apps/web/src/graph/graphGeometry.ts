export type Point = { x: number; y: number };
export type Disk = Point & { id: string; radius: number; fixed?: boolean };
export type Box = Point & { width: number; height: number };
export const depthForCircle = (circle: string) => ({ INNER: 1, MIDDLE: 2, OUTER: 3 }[circle] ?? 3);
export function intersects(a: Box, b: Box) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}
export function boxHitsDisk(box: Box, disk: Disk) {
  const x = Math.max(box.x, Math.min(disk.x, box.x + box.width));
  const y = Math.max(box.y, Math.min(disk.y, box.y + box.height));
  return Math.hypot(x - disk.x, y - disk.y) < disk.radius + 3;
}
// Operates in viewport pixels: disk radius and spacing track zoom and node size.
export function separateDisks(source: Disk[], iterations = 12): Disk[] {
  const nodes = source.map(node => ({ ...node }));
  for (let pass = 0; pass < iterations; pass++) {
    let changed = false;
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      if (a.fixed && b.fixed) continue;
      let dx = b.x - a.x, dy = b.y - a.y;
      let length = Math.hypot(dx, dy);
      const needed = a.radius + b.radius + 9;
      if (length >= needed) continue;
      if (length < 0.001) {
        const angle = (i * 31 + j * 17) * 2.3999632297;
        dx = Math.cos(angle); dy = Math.sin(angle); length = 1;
      }
      const amount = needed - length;
      const share = a.fixed || b.fixed ? 1 : 0.5;
      if (!a.fixed) { a.x -= dx / length * amount * share; a.y -= dy / length * amount * share; }
      if (!b.fixed) { b.x += dx / length * amount * share; b.y += dy / length * amount * share; }
      changed = true;
    }
    if (!changed) break;
  }
  return nodes;
}
export function interpolate(from: Point, to: Point, progress: number): Point {
  const t = Math.max(0, Math.min(1, progress));
  const eased = 1 - (1 - t) ** 3;
  return { x: from.x + (to.x - from.x) * eased, y: from.y + (to.y - from.y) * eased };
}
