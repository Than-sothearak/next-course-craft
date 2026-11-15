"use client";

import { AlignCenter, AlignLeft, AlignRight } from "lucide-react";
import { Button } from "./button";

const options = [{ value: "left", label: "Left", icon: AlignLeft }, { value: "center", label: "Center", icon: AlignCenter }, { value: "right", label: "Right", icon: AlignRight }] as const;

export function TextAlignmentControl({ label, value, onChange }: { label: string; value: "left" | "center" | "right"; onChange: (value: "left" | "center" | "right") => void }) {
  return <div role="group" aria-label={label} className="grid grid-cols-3 gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1">
    {options.map((option) => <Button key={option.value} variant="ghost" size="sm" aria-label={`${label}: ${option.label}`} aria-pressed={value === option.value} onClick={() => onChange(option.value)} className="min-w-0 gap-1 px-1 text-xs aria-pressed:bg-white aria-pressed:text-indigo-700 aria-pressed:shadow-sm"><option.icon size={14} aria-hidden="true" /><span>{option.label}</span></Button>)}
  </div>;
}
