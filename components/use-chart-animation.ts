"use client";

import { useLayoutEffect, type RefObject } from "react";
import { useSlidePlaybackActive } from "@/app/courses/[courseId]/_components/slide-presentation/slide-playback-context";
import { defaultSlideAnimation, slideAnimationStagger, slideObjectAnimationReplayEvent, type SlideAnimation } from "@/lib/editor/slide-animation";

type Options = {
  contentKey: string;
  fieldCount: number;
  presentation: boolean;
  authoring: boolean;
  decorative: boolean;
  animation?: SlideAnimation;
};

/** Animate chart marks independently of their parent object's entrance transform. */
export function useChartAnimation(ref: RefObject<HTMLElement | null>, { contentKey, fieldCount, presentation, authoring, decorative, animation }: Options) {
  const active = useSlidePlaybackActive();
  const { effect, duration, delay } = animation ?? defaultSlideAnimation;
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || decorative || (presentation && effect === "none")) return;
    const preference = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const frame = element.closest("[data-slide-object-animation]");
    const marks = [...element.querySelectorAll<HTMLElement | SVGElement>("[data-chart-motion]")];
    let animations: Animation[] = [];
    let observer: IntersectionObserver | undefined;
    let played = false;
    const autoPlay = !authoring && (!presentation || active);
    function cancel() {
      element!.removeAttribute("data-chart-reveal");
      animations.forEach((item) => item.cancel());
      animations = [];
    }
    function play() {
      cancel();
      if (preference?.matches) return;
      played = true;
      observer?.disconnect();
      const stagger = slideAnimationStagger(fieldCount);
      for (const mark of marks) {
        if (typeof mark.animate !== "function") continue;
        const kind = mark.dataset.chartMotion;
        const index = Number(mark.dataset.chartIndex ?? 0);
        let frames: Keyframe[];
        if (kind === "bar" || kind === "stacked") frames = [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }];
        else if (kind === "column") frames = [{ transform: "scaleY(0)" }, { transform: "scaleY(1)" }];
        else if (kind === "line") frames = [{ strokeDasharray: "0 100" }, { strokeDasharray: "100 100" }];
        else if (kind === "arc") frames = [{ strokeDasharray: "0 100" }, { strokeDasharray: mark.getAttribute("stroke-dasharray") ?? "0 100" }];
        else if (kind === "point") frames = [{ opacity: 0, transform: "scale(0.5)" }, { opacity: 1, transform: "scale(1)" }];
        else frames = [{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "translateY(0)" }];
        // Sweep donut slices continuously around the ring; other charts stagger fields.
        const arcStart = Math.abs(Number(mark.getAttribute("stroke-dashoffset") ?? 0));
        const arcLength = Number(mark.getAttribute("stroke-dasharray")?.split(" ")[0] ?? 0);
        animations.push(mark.animate(frames, {
          duration: kind === "arc" ? duration * arcLength / 100 : duration,
          delay: (presentation ? delay : 0) + (kind === "arc" ? duration * arcStart / 100 : Math.min(900, index * stagger)),
          easing: kind === "arc" ? "linear" : "cubic-bezier(0.22, 1, 0.36, 1)",
          fill: "backwards",
        }));
      }
    }
    function preferenceChanged() {
      if (!preference?.matches) return;
      observer?.disconnect();
      cancel();
    }
    if (autoPlay && !preference?.matches && marks.some((mark) => typeof mark.animate === "function")) {
      if (typeof IntersectionObserver === "undefined") play();
      else {
        element.dataset.chartReveal = "pending";
        observer = new IntersectionObserver((entries) => {
          if (!played && entries.some((entry) => entry.isIntersecting)) play();
        }, { threshold: 0 });
        observer.observe(element);
      }
    }
    frame?.addEventListener(slideObjectAnimationReplayEvent, play);
    preference?.addEventListener?.("change", preferenceChanged);
    return () => {
      observer?.disconnect();
      cancel();
      frame?.removeEventListener(slideObjectAnimationReplayEvent, play);
      preference?.removeEventListener?.("change", preferenceChanged);
    };
  }, [ref, contentKey, fieldCount, presentation, authoring, decorative, active, effect, duration, delay]);
}
