"use client";

import { useLayoutEffect, type RefObject } from "react";
import { defaultSlideAnimation, slideAnimationItems, slideAnimationKeyframes, slideAnimationStagger, slideObjectAnimationReplayEvent, type SlideAnimation } from "@/lib/editor/slide-animation";
import { useSlidePlaybackActive } from "./slide-playback-context";

/** Animate single objects as a frame and collections one item at a time. */
export function useSlideObjectAnimation(ref: RefObject<HTMLElement | null>, value?: SlideAnimation, autoPlay = true) {
  const { effect, duration, delay } = value ?? defaultSlideAnimation;
  const active = useSlidePlaybackActive();
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const preference = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    let animations: Animation[] = [];
    let awaitingItems = false;
    let observer: MutationObserver | undefined;
    function cancel() { awaitingItems = false; observer?.disconnect(); animations.forEach((animation) => { animation.onfinish = null; animation.cancel(); }); animations = []; }
    function play() {
      cancel();
      if (preference?.matches || effect === "none") return;
      const items = slideAnimationItems(element!);
      const targets = items.length > 1 ? items : [element!];
      const stagger = slideAnimationStagger(targets.length);
      targets.forEach((target, index) => {
        if (typeof target.animate !== "function") return;
        animations.push(target.animate(slideAnimationKeyframes(effect), { duration, delay: delay + index * stagger, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "backwards" }));
      });
      awaitingItems = items.length < 2 && animations.length > 0;
      if (awaitingItems) {
        // Rich-text editors mount their list DOM after the frame's first layout effect.
        observer ??= new MutationObserver(() => { if (awaitingItems && slideAnimationItems(element!).length > 1) play(); });
        observer.observe(element!, { childList: true, subtree: true });
        animations[0].onfinish = () => { awaitingItems = false; observer?.disconnect(); };
      }
    }
    function preferenceChanged() { if (preference?.matches) cancel(); else if (autoPlay && active) play(); }
    if (autoPlay && active) play();
    element.addEventListener(slideObjectAnimationReplayEvent, play);
    element.addEventListener("pointerdown", cancel);
    element.addEventListener("focusin", cancel);
    preference?.addEventListener?.("change", preferenceChanged);
    return () => {
      cancel();
      element.removeEventListener(slideObjectAnimationReplayEvent, play);
      element.removeEventListener("pointerdown", cancel);
      element.removeEventListener("focusin", cancel);
      preference?.removeEventListener?.("change", preferenceChanged);
    };
  }, [ref, effect, duration, delay, active, autoPlay]);
  return effect;
}
