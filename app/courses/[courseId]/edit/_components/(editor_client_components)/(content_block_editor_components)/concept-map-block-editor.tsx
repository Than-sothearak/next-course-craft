"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ConceptMap } from "@/components/concept-map";
import { createClientId } from "@/lib/client-id";
import type { ContentBlock } from "@/lib/schemas/block";

type ConceptMapBlock = Extract<ContentBlock, { type: "conceptMap" }>;

export function ConceptMapBlockEditor({ block, onChange }: {
  block: ConceptMapBlock;
  onChange: (block: ContentBlock) => void;
}) {
  const update = (data: Partial<ConceptMapBlock["data"]>) => onChange({ ...block, data: { ...block.data, ...data } });

  return (
    <div className="space-y-4">
      <label className="block space-y-1.5 text-sm font-medium">Map title
        <Input value={block.data.title} maxLength={160} onChange={(event) => update({ title: event.target.value })} placeholder="Optional title" />
      </label>
      <div className="rounded-lg border border-slate-200 p-3 sm:p-4">
        <h4 className="mb-3 text-sm font-semibold">Central concept</h4>
        <label className="block space-y-1.5 text-sm font-medium">Concept
          <Input value={block.data.centralConcept} maxLength={160} onChange={(event) => update({ centralConcept: event.target.value })} placeholder="The main idea" />
        </label>
        <label className="mt-3 block space-y-1.5 text-sm font-medium">Explanation
          <Textarea value={block.data.centralExplanation} maxLength={1_000} rows={2} onChange={(event) => update({ centralExplanation: event.target.value })} placeholder="Explain the central idea" />
        </label>
      </div>
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold">Connected concepts</h4>
        <Button type="button" variant="outline" size="sm" disabled={block.data.branches.length >= 12} onClick={() => update({ branches: [...block.data.branches, { id: createClientId(), relationship: "relates to", concept: "", explanation: "" }] })}><Plus size={14} /> Add concept</Button>
      </div>
      <div className="space-y-3">
        {block.data.branches.map((branch, index) => (
          <div key={branch.id} className="space-y-2 rounded-lg border border-slate-200 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-500">Connection {index + 1}</span>
              <Button type="button" variant="ghost" size="icon" aria-label={`Remove concept connection ${index + 1}`} disabled={block.data.branches.length <= 2} onClick={() => update({ branches: block.data.branches.filter((item) => item.id !== branch.id) })} className="size-8 text-slate-400 hover:text-rose-600"><Trash2 size={14} /></Button>
            </div>
            <div className="grid min-w-0 gap-2 sm:grid-cols-2">
              <label className="block min-w-0 space-y-1.5 text-sm font-medium">Relationship
                <Input value={branch.relationship} maxLength={80} onChange={(event) => update({ branches: block.data.branches.map((item) => item.id === branch.id ? { ...item, relationship: event.target.value } : item) })} placeholder="includes, causes, depends on" />
              </label>
              <label className="block min-w-0 space-y-1.5 text-sm font-medium">Concept
                <Input value={branch.concept} maxLength={160} onChange={(event) => update({ branches: block.data.branches.map((item) => item.id === branch.id ? { ...item, concept: event.target.value } : item) })} placeholder="Connected idea" />
              </label>
            </div>
            <label className="block space-y-1.5 text-sm font-medium">Explanation
              <Textarea value={branch.explanation} maxLength={1_000} rows={2} onChange={(event) => update({ branches: block.data.branches.map((item) => item.id === branch.id ? { ...item, explanation: event.target.value } : item) })} placeholder="Describe how the concepts are connected" />
            </label>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <h4 className="text-sm font-semibold">Learner preview</h4>
        <div className="rounded-lg border border-slate-200 p-3 sm:p-4"><ConceptMap data={block.data} /></div>
      </div>
    </div>
  );
}
