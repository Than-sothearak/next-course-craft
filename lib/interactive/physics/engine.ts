/** Browser-independent spring lifecycle, reusable by reveal, drawer and snap interactions. */
export type InteractionPhase = "idle" | "grabbing" | "peeling" | "released" | "revealing" | "revealed";
export type PhysicsOptions = { dragResistance: number; springStiffness: number; damping: number; peelThreshold: number; animationDuration: number; autoComplete: boolean };
export type FrameClock = { request: (callback: (time: number) => void) => number; cancel: (id: number) => void };
const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));
export function resistDrag(progress: number, resistance: number) { const p = clamp(progress, 0, 2); return clamp(p / (1 + resistance * p * 0.65)); }
export function stepSpring(position: number, velocity: number, target: number, seconds: number, stiffness: number, damping: number) {
  let remaining = clamp(seconds, 0, 0.064);
  while (remaining > 0) { const dt = Math.min(remaining, 1 / 240); velocity += ((target - position) * stiffness - velocity * damping) * dt; position += velocity * dt; remaining -= dt; }
  return { position, velocity };
}

export class PhysicsInteraction {
  phase: InteractionPhase = "idle";
  progress = 0;
  private velocity = 0;
  private target = 0;
  private frame: number | null = null;
  private lastTime: number | null = null;
  private dragging = false;
  private disposed = false;
  private completed = false;
  private elapsed = 0;
  constructor(private options: PhysicsOptions, private clock: FrameClock, private paint: (progress: number) => void, private onPhase: (phase: InteractionPhase) => void, private onComplete: () => void, private reducedMotion = false) {}
  private state(phase: InteractionPhase) { if (phase !== this.phase) { this.phase = phase; this.onPhase(phase); } }
  private stop() { if (this.frame !== null) this.clock.cancel(this.frame); this.frame = null; this.lastTime = null; }
  begin() { if (this.disposed || this.phase === "revealed" || this.phase === "revealing") return false; this.stop(); this.dragging = true; this.velocity = 0; this.target = this.progress; this.state("grabbing"); return true; }
  drag(raw: number) { if (!this.dragging || this.disposed) return; this.target = resistDrag(raw, this.options.dragResistance); this.state("peeling"); if (this.reducedMotion) { this.progress = this.target; this.paint(this.progress); } else this.schedule(); }
  release(cancelled = false) {
    if (!this.dragging || this.disposed) return;
    this.dragging = false; this.state("released");
    // Test the pointer target as well as the lagging spring, so fast intentional drags work.
    const complete = !cancelled && (this.options.autoComplete ? this.target >= this.options.peelThreshold : this.target >= 0.98);
    this.settle(complete ? 1 : 0);
  }
  reveal() { if (this.disposed || this.phase === "revealed" || this.phase === "revealing") return; this.dragging = false; this.stop(); this.settle(1); }
  private settle(target: number) { this.target = target; this.elapsed = 0; if (target === 1) this.state("revealing"); if (this.reducedMotion) this.finish(); else this.schedule(); }
  private finish() { this.stop(); this.progress = this.target; this.velocity = 0; this.paint(this.progress); this.state(this.target === 1 ? "revealed" : "idle"); if (this.target === 1 && !this.completed) { this.completed = true; this.onComplete(); } }
  private schedule() { if (this.frame === null && !this.disposed) this.frame = this.clock.request(this.tick); }
  private tick = (time: number) => {
    this.frame = null; if (this.disposed) return;
    const dt = this.lastTime === null ? 1 / 60 : Math.min(0.064, Math.max(0, (time - this.lastTime) / 1000)); this.lastTime = time; this.elapsed += dt;
    const speed = 1000 / this.options.animationDuration;
    const next = stepSpring(this.progress, this.velocity, this.target, dt * (this.dragging ? 1 : speed), this.dragging ? 650 : this.options.springStiffness, this.dragging ? 42 : this.options.damping);
    this.progress = clamp(next.position, -0.025, 1.04); this.velocity = next.velocity; this.paint(clamp(this.progress));
    const settled = Math.abs(this.progress - this.target) < 0.001 && Math.abs(this.velocity) < 0.008;
    if (settled) { if (!this.dragging) this.finish(); else { this.progress = this.target; this.velocity = 0; this.lastTime = null; } }
    else if (!this.dragging && this.elapsed > this.options.animationDuration / 1000 * 8) this.finish();
    else this.schedule();
  };
  /** Exit, resize, visibility change and teardown cancel without awarding completion. */
  interrupt() { this.stop(); this.dragging = false; this.velocity = 0; if (this.phase !== "revealed") { this.progress = this.target = 0; this.paint(0); this.state("idle"); } }
  reset(revealed = false) { this.stop(); this.dragging = false; this.velocity = 0; this.progress = this.target = revealed ? 1 : 0; this.paint(this.progress); this.state(revealed ? "revealed" : "idle"); }
  dispose() { this.disposed = true; this.stop(); }
}
