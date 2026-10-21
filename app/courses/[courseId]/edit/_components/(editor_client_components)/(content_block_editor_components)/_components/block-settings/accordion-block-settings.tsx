"use client";

import { Plus, Trash2 } from "lucide-react";
import type { ContentBlock } from "@/lib/schemas/block";
import { createClientId } from "@/lib/client-id";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export function AccordionBlockSettings({ block, onChange }: { block: Extract<ContentBlock, { type: "accordion" }>; onChange: (block: ContentBlock) => void }) {
  return (
    <div className="space-y-3">
      <Select
        aria-label="Reveal layout"
        value={block.data.layout}
        onChange={(event) => onChange({
          ...block,
          data: { ...block.data, layout: event.target.value as "accordion" | "tabs" },
        })}
      >
        <option value="accordion">Accordion</option>
        <option value="tabs">Tabs</option>
      </Select>
      {block.data.layout === "accordion" && (
        <Select
          aria-label="Explanation display"
          value={block.data.displayMode}
          onChange={(event) => onChange({
            ...block,
            data: {
              ...block.data,
              displayMode: event.target.value as "all" | "oneByOne",
            },
          })}
        >
          <option value="all">Show all (keep others open)</option>
          <option value="oneByOne">Show one by one</option>
        </Select>
      )}
      {block.data.items.map((item, index) => (
        <div key={item.id} className="space-y-2 rounded-lg border border-slate-200 p-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-500">Section {index + 1}</span>
            {block.data.items.length > 2 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Delete reveal section ${index + 1}`}
                onClick={() => onChange({
                  ...block,
                  data: { ...block.data, items: block.data.items.filter((entry) => entry.id !== item.id) },
                })}
                className="size-8 text-slate-400 hover:text-rose-600"
              >
                <Trash2 size={14} />
              </Button>
            )}
          </div>
          <Input
            aria-label={`Reveal section ${index + 1} title`}
            value={item.title}
            maxLength={160}
            onChange={(event) => onChange({
              ...block,
              data: { ...block.data, items: block.data.items.map((entry) => entry.id === item.id ? { ...entry, title: event.target.value } : entry) },
            })}
            placeholder="Section title"
            className="h-9"
          />
          <Textarea
            aria-label={`Reveal section ${index + 1} explanation`}
            value={item.body}
            maxLength={5000}
            onChange={(event) => onChange({
              ...block,
              data: { ...block.data, items: block.data.items.map((entry) => entry.id === item.id ? { ...entry, body: event.target.value } : entry) },
            })}
            placeholder="Explanation"
            className="min-h-16 resize-y"
          />
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={block.data.items.length >= 12}
        onClick={() => onChange({
          ...block,
          data: { ...block.data, items: [...block.data.items, { id: createClientId(), title: "New section", body: "" }] },
        })}
        className="w-full justify-center"
      >
        <Plus size={14} /> Add section
      </Button>
    </div>
  );
}
