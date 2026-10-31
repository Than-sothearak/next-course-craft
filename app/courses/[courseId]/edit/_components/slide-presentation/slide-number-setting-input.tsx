"use client";

import { useState, type ComponentProps } from "react";
import { Input } from "@/components/ui/input";

/** Let authors finish typing before applying a validated number to a slide. */
export function SlideNumberSettingInput({ value, min, max, step = 1, onValueChange, ...props }: Omit<ComponentProps<typeof Input>, "type" | "value" | "min" | "max" | "step" | "onChange" | "onBlur" | "onFocus"> & {
  value: number;
  min: number;
  max: number;
  step?: number;
  onValueChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const digits = String(step).split(".")[1]?.length ?? 0;
  const factor = 10 ** digits;
  return <Input {...props} type="text" inputMode={digits > 0 || min < 0 ? "decimal" : "numeric"} autoComplete="off" value={draft ?? value}
    onFocus={() => setDraft(String(value))}
    onChange={(event) => {
      const text = event.target.value;
      if (!new RegExp(digits > 0 ? "^-?\\d*(?:\\.\\d*)?$" : "^-?\\d*$").test(text)) return;
      setDraft(text);
      const next = Number(text);
      if (text !== "" && Number.isFinite(next) && Math.abs(next * factor - Math.round(next * factor)) < 1e-8 && next >= min && next <= max) onValueChange(next);
    }}
    onBlur={(event) => {
      const text = event.target.value;
      const next = Number(text);
      if (text !== "" && Number.isFinite(next)) {
        const completed = Math.min(max, Math.max(min, Math.round(next * factor) / factor));
        if (completed !== value) onValueChange(completed);
      }
      setDraft(null);
    }}
    onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
  />;
}
