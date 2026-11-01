import { z } from "zod";

export const slideAnimationEffects = ["fade", "zoom", "slide-up", "slide-down", "slide-left", "slide-right", "none"] as const;
export const slideAnimationSchema = z.object({
  effect: z.enum(slideAnimationEffects).default("slide-up"),
  duration: z.number().int().min(100).max(2000).default(1000),
  delay: z.number().int().min(0).max(3000).default(0),
});
export type SlideAnimation = z.infer<typeof slideAnimationSchema>;
export const slideAnimationOptions: { value: SlideAnimation["effect"]; label: string }[] = [
  { value: "fade", label: "Fade in" }, { value: "zoom", label: "Zoom in" },
  { value: "slide-up", label: "Slide up" }, { value: "slide-down", label: "Slide down" },
  { value: "slide-left", label: "Slide left" }, { value: "slide-right", label: "Slide right" },
  { value: "none", label: "None" },
];
export const defaultSlideAnimation = slideAnimationSchema.parse({});
export const slideObjectAnimationReplayEvent = "coursecraft:replay-object-animation";

/** Use one target per visible item; nested lists and nested object frames stay together. */
export function slideAnimationItems(element: HTMLElement): Element[] {
  const candidates = Array.from(element.querySelectorAll("li, [data-slide-animation-item]"))
    .filter((item) => item.closest("[data-slide-object-animation]") === element && !item.closest('[hidden], [aria-hidden="true"]'));
  const selected = new Set(candidates);
  return candidates.filter((item) => {
    for (let parent = item.parentElement; parent && parent !== element; parent = parent.parentElement) if (selected.has(parent)) return false;
    return true;
  });
}

export function slideAnimationStagger(count: number): number {
  return count > 1 ? Math.min(120, 900 / (count - 1)) : 0;
}

export function slideAnimationKeyframes(effect: SlideAnimation["effect"]): Keyframe[] {
  if (effect === "none") return [];
  const transforms = {
    fade: undefined,
    zoom: "scale(0.96)",
    "slide-up": "translateY(24px)",
    "slide-down": "translateY(-24px)",
    "slide-left": "translateX(24px)",
    "slide-right": "translateX(-24px)",
  };
  const transform = transforms[effect];
  return transform ? [{ opacity: 0, transform }, { opacity: 1, transform: "none" }] : [{ opacity: 0 }, { opacity: 1 }];
}

export function replaySlideObjectAnimations(scope: ParentNode, blockId?: string) {
  scope.querySelectorAll<HTMLElement>("[data-slide-object-animation]").forEach((element) => {
    if (blockId === undefined || element.dataset.slideObjectId === blockId) element.dispatchEvent(new Event(slideObjectAnimationReplayEvent));
  });
}
