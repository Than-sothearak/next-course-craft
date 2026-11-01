"use client";

import { useRef, useState, type ComponentProps } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "./button";
import { Input } from "./input";
import { cn } from "@/lib/utils";

type Props = Omit<ComponentProps<typeof Input>, "type" | "value" | "defaultValue" | "onChange" | "onFocus" | "onBlur" | "onKeyDown" | "min" | "max" | "step"> & {
  value: number;
  min: number;
  max: number;
  step?: number;
  precision?: number | "any";
  onDraftChange?: (text: string) => void;
  onValueChange: (value: number) => void;
};

/** Allow incomplete edits while keeping invalid numbers out of saved content. */
export function NumberInput({ value, min, max, step = 1, precision = 2, onValueChange, onDraftChange, className, disabled, readOnly, ...props }: Props) {
  const [draft, setDraft] = useState<{ source: number; text: string } | null>(null);
  const initial = useRef(value);
  const cancelBlur = useRef(false);
  if (draft && draft.source !== value) setDraft(null);
  const round = (next: number) => precision === "any" ? Number(next.toPrecision(15)) : Number(next.toFixed(precision));
  const bound = (next: number) => Math.min(max, Math.max(min, round(next)));
  const text = draft?.source === value ? draft.text : String(value);
  const parsed = text.trim() === "" ? NaN : Number(text);
  const current = Number.isFinite(parsed) ? parsed : value;
  const label = props["aria-label"] ?? props.name ?? "value";
  const changeBy = (direction: number) => {
    if (disabled || readOnly) return;
    const next = bound(current + direction * step);
    setDraft(null);
    onDraftChange?.(String(next));
    if (next !== value) onValueChange(next);
  };
  return <span data-number-input className={cn("relative block h-10 w-full min-w-0 rounded-lg text-sm", className)}><Input {...props} disabled={disabled} readOnly={readOnly} type="text" role="spinbutton" aria-valuemin={min} aria-valuemax={max} aria-valuenow={value} inputMode={precision === 0 && min >= 0 ? "numeric" : "decimal"} autoComplete="off" value={text} className="h-full min-w-0 rounded-[inherit] pr-8 text-[length:inherit]"
    onFocus={() => { initial.current = value; setDraft({ source: value, text: String(value) }); }}
    onChange={(event) => {
      const text = event.target.value;
      if (!/^-?\d*(?:\.\d*)?$/.test(text)) return;
      const next = text.trim() === "" ? NaN : Number(text);
      const valid = Number.isFinite(next) && (precision === "any" || Math.abs(next - round(next)) < 1e-8) && next >= min && next <= max;
      setDraft({ source: valid ? next : value, text });
      onDraftChange?.(text);
      if (valid && next !== value) onValueChange(next);
    }}
    onBlur={(event) => {
      if (cancelBlur.current) cancelBlur.current = false;
      else if (event.currentTarget.value !== "" && Number.isFinite(Number(event.currentTarget.value))) {
        const next = bound(Number(event.currentTarget.value));
        if (next !== value) onValueChange(next);
        onDraftChange?.(String(next));
      }
      else onDraftChange?.(String(value));
      setDraft(null);
    }}
    onKeyDown={(event) => {
      if (event.key === "ArrowUp" || event.key === "ArrowDown") { event.preventDefault(); event.stopPropagation(); changeBy(event.key === "ArrowUp" ? 1 : -1); }
      if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); }
      if (event.key === "Escape") {
        event.preventDefault(); event.stopPropagation(); cancelBlur.current = true;
        if (initial.current !== value) onValueChange(initial.current);
        onDraftChange?.(String(initial.current));
        setDraft(null); event.currentTarget.blur();
      }
    }}
  /><span className="absolute inset-y-px right-px flex w-7 flex-col overflow-hidden rounded-r-md border-l border-slate-200">
    <Button variant="ghost" size="icon" aria-label={`Increase ${label} by ${step}`} title={`Increase by ${step}`} disabled={disabled || readOnly || current >= max} className="h-1/2 w-full rounded-none focus-visible:ring-inset focus-visible:ring-offset-0" onMouseDown={(event) => event.preventDefault()} onClick={(event) => { event.preventDefault(); changeBy(1); }}><ChevronUp size={12} aria-hidden="true" /></Button>
    <Button variant="ghost" size="icon" aria-label={`Decrease ${label} by ${step}`} title={`Decrease by ${step}`} disabled={disabled || readOnly || current <= min} className="h-1/2 w-full rounded-none border-t border-slate-200 focus-visible:ring-inset focus-visible:ring-offset-0" onMouseDown={(event) => event.preventDefault()} onClick={(event) => { event.preventDefault(); changeBy(-1); }}><ChevronDown size={12} aria-hidden="true" /></Button>
  </span></span>;
}
