"use client";

import { type ComponentProps } from "react";
import { NumberInput } from "@/components/ui/number-input";

/** Let authors finish typing before applying a validated number to a slide. */
export function SlideNumberSettingInput({ step = 1, ...props }: Omit<ComponentProps<typeof NumberInput>, "step" | "precision"> & {
  step?: number;
}) {
  const digits = String(step).split(".")[1]?.length ?? 0;
  return <NumberInput {...props} step={1} precision={digits} />;
}
