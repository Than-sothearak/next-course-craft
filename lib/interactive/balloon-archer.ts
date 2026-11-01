import type { ArcherBalloon } from "@/lib/schemas/balloon-archer";

export type ArcherPoint = { x: number; y: number };
export type ArcherShot = ArcherPoint & { vx: number; vy: number };
export const archerWorld = { width: 800, height: 600, bow: { x: 400, y: 490 }, gravity: 300, maxPull: 96, maxAim: 110, shaft: 72 } as const;
export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
export const constrainPull = (point: ArcherPoint): ArcherPoint => ({ x: clamp(point.x, -archerWorld.maxAim, archerWorld.maxAim), y: clamp(point.y, 0, archerWorld.maxPull) });
export const balloonCenter = (balloon: Pick<ArcherBalloon, "x" | "y">): ArcherPoint => ({ x: balloon.x * 8, y: balloon.y * 6 });
export function archerArrow(pull: ArcherPoint) {
  const length = Math.hypot(pull.x, pull.y);
  const direction = length > 0 ? { x: -pull.x / length, y: -pull.y / length } : { x: 0, y: -1 };
  const nock = { x: archerWorld.bow.x + pull.x, y: archerWorld.bow.y + pull.y };
  return { nock, tip: { x: nock.x + direction.x * archerWorld.shaft, y: nock.y + direction.y * archerWorld.shaft }, direction };
}
export function launchArcherArrow(pull: ArcherPoint): ArcherShot | null {
  const bounded = constrainPull(pull);
  if (bounded.y < 12) return null;
  return { ...archerArrow(bounded).tip, vx: -bounded.x * 10, vy: -bounded.y * 10 };
}
export function advanceArcherShot(shot: ArcherShot, seconds: number): ArcherShot {
  return { x: shot.x + shot.vx * seconds, y: shot.y + shot.vy * seconds + archerWorld.gravity * seconds * seconds / 2, vx: shot.vx, vy: shot.vy + archerWorld.gravity * seconds };
}
/** Segment/ellipse intersection prevents fast arrows from skipping a balloon between frames. */
export function firstArcherHit(from: ArcherPoint, to: ArcherPoint, balloons: readonly ArcherBalloon[], previousBalloons: readonly ArcherBalloon[] = balloons) {
  let hit: { balloon: ArcherBalloon; t: number } | null = null;
  for (const balloon of balloons) {
    const center = balloonCenter(balloon);
    const previous = previousBalloons.find((item) => item.id === balloon.id);
    const start = previous ? balloonCenter(previous) : center;
    const x = (from.x - start.x) / 48, y = (from.y - start.y) / 60;
    const dx = (to.x - center.x - (from.x - start.x)) / 48, dy = (to.y - center.y - (from.y - start.y)) / 60;
    const a = dx * dx + dy * dy, b = 2 * (x * dx + y * dy), c = x * x + y * y - 1;
    let t = c <= 0 ? 0 : Infinity;
    if (c > 0 && a > 0) {
      const discriminant = b * b - 4 * a * c;
      if (discriminant >= 0) t = (-b - Math.sqrt(discriminant)) / (2 * a);
    }
    if (t >= 0 && t <= 1 && (!hit || t < hit.t)) hit = { balloon, t };
  }
  return hit?.balloon ?? null;
}
export function archerBalloonPosition(point: ArcherPoint) {
  return { x: Math.round(clamp(point.x / 8, 8, 92) * 100) / 100, y: Math.round(clamp(point.y / 6, 12, 64) * 100) / 100 };
}
/** Exact damped spring response keeps bowstring recoil stable at any frame rate. */
export function archerStringRecoil(pull: ArcherPoint, seconds: number): ArcherPoint {
  const spring = Math.exp(-11 * seconds) * (Math.cos(38 * seconds) + 11 / 38 * Math.sin(38 * seconds));
  return { x: pull.x * spring, y: pull.y * spring };
}
