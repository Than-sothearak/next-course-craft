"use client";

import type { ContentBlock } from "@/lib/schemas/block";
import { Input } from "@/components/ui/input";

export function SurveyBlockSettings({ block, onChange }: { block: Extract<ContentBlock, { type: "survey" }>; onChange: (block: ContentBlock) => void }) {
  return (
    <div className="space-y-2">
      <Input
        aria-label="Survey question"
        value={block.data.question}
        maxLength={1000}
        onChange={(event) =>
          onChange({
            ...block,
            data: { ...block.data, question: event.target.value },
          })
        }
        placeholder="Survey question"
        className="h-9"
      />
      <div className="grid grid-cols-2 gap-2">
        <Input
          aria-label="Lowest rating label"
          value={block.data.minLabel}
          maxLength={100}
          onChange={(event) =>
            onChange({
              ...block,
              data: { ...block.data, minLabel: event.target.value },
            })
          }
          placeholder="Lowest label"
          className="h-9"
        />
        <Input
          aria-label="Highest rating label"
          value={block.data.maxLabel}
          maxLength={100}
          onChange={(event) =>
            onChange({
              ...block,
              data: { ...block.data, maxLabel: event.target.value },
            })
          }
          placeholder="Highest label"
          className="h-9"
        />
      </div>
    </div>
  );
}
