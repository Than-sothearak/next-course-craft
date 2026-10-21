"use client";

import type { ContentBlock } from "@/lib/schemas/block";
import { Input } from "@/components/ui/input";

export function KnowledgeCheckBlockSettings({ block, onChange }: { block: Extract<ContentBlock, { type: "knowledgeCheck" }>; onChange: (block: ContentBlock) => void }) {
  return (
    <div className="space-y-2">
      <Input
        aria-label="Question"
        value={block.data.question}
        maxLength={1000}
        onChange={(event) =>
          onChange({
            ...block,
            data: { ...block.data, question: event.target.value },
          })
        }
        placeholder="Question"
        className="h-9"
      />
      <p className="pt-1 text-xs font-medium text-slate-500">
        Select the correct answer
      </p>
      {block.data.options.map((option, index) => (
        <label key={index} className="flex items-center gap-2">
          <input
            type="radio"
            name={`correct-answer-${block.id}`}
            aria-label={`Mark answer ${index + 1} as correct`}
            checked={(block.data.correctOptionIndex ?? 0) === index}
            onChange={() =>
              onChange({
                ...block,
                data: { ...block.data, correctOptionIndex: index },
              })
            }
            className="size-4 shrink-0 accent-indigo-600"
          />
          <Input
            aria-label={`Answer option ${index + 1}`}
            value={option}
            maxLength={500}
            onChange={(event) =>
              onChange({
                ...block,
                data: {
                  ...block.data,
                  options: block.data.options.map((item, itemIndex) =>
                    itemIndex === index ? event.target.value : item,
                  ),
                },
              })
            }
            placeholder={`Answer option ${index + 1}`}
            className="h-9"
          />
        </label>
      ))}
      <Input
        aria-label="Correct answer feedback"
        value={block.data.correctFeedback ?? "Correct!"}
        maxLength={1000}
        onChange={(event) =>
          onChange({
            ...block,
            data: {
              ...block.data,
              correctFeedback: event.target.value,
            },
          })
        }
        placeholder="Correct feedback"
        className="h-9"
      />
      <Input
        aria-label="Incorrect answer feedback"
        value={block.data.incorrectFeedback ?? "Not quite. Try again."}
        maxLength={1000}
        onChange={(event) =>
          onChange({
            ...block,
            data: {
              ...block.data,
              incorrectFeedback: event.target.value,
            },
          })
        }
        placeholder="Try-again feedback"
        className="h-9"
      />
    </div>
  );
}
