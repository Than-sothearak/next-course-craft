"use client";

import { useRef, type ComponentProps } from "react";
import type { SlideAnimation } from "@/lib/editor/slide-animation";
import { useSlideObjectAnimation } from "./use-slide-object-animation";

export function SlideAnimatedObjectFrame({ animation, authoring = false, ...props }: ComponentProps<"div"> & { animation?: SlideAnimation; authoring?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const effect = useSlideObjectAnimation(ref, animation, !authoring);
  return <div {...props} ref={ref} data-slide-object-animation={effect} />;
}
