"use client";

import { Select } from "@/components/ui/select";
import type { ContentBlock, StatementStyle } from "@/lib/schemas/block";

type StatementBlock = Extract<ContentBlock, { type: "statement" }>;

const statementStyleOptions: { value: StatementStyle; label: string }[] = [
  { value: "key", label: "Key statement" },
  { value: "alert", label: "Alert" },
  { value: "danger", label: "Danger" },
  { value: "info", label: "Info" },
  { value: "success", label: "Success" },
  { value: "tip", label: "Helpful tip" },
  { value: "warning", label: "Warning" },
  { value: "centered", label: "Centered statement" },
];

export function StatementBlockSettings({ block, onChange }: {
  block: StatementBlock;
  onChange: (block: StatementBlock) => void;
}) {
  return <div className="space-y-1.5">
    <label className="block space-y-1 text-xs font-medium text-slate-600">
      <span>Statement style</span>
      <Select aria-label="Statement style" value={block.data.style} onChange={(event) => onChange({ ...block, data: { ...block.data, style: event.target.value as StatementStyle } })}>
        {statementStyleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}{option.value === "key" ? " (default)" : ""}</option>)}
      </Select>
    </label>
    <p className="text-xs leading-5 text-slate-500">Key statement is the default. Use Alert for a notice, Danger for a real risk, Info for context, or Success for a confirmed positive result.</p>
  </div>;
}
