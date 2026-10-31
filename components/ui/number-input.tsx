"use client";

import { useRef, useState, type ComponentProps } from "react";
import { Input } from "./input";

type Props = Omit<ComponentProps<typeof Input>, "type" | "value" | "defaultValue" | "onChange" | "onFocus" | "onBlur" | "onKeyDown" | "min" | "max" | "step"> & {
  value: number;
  min: number;
  max: number;
  step?: number;
  onValueChange: (value: number) => void;
};

/** Allow incomplete edits while keeping invalid numbers out of saved content. */
export function NumberInput({ value, min, max, step = 0.01, onValueChange, ...props }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const initial = useRef(value);
  const cancelBlur = useRef(false);
  return <Input {...props} type="number" inputMode="decimal" min={min} max={max} step={step} value={draft ?? String(value)}
    onFocus={() => { initial.current = value; setDraft(String(value)); }}
    onChange={(event) => {
      const text = event.target.value, next = event.target.valueAsNumber;
      setDraft(text);
      if (Number.isFinite(next) && next >= min && next <= max && next !== value) onValueChange(next);
    }}
    onBlur={(event) => {
      if (cancelBlur.current) cancelBlur.current = false;
      else if (event.currentTarget.value !== "" && Number.isFinite(event.currentTarget.valueAsNumber)) {
        const next = Math.min(max, Math.max(min, event.currentTarget.valueAsNumber));
        if (next !== value) onValueChange(next);
      }
      setDraft(null);
    }}
    onKeyDown={(event) => {
      if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); }
      if (event.key === "Escape") {
        event.preventDefault(); event.stopPropagation(); cancelBlur.current = true;
        if (initial.current !== value) onValueChange(initial.current);
        setDraft(null); event.currentTarget.blur();
      }
    }}
  />;
}
