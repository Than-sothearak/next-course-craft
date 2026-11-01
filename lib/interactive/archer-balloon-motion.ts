import type { ArcherBalloon } from "@/lib/schemas/balloon-archer";
import { balloonCenter, clamp } from "./balloon-archer";

export type ArcherBalloonBody = {
  id: string; x: number; y: number; vx: number; vy: number;
  anchorX: number; anchorY: number; mass: number; phase: number;
};

/** A per-round seed keeps animation random without changing authored positions. */
export function createArcherBalloonBodies(balloons: readonly ArcherBalloon[], seed: number): ArcherBalloonBody[] {
  let state = seed >>> 0;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  return balloons.map((balloon) => {
    const point = balloonCenter(balloon);
    return { id: balloon.id, ...point, anchorX: point.x, anchorY: point.y, vx: (random() - 0.5) * 26, vy: -4 - random() * 6, mass: 0.8 + random() * 0.4, phase: random() * Math.PI * 2 };
  });
}

function contain(body: ArcherBalloonBody) {
  const x = clamp(body.x, 64, 736), y = clamp(body.y, 72, 384);
  if (x !== body.x) body.vx = x === 64 ? Math.abs(body.vx) * 0.65 : -Math.abs(body.vx) * 0.65;
  if (y !== body.y) body.vy = y === 72 ? Math.abs(body.vy) * 0.65 : -Math.abs(body.vy) * 0.65;
  body.x = x; body.y = y;
}

/** Wind, buoyancy, tether tension, drag, and elastic contacts use bounded fixed substeps. */
export function advanceArcherBalloons(bodies: readonly ArcherBalloonBody[], time: number, seconds: number, popped: ReadonlySet<string> = new Set()): ArcherBalloonBody[] {
  const next = bodies.map((body) => ({ ...body }));
  const duration = clamp(seconds, 0, 0.1);
  const steps = Math.max(1, Math.ceil(duration / (1 / 120))), dt = duration / steps;
  for (let step = 0; step < steps; step++) {
    const t = time + (step + 1) * dt;
    for (const body of next) {
      if (popped.has(body.id)) continue;
      const wind = 18 * Math.sin(t * 0.8 + body.phase) + 9 * Math.cos(t * 1.7 + body.phase) + 10 * Math.sin(t * 0.3);
      body.vx += (wind - (body.x - body.anchorX) * 0.16 - body.vx * 0.45) / body.mass * dt;
      body.vy += (-7 + 6 * Math.sin(t * 1.1 + body.phase) - (body.y - body.anchorY) * 0.22 - body.vy * 0.6) / body.mass * dt;
      body.x += body.vx * dt; body.y += body.vy * dt;
      contain(body);
    }
    for (let index = 0; index < next.length; index++) for (let other = index + 1; other < next.length; other++) {
      const a = next[index], b = next[other];
      if (popped.has(a.id) || popped.has(b.id)) continue;
      const dx = b.x - a.x, dy = b.y - a.y, distance = Math.hypot(dx / 96, dy / 120);
      if (distance >= 1) continue;
      const gradientX = dx / (96 * 96), gradientY = dy / (120 * 120), length = Math.hypot(gradientX, gradientY);
      const nx = length > 0 ? gradientX / length : 1, ny = length > 0 ? gradientY / length : 0;
      const inverseA = 1 / a.mass, inverseB = 1 / b.mass, total = inverseA + inverseB;
      const penetration = (1 - distance) * 96;
      a.x -= nx * penetration * inverseA / total; a.y -= ny * penetration * inverseA / total;
      b.x += nx * penetration * inverseB / total; b.y += ny * penetration * inverseB / total;
      const closingSpeed = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (closingSpeed < 0) {
        const impulse = -1.65 * closingSpeed / total;
        a.vx -= impulse * nx * inverseA; a.vy -= impulse * ny * inverseA;
        b.vx += impulse * nx * inverseB; b.vy += impulse * ny * inverseB;
      }
      contain(a); contain(b);
    }
  }
  return next;
}

export function archerMovingTargets(balloons: readonly ArcherBalloon[], bodies: readonly ArcherBalloonBody[]): ArcherBalloon[] {
  const byId = new Map(bodies.map((body) => [body.id, body]));
  return balloons.map((balloon) => {
    const body = byId.get(balloon.id);
    return body ? { ...balloon, x: body.x / 8, y: body.y / 6 } : balloon;
  });
}
