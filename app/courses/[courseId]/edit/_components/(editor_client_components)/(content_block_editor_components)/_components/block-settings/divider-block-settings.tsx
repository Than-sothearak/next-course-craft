"use client";

import type { ContentBlock } from "@/lib/schemas/block";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export function DividerBlockSettings({ block, onChange }: { block: Extract<ContentBlock, { type: "divider" }>; onChange: (block: ContentBlock) => void }) {
  return (
    <div className="space-y-2">
      <Select
        aria-label="Divider style"
        value={block.data.style}
        onChange={(event) =>
          onChange({
            ...block,
            data: {
              ...block.data,
              style: event.target.value as
                | "line"
                | "space"
                | "continue",
            },
          })
        }
        className="h-9 w-full"
      >
        <option value="line">Line</option>
        <option value="space">Space</option>
        <option value="continue">Continue button</option>
      </Select>
      {block.data.style === "line" && (
        <>
          <label className="block text-xs font-medium text-slate-600">
            Line weight
            <Select
              aria-label="Divider line weight"
              value={String(block.data.lineWeight ?? 1)}
              onChange={(event) =>
                onChange({
                  ...block,
                  data: {
                    ...block.data,
                    lineWeight: Number(event.target.value),
                  },
                })
              }
              className="mt-1 h-9 w-full"
            >
              {[1, 2, 3, 4, 6, 8, 12, 16].map((weight) => (
                <option key={weight} value={weight}>
                  {weight} px
                </option>
              ))}
            </Select>
          </label>
          <label className="block text-xs font-medium text-slate-600">
            Line color
            <input
              type="color"
              aria-label="Divider line color"
              value={block.data.lineColor ?? "#cbd5e1"}
              onChange={(event) =>
                onChange({
                  ...block,
                  data: { ...block.data, lineColor: event.target.value },
                })
              }
              className="mt-1 h-9 w-full cursor-pointer rounded-md border border-slate-200 bg-white p-1"
            />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            Line style
            <Select
              aria-label="Divider line style"
              value={block.data.lineStyle ?? "solid"}
              onChange={(event) =>
                onChange({
                  ...block,
                  data: {
                    ...block.data,
                    lineStyle: event.target.value as
                      | "solid"
                      | "dashed"
                      | "dotted"
                      | "double",
                  },
                })
              }
              className="mt-1 h-9 w-full"
            >
              <option value="solid">Solid</option>
              <option value="dashed">Dashed</option>
              <option value="dotted">Dotted</option>
              <option value="double">Double</option>
            </Select>
          </label>
        </>
      )}
      {block.data.style === "continue" && (
        <>
          <Input
            aria-label="Continue button label"
            value={block.data.label}
            maxLength={100}
            onChange={(event) =>
              onChange({
                ...block,
                data: { ...block.data, label: event.target.value },
              })
            }
            placeholder="Continue"
            className="h-9"
          />
          <Select
            aria-label="Continue button completion type"
            value={block.data.completionType}
            onChange={(event) =>
              onChange({
                ...block,
                data: {
                  ...block.data,
                  completionType: event.target.value as
                    | "none"
                    | "completeAbove",
                },
              })
            }
            className="h-9 w-full"
          >
            <option value="none">No completion lock</option>
            <option value="completeAbove">
              Complete content above to unlock
            </option>
          </Select>
        </>
      )}
    </div>
  );
}
