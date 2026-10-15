"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";

export function SectionTitleInput({ title, onCommit, className = "" }: { title: string; onCommit: (title: string) => void; className?: string }) {
  const [value, setValue] = useState(title);
  return <Input aria-label="Section title" value={value} onChange={(event) => setValue(event.target.value)} onBlur={() => {
    const nextTitle = value.trim();
    if (nextTitle && nextTitle !== title) onCommit(nextTitle);
    else if (!nextTitle) setValue(title);
  }} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} className={`h-10 min-w-0 rounded-none border-0 bg-transparent px-2 text-xs font-semibold uppercase tracking-wide shadow-none focus-visible:border-0 focus-visible:ring-0 ${className}`} />;
}
