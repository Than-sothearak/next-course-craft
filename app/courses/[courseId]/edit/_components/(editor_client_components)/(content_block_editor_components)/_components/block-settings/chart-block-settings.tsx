"use client";

import { ColorPicker } from "@/components/ui/color-picker";

import { Plus, Trash2 } from "lucide-react";
import type { ContentBlock } from "@/lib/schemas/block";
import { createClientId } from "@/lib/client-id";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";


export function ChartBlockSettings({ block, onChange }: { block: Extract<ContentBlock, { type: "chart" }>; onChange: (block: ContentBlock) => void }) {
  return (
    <div className="space-y-3">
      <Input
        aria-label="Chart title"
        value={block.data.title}
        maxLength={500}
        onChange={(event) => onChange({
          ...block,
          data: { ...block.data, title: event.target.value },
        })}
        placeholder="Chart title"
        className="h-9"
      />
      <Textarea
        aria-label="Chart description"
        value={block.data.description}
        maxLength={2000}
        onChange={(event) => onChange({
          ...block,
          data: { ...block.data, description: event.target.value },
        })}
        placeholder="Description (optional)"
        className="min-h-16 resize-y"
      />
      <Select
        aria-label="Chart type"
        value={block.data.chartType}
        onChange={(event) => onChange({
          ...block,
          data: {
            ...block.data,
            chartType: event.target.value as typeof block.data.chartType,
          },
        })}
        className="h-9 w-full"
      >
        <option value="bar">Horizontal bars</option>
        <option value="column">Columns</option>
        <option value="line">Line</option>
        <option value="donut">Donut</option>
        <option value="stacked">Stacked</option>
      </Select>
      <ColorPicker aria-label="Chart color picker" hexLabel="Chart color hex code" value={block.data.color} onChange={(color) => onChange({ ...block, data: { ...block.data, color } })} />
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 text-xs font-medium text-slate-500">
          <span>Chart data</span>
          <span>{block.data.fields.length}/20</span>
        </div>
        {block.data.fields.map((field, index) => (
          <div key={field.id} className="flex items-center gap-2">
            <Input
              aria-label={`Chart field ${index + 1} label`}
              value={field.label}
              maxLength={120}
              onChange={(event) => onChange({
                ...block,
                data: {
                  ...block.data,
                  fields: block.data.fields.map((item) => item.id === field.id
                    ? { ...item, label: event.target.value }
                    : item),
                },
              })}
              placeholder="Label"
              className="h-9 min-w-0 flex-1"
            />
            <Input
              aria-label={`Chart field ${index + 1} value`}
              type="number"
              min="0"
              max="1000000000000"
              step="any"
              value={field.value}
              onChange={(event) => onChange({
                ...block,
                data: {
                  ...block.data,
                  fields: block.data.fields.map((item) => item.id === field.id
                    ? { ...item, value: Math.max(0, Number(event.target.value) || 0) }
                    : item),
                },
              })}
              className="h-9 w-24 shrink-0"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remove chart field ${index + 1}`}
              disabled={block.data.fields.length <= 1}
              onClick={() => onChange({
                ...block,
                data: { ...block.data, fields: block.data.fields.filter((item) => item.id !== field.id) },
              })}
              className="size-8 shrink-0 text-slate-400 hover:text-rose-600"
            >
              <Trash2 size={14} />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={block.data.fields.length >= 20}
          onClick={() => onChange({
            ...block,
            data: {
              ...block.data,
              fields: [...block.data.fields, {
                id: createClientId(),
                label: `Field ${block.data.fields.length + 1}`,
                value: 0,
              }],
            },
          })}
          className="w-full justify-center"
        >
          <Plus size={14} /> Add data field
        </Button>
      </div>
    </div>
  );
}
