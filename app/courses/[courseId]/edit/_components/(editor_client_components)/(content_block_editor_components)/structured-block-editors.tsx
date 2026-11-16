"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ContentBlock } from "@/lib/schemas/block";
import { EducationalFormula } from "@/components/educational-formula";

export function FormulaBlockEditor({ block, onChange }: {
  block: Extract<ContentBlock, { type: "formula" }>;
  onChange: (block: ContentBlock) => void;
}) {
  const update = (data: Partial<typeof block.data>) => onChange({ ...block, data: { ...block.data, ...data } });
  return <div className="space-y-4">
    <label className="block space-y-1.5 text-sm font-medium">Formula title <Input value={block.data.title} maxLength={160} onChange={(event) => update({ title: event.target.value })} placeholder="Optional title" /></label>
    <label className="block space-y-1.5 text-sm font-medium">LaTeX formula <Textarea value={block.data.latex} rows={3} maxLength={5000} onChange={(event) => update({ latex: event.target.value })} aria-label="LaTeX formula" className="font-mono text-sm" /></label>
    <div className="space-y-1.5 text-sm font-medium">Preview <div className="rounded-lg border border-slate-200 p-3"><EducationalFormula data={block.data} /></div></div>
    <label className="block space-y-1.5 text-sm font-medium">Explanation <Textarea value={block.data.explanation} rows={3} maxLength={5000} onChange={(event) => update({ explanation: event.target.value })} placeholder="Explain what the formula describes." /></label>
    <div className="space-y-2">
      <div className="flex items-center justify-between"><h4 className="text-sm font-medium">Variables</h4><Button type="button" variant="outline" size="sm" onClick={() => update({ variables: [...block.data.variables, { symbol: "", explanation: "" }] })}><Plus size={14} /> Add variable</Button></div>
      {block.data.variables.map((variable, index) => <div key={index} className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,2fr)_auto]">
        <Input aria-label={`Variable ${index + 1} symbol`} value={variable.symbol} maxLength={80} placeholder="Symbol" onChange={(event) => update({ variables: block.data.variables.map((item, itemIndex) => itemIndex === index ? { ...item, symbol: event.target.value } : item) })} />
        <Input aria-label={`Variable ${index + 1} explanation`} value={variable.explanation} maxLength={500} placeholder="What it means" onChange={(event) => update({ variables: block.data.variables.map((item, itemIndex) => itemIndex === index ? { ...item, explanation: event.target.value } : item) })} />
        <Button type="button" variant="ghost" size="icon" aria-label={`Remove variable ${index + 1}`} onClick={() => update({ variables: block.data.variables.filter((_, itemIndex) => itemIndex !== index) })}><Trash2 size={15} /></Button>
      </div>)}
    </div>
  </div>;
}

export function TableBlockEditor({ block, onChange }: {
  block: Extract<ContentBlock, { type: "table" }>;
  onChange: (block: ContentBlock) => void;
}) {
  const update = (data: Partial<typeof block.data>) => onChange({ ...block, data: { ...block.data, ...data } });
  const addColumn = () => update({ columns: [...block.data.columns, `Column ${block.data.columns.length + 1}`], rows: block.data.rows.map((row) => [...row, ""]) });
  const removeColumn = (index: number) => {
    if (block.data.columns.length <= 1) return;
    update({ columns: block.data.columns.filter((_, columnIndex) => columnIndex !== index), rows: block.data.rows.map((row) => row.filter((_, columnIndex) => columnIndex !== index)) });
  };
  return <div className="space-y-3">
    <label className="block space-y-1.5 text-sm font-medium">Table caption <Input value={block.data.caption} maxLength={500} onChange={(event) => update({ caption: event.target.value })} placeholder="Optional caption" /></label>
    <div className="space-y-3">
      {block.data.rows.map((row, rowIndex) => <div key={rowIndex} className="grid gap-2 rounded-lg border border-slate-200 p-3">
        {row.map((cell, columnIndex) => <label key={columnIndex} className="grid min-w-0 gap-1 text-xs font-medium text-slate-600 sm:grid-cols-[minmax(7rem,0.8fr)_minmax(0,2fr)] sm:items-center">
          <span className="flex items-center justify-between gap-2">{rowIndex === 0 ? <Input aria-label={`Column ${columnIndex + 1} heading`} value={block.data.columns[columnIndex]} maxLength={120} onChange={(event) => update({ columns: block.data.columns.map((column, index) => index === columnIndex ? event.target.value : column) })} /> : block.data.columns[columnIndex]}
            {rowIndex === 0 && block.data.columns.length > 1 && <Button type="button" variant="ghost" size="icon" aria-label={`Remove column ${columnIndex + 1}`} onClick={() => removeColumn(columnIndex)}><Trash2 size={14} /></Button>}
          </span>
          <Input aria-label={`Row ${rowIndex + 1}, ${block.data.columns[columnIndex]}`} value={cell} maxLength={2000} onChange={(event) => update({ rows: block.data.rows.map((currentRow, index) => index === rowIndex ? currentRow.map((currentCell, cellIndex) => cellIndex === columnIndex ? event.target.value : currentCell) : currentRow) })} placeholder="Cell content" />
        </label>)}
        {block.data.rows.length > 1 && <Button type="button" variant="ghost" size="sm" className="justify-start text-rose-700" onClick={() => update({ rows: block.data.rows.filter((_, index) => index !== rowIndex) })}><Trash2 size={14} /> Remove row</Button>}
      </div>)}
    </div>
    <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" size="sm" onClick={addColumn} disabled={block.data.columns.length >= 8}><Plus size={14} /> Add column</Button><Button type="button" variant="outline" size="sm" onClick={() => update({ rows: [...block.data.rows, block.data.columns.map(() => "")] })} disabled={block.data.rows.length >= 100}><Plus size={14} /> Add row</Button></div>
  </div>;
}

export function ChecklistBlockEditor({ block, onChange }: {
  block: Extract<ContentBlock, { type: "checklist" }>;
  onChange: (block: ContentBlock) => void;
}) {
  return <div className="space-y-3">
    <label className="block space-y-1.5 text-sm font-medium">Checklist title <Input value={block.data.title} maxLength={500} onChange={(event) => onChange({ ...block, data: { ...block.data, title: event.target.value } })} placeholder="Optional title" /></label>
    <label className="block space-y-1.5 text-sm font-medium">Items <Textarea value={block.data.items.join("\n")} rows={Math.min(8, Math.max(3, block.data.items.length))} maxLength={30_030} onChange={(event) => onChange({ ...block, data: { ...block.data, items: event.target.value.split(/\r?\n/).slice(0, 30) } })} placeholder="Add one item per line" /></label>
    <p className="text-xs leading-5 text-slate-500">These items are for reading and review. Learners do not check them off.</p>
  </div>;
}
