"use client";

import type { ContentBlock } from "@/lib/schemas/block";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { isSafeLinkHref, normalizeLinkHref } from "@/lib/editor/link-utils";

export function LinkBlockSettings({ block, onChange }: { block: Extract<ContentBlock, { type: "link" }>; onChange: (block: ContentBlock) => void }) {
  return (
    <div className="space-y-2">
      <Input
        aria-label="Link text"
        value={block.data.label}
        maxLength={200}
        onChange={(event) => onChange({
          ...block,
          data: { ...block.data, label: event.target.value },
        })}
        placeholder="Link text"
        className="h-9"
      />
      <div>
        <Input
          aria-label="Link URL"
          type="text"
          value={block.data.url}
          maxLength={2048}
          onChange={(event) => onChange({
            ...block,
            data: { ...block.data, url: event.target.value },
          })}
          onBlur={(event) => {
            const url = normalizeLinkHref(event.target.value);
            if (url) onChange({ ...block, data: { ...block.data, url } });
          }}
          placeholder="https://example.com"
          className="h-9"
        />
        {!isSafeLinkHref(block.data.url) && (
          <p className="mt-1 text-xs text-rose-600">Enter a safe web, email, phone, or relative link.</p>
        )}
      </div>
      <Textarea
        aria-label="Link description"
        value={block.data.description}
        maxLength={1000}
        onChange={(event) => onChange({
          ...block,
          data: { ...block.data, description: event.target.value },
        })}
        placeholder="Short description (optional)"
        className="min-h-16 resize-y"
      />
      <Select
        aria-label="Link style"
        value={block.data.style}
        onChange={(event) => onChange({
          ...block,
          data: { ...block.data, style: event.target.value as typeof block.data.style },
        })}
        className="h-9 w-full"
      >
        <option value="button">Button</option>
        <option value="card">Resource card</option>
        <option value="text">Inline text</option>
      </Select>
      <label className="flex items-center gap-2 text-xs text-slate-600">
        <Checkbox
          checked={block.data.openInNewTab}
          onChange={(event) => onChange({
            ...block,
            data: { ...block.data, openInNewTab: event.target.checked },
          })}
        />
        Open in a new tab
      </label>
    </div>
  );
}
