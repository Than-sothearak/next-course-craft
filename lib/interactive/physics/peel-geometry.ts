import type { PeelSettings } from "@/lib/schemas/peel-to-reveal";
export type Point = { x: number; y: number };
type Bounds = { left: number; top: number; width: number; height: number };
/** Client bounds already include slide zoom and parent transforms. */
export function localInteractionPoint(client: Point, bounds: Bounds): Point { return { x: (client.x - bounds.left) / Math.max(1, bounds.width), y: (client.y - bounds.top) / Math.max(1, bounds.height) }; }
export function orientPoint(p: Point, direction: PeelSettings["direction"]): Point { return { x: direction.endsWith("right") ? 1 - p.x : p.x, y: direction.startsWith("bottom") ? 1 - p.y : p.y }; }
export function peelDragProgress(start: Point, point: Point, direction: PeelSettings["direction"]) { const a = orientPoint(start, direction), b = orientPoint(point, direction); return Math.max(0, ((b.x - a.x) + (b.y - a.y)) / 1.2); }
const path = (points: Point[]) => points.length ? `M${points.map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`).join(" L")} Z` : "M0,0 Z";
function clip(points: Point[], cut: number, normal: Point, keep: (distance: number) => boolean): Point[] {
  const result: Point[] = [];
  for (let i = 0; i < points.length; i++) { const a = points[i], b = points[(i + 1) % points.length], da = a.x * normal.x + a.y * normal.y - cut, db = b.x * normal.x + b.y * normal.y - cut; if (keep(da)) result.push(a); if (keep(da) !== keep(db)) { const t = da / (da - db); result.push({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) }); } }
  return result;
}
/** Analytic diagonal crease and a curved reflected paper flap; geometry changes every frame. */
export function peelGeometry(progress: number, width = 680, height = 360, steer = 0) {
  const p = Math.max(0, Math.min(1, progress));
  const tilt = Math.max(-1, Math.min(1, steer));
  const normal = { x: 1 + tilt * .4, y: 1 - tilt * .4 };
  const dot = (v: Point) => v.x * normal.x + v.y * normal.y;
  const cut = (0.065 + p * 2.13) * (width * normal.x + height * normal.y) / 2;
  const rect = [{ x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: height }, { x: 0, y: height }];
  if (p >= 0.999) return { front: "M0,0 Z", flap: "M0,0 Z", crease: "M0,0", shadow: "M0,0 Z", curl: 0 };
  const front = clip(rect, cut, normal, (d) => d >= 0), peeled = clip(rect, cut, normal, (d) => d <= 0);
  const ends = front.filter((v) => Math.abs(dot(v) - cut) < 0.01);
  if (ends.length < 2) return { front: path(front), flap: "M0,0 Z", crease: "M0,0", shadow: "M0,0 Z", curl: 0 };
  const a = ends[0], b = ends[ends.length - 1];
  const curl = (8 + Math.sin(Math.PI * p) * 42) * (1 + steer * 0.15);
  // Compress the reflected sheet as it rolls; lift gives curved, non-rigid edges.
  const folded = peeled.filter((v) => Math.abs(dot(v) - cut) > .01).map((v) => { const u = cut - dot(v); const bend = u * (1.76 - p * 0.7) / (normal.x ** 2 + normal.y ** 2); return { x: v.x + normal.x * bend + Math.sin(u / Math.max(1, cut) * Math.PI) * curl, y: v.y + normal.y * bend }; });
  const flap = folded.length ? `M${a.x},${a.y} Q${(a.x + b.x) / 2 + curl},${(a.y + b.y) / 2 + curl} ${b.x},${b.y} ` + folded.reverse().map((v) => `Q${v.x + curl * 0.35},${v.y - curl * 0.2} ${v.x},${v.y}`).join(" ") + " Z" : "M0,0 Z";
  return { front: path(front), flap, crease: `M${a.x},${a.y} Q${(a.x + b.x) / 2 + curl * 0.2},${(a.y + b.y) / 2 + curl * 0.2} ${b.x},${b.y}`, shadow: flap, curl };
}
