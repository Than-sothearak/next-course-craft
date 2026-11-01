import { describe, expect, it } from "vitest";
import { advanceArcherBalloons, archerMovingTargets, createArcherBalloonBodies } from "@/lib/interactive/archer-balloon-motion";
import { firstArcherHit } from "@/lib/interactive/balloon-archer";
import { balloonArcherDataSchema } from "@/lib/schemas/balloon-archer";

const balloons = () => balloonArcherDataSchema.parse({}).balloons;
describe("floating archer balloons", () => {
  it("uses per-round random forces without changing authored anchors", () => {
    const authored = balloons(), original = structuredClone(authored);
    const bodies = createArcherBalloonBodies(authored, 123);
    expect(createArcherBalloonBodies(authored, 123)).toEqual(bodies);
    expect(createArcherBalloonBodies(authored, 456)).not.toEqual(bodies);
    const moved = advanceArcherBalloons(bodies, 0, 0.1);
    expect(moved[0].y).toBeLessThan(bodies[0].y); expect(moved[0].x).not.toBe(bodies[0].x);
    expect(archerMovingTargets(authored, moved)[0]).not.toEqual(authored[0]); expect(authored).toEqual(original);
  });
  it("uses stable fixed substeps at different display frame rates", () => {
    const initial = createArcherBalloonBodies(balloons(), 123);
    const one = advanceArcherBalloons(initial, 0, 1/30);
    const two = advanceArcherBalloons(advanceArcherBalloons(initial, 0, 1/60), 1/60, 1/60);
    one.forEach((body, index) => { expect(body.x).toBeCloseTo(two[index].x, 6); expect(body.y).toBeCloseTo(two[index].y, 6); });
  });
  it("contains long-running motion and separates balloon contacts", () => {
    const authored = balloons().map((balloon) => ({ ...balloon, x: 50, y: 30 }));
    let bodies = createArcherBalloonBodies(authored, 25);
    for (let index = 0; index < 1200; index++) bodies = advanceArcherBalloons(bodies, index/60, 1/60);
    for (const body of bodies) {
      expect(body.x).toBeGreaterThanOrEqual(64); expect(body.x).toBeLessThanOrEqual(736);
      expect(body.y).toBeGreaterThanOrEqual(72); expect(body.y).toBeLessThanOrEqual(384);
      expect(Number.isFinite(body.vx) && Number.isFinite(body.vy)).toBe(true);
    }
    expect(Math.hypot(bodies[0].x - bodies[1].x, bodies[0].y - bodies[1].y)).toBeGreaterThan(50);
  });
  it("freezes popped balloons while other balloons keep moving", () => {
    const initial = createArcherBalloonBodies(balloons(), 123);
    const next = advanceArcherBalloons(initial, 0, 0.1, new Set([initial[0].id]));
    expect(next[0]).toEqual(initial[0]); expect(next[1]).not.toEqual(initial[1]);
  });
  it("detects a moving balloon crossing an arrow even when its final position misses", () => {
    const base = balloons()[0], before = [{ ...base, x: 60, y: 200/6 }], after = [{ ...base, x: 40, y: 200/6 }];
    const arrow = { x: 400, y: 200 };
    expect(firstArcherHit(arrow, arrow, after)).toBeNull();
    expect(firstArcherHit(arrow, arrow, after, before)?.id).toBe(base.id);
  });
});
