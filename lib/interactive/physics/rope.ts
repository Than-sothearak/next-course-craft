import { stepSpring, type FrameClock } from "./engine";
import type { HangingRopeSettings, RopeCardSettings } from "@/lib/schemas/hanging-rope-cards";

export const ropeScene = { width: 280, height: 440, cardWidth: 176, cardHeight: 150, anchor: { x: 140, y: 22 } } as const;
export type RopePoint = { x: number; y: number };
export type RopeBody = RopePoint & { vx: number; vy: number };
export function ropeRest(settings: HangingRopeSettings): RopePoint { return { x: 140, y: 22 + settings.ropeLength + 75 }; }
export function ropeTarget(card: RopeCardSettings): RopePoint { return { x: card.targetX * 2.8, y: card.targetY * 4.4 }; }
export function ropeTargetHit(point: RopePoint, target: RopePoint, radius: number) { return Math.hypot(point.x - target.x, point.y - target.y) <= radius; }
/** Constraints keep the entire card in its cell and every authored target reachable. */
export function constrainRopePoint(point: RopePoint, settings: HangingRopeSettings, target: RopePoint): RopePoint {
  const x = Math.max(90, Math.min(190, point.x)), y = Math.max(112, Math.min(354, point.y));
  const dx = x - 140, dy = y - 75 - 22;
  const reach = Math.max(settings.ropeLength + settings.maxStretch, Math.hypot(target.x - 140, target.y - 97) + 12);
  const scale = Math.min(1, reach / Math.max(1, Math.hypot(dx, dy)));
  return { x: 140 + dx * scale, y: 97 + dy * scale };
}
/** Tension-only elastic rope, gravity, drag and a light horizontal restoring force. */
export function stepRopeBody(body: RopeBody, settings: HangingRopeSettings, target: RopePoint, seconds: number): RopeBody {
  let { x, y, vx, vy } = body, remaining = Math.min(.064, Math.max(0, seconds));
  while (remaining > 0) {
    const dt = Math.min(remaining, 1 / 240), dx = x - 140, dy = y - 97, length = Math.max(1, Math.hypot(dx, dy));
    const gravity = 360, extension = Math.max(0, length - (settings.ropeLength - gravity / settings.springStiffness));
    const tension = extension * settings.springStiffness;
    vx += (-tension * dx / length - dx * 2 - vx * settings.damping * .23) * dt;
    vy += (gravity - tension * dy / length - vy * settings.damping * .36) * dt;
    x += vx * dt; y += vy * dt;
    const bounded = constrainRopePoint({ x, y }, settings, target);
    if (bounded.x !== x) vx *= -.25; if (bounded.y !== y) vy *= -.25;
    x = bounded.x; y = bounded.y; remaining -= dt;
  }
  return { x, y, vx, vy };
}
export function ropePath(body: RopeBody, settings: HangingRopeSettings) {
  const end = { x: body.x, y: body.y - 75 };
  const distance = Math.hypot(end.x - 140, end.y - 22), slack = Math.max(0, settings.ropeLength - distance);
  const sway = Math.max(-20, Math.min(20, -body.vx * .035));
  return `M140 22 C${140 + sway} ${22 + distance * .34} ${end.x + sway + slack * .35} ${end.y - distance * .25} ${end.x} ${end.y}`;
}

/** Vector motion reuses the shared spring integrator/clock; content reveal uses PhysicsInteraction. */
export class RopeMotion {
  body: RopeBody;
  private frame: number | null = null;
  private time: number | null = null;
  private dragging = false;
  private disposed = false;
  private pinned = false;
  private destination: RopePoint;
  constructor(private settings: HangingRopeSettings, readonly target: RopePoint, private clock: FrameClock, private paint: (body: RopeBody) => void, private reducedMotion = false) {
    this.body = { ...ropeRest(settings), vx: 0, vy: 0 }; this.destination = { ...this.body };
  }
  private stop() { if (this.frame !== null) this.clock.cancel(this.frame); this.frame = null; this.time = null; }
  begin() { if (this.disposed || this.pinned) return false; this.dragging = true; this.destination = { ...this.body }; this.schedule(); return true; }
  drag(point: RopePoint) {
    if (!this.dragging || this.disposed) return;
    const rest = ropeRest(this.settings);
    // Resistance increases with extension but does not prevent reaching the target.
    const extension = Math.max(0, point.y - rest.y), resistance = this.settings.dragResistance * extension / 800;
    this.destination = constrainRopePoint({ x: point.x, y: point.y - extension * resistance }, this.settings, this.target);
    if (this.reducedMotion) { this.body = { ...this.destination, vx: 0, vy: 0 }; this.paint(this.body); } else this.schedule();
  }
  release(cancelled = false) {
    if (!this.dragging || this.disposed) return false;
    this.dragging = false;
    const hit = !cancelled && ropeTargetHit(this.destination, this.target, this.settings.targetRadius);
    if (hit) this.dock(); else if (this.reducedMotion) this.reset(); else this.schedule();
    return hit;
  }
  dock() { if (this.disposed) return; this.dragging = false; this.pinned = true; this.destination = this.target; if (this.reducedMotion) { this.body = { ...this.target, vx: 0, vy: 0 }; this.paint(this.body); } else this.schedule(); }
  reset(completed = false) { this.stop(); this.dragging = false; this.pinned = completed; this.body = { ...(completed ? this.target : ropeRest(this.settings)), vx: 0, vy: 0 }; this.destination = { ...this.body }; this.paint(this.body); }
  interrupt(completed = false) { this.reset(completed); }
  private schedule() { if (!this.reducedMotion && this.frame === null && !this.disposed) this.frame = this.clock.request(this.tick); }
  private tick = (time: number) => {
    this.frame = null; if (this.disposed) return;
    const dt = this.time === null ? 1 / 60 : Math.min(.064, Math.max(0, (time - this.time) / 1000)); this.time = time;
    if (this.dragging || this.pinned) {
      const x = stepSpring(this.body.x, this.body.vx, this.destination.x, dt, this.dragging ? 600 : this.settings.springStiffness, this.dragging ? 40 : this.settings.damping);
      const y = stepSpring(this.body.y, this.body.vy, this.destination.y, dt, this.dragging ? 600 : this.settings.springStiffness, this.dragging ? 40 : this.settings.damping);
      this.body = { x: x.position, y: y.position, vx: x.velocity, vy: y.velocity };
    } else this.body = stepRopeBody(this.body, this.settings, this.target, dt);
    this.paint(this.body);
    const target = this.dragging || this.pinned ? this.destination : ropeRest(this.settings);
    const settled = Math.hypot(this.body.x - target.x, this.body.y - target.y) < .08 && Math.hypot(this.body.vx, this.body.vy) < .3;
    if (settled) { this.body = { ...target, vx: 0, vy: 0 }; this.paint(this.body); this.time = null; }
    else this.schedule();
  };
  dispose() { this.disposed = true; this.stop(); }
}
