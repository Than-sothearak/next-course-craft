"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";

export function SectionTitleInput({ title, onCommit }: { title: string; onCommit: (title: string) => void }) {
  const [value, setValue] = useState(title);
  return <Input aria-label="Section title" value={value} onChange={(event) => setValue(event.target.value)} onBlur={() => {
    const nextTitle = value.trim();
    if (nextTitle && nextTitle !== title) onCommit(nextTitle);
    else if (!nextTitle) setValue(title);
  }} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} className="h-8 min-w-0 border-transparent bg-transparent px-2 text-xs font-semibold focus-visible:border-slate-300" />;
}
