"use client";

import { ColorPicker } from "@/components/ui/color-picker";
import { Checkbox } from "@/components/ui/checkbox";
import { defaultCourseTheme } from "@/lib/editor/theme";
import { normalizeHexColor } from "@/lib/editor/text-format";

import { Plus, Trash2 } from "lucide-react";
import type { ContentBlock } from "@/lib/schemas/block";
import { createClientId } from "@/lib/client-id";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
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
      <label className="flex items-center gap-2 text-xs text-slate-600">
        <Checkbox aria-label="Use custom chart color" checked={Boolean(block.data.color)} onChange={(event) => onChange({ ...block, data: { ...block.data, color: event.target.checked ? normalizeHexColor(getComputedStyle(event.currentTarget).getPropertyValue("--course-primary")) ?? defaultCourseTheme.primaryColor : undefined } })} />
        Custom chart color
      </label>
      {block.data.color ? <ColorPicker aria-label="Chart color picker" hexLabel="Chart color hex code" value={block.data.color} onChange={(color) => onChange({ ...block, data: { ...block.data, color } })} /> : <p className="text-xs text-slate-500">Uses the course theme color.</p>}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 text-xs font-medium text-slate-500">
          <span>Chart data</span>
          <span>{block.data.fields.length}/20</span>
        </div>
        {block.data.fields.map((field, index) => (
          <div key={field.id} className="space-y-2 rounded-lg border border-slate-200 p-2">
            <div className="flex items-center gap-2">
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
            <NumberInput
              aria-label={`Chart field ${index + 1} value`}
              min={0}
              max={1000000000000}
              precision="any"
              value={field.value}
              onValueChange={(value) => onChange({
                ...block,
                data: {
                  ...block.data,
                  fields: block.data.fields.map((item) => item.id === field.id
                    ? { ...item, value }
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
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <Checkbox aria-label={`Use custom chart field ${index + 1} color`} checked={Boolean(field.color)} onChange={(event) => {
                const color = event.target.checked ? block.data.color ?? normalizeHexColor(getComputedStyle(event.currentTarget).getPropertyValue("--course-primary")) ?? defaultCourseTheme.primaryColor : undefined;
                onChange({ ...block, data: { ...block.data, fields: block.data.fields.map((item) => item.id === field.id ? { ...item, color } : item) } });
              }} />
              Custom field color
            </label>
            {field.color && <ColorPicker aria-label={`Chart field ${index + 1} color picker`} hexLabel={`Chart field ${index + 1} color hex code`} value={field.color} onChange={(color) => onChange({ ...block, data: { ...block.data, fields: block.data.fields.map((item) => item.id === field.id ? { ...item, color } : item) } })} />}
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
