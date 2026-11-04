"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { evaluateKnowledgeCheckAnswer } from "@/lib/interactive/knowledge-check";


export function InteractiveKnowledgeCheck({
  blockId,
  question,
  options,
  correctOptionIndex,
  correctFeedback,
  incorrectFeedback,
  onAnswerChecked,
}: {
  blockId: string;
  question: string;
  options: string[];
  correctOptionIndex: number;
  correctFeedback: string;
  incorrectFeedback: string;
  onAnswerChecked?: () => void;
}) {
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);
  const [result, setResult] = useState<ReturnType<typeof evaluateKnowledgeCheckAnswer>>(null);

  function submitAnswer() {
    setResult(evaluateKnowledgeCheckAnswer({
      selectedOptionIndex,
      correctOptionIndex,
      correctFeedback,
      incorrectFeedback,
    }));
    onAnswerChecked?.();
  }

  return (
    <fieldset className="space-y-4">
      <legend className="text-lg font-semibold">{question}</legend>
      <div className="space-y-2">
        {options.map((option, index) => (
          <label
            key={`${blockId}-${index}`}
            data-slide-animation-item
            className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm transition-colors hover:border-slate-400"
            style={selectedOptionIndex === index ? { borderColor: "var(--course-primary, #2f5f9f)", backgroundColor: "color-mix(in srgb, var(--course-primary, #2f5f9f) 9%, white)" } : undefined}
          >
            <input
              type="radio"
              name={`knowledge-check-${blockId}`}
              value={index}
              checked={selectedOptionIndex === index}
              onChange={() => {
                setSelectedOptionIndex(index);
                setResult(null);
              }}
              className="mt-0.5"
              style={{ accentColor: "var(--course-primary, #2f5f9f)" }}
            />
            <span>{option || `Answer option ${index + 1}`}</span>
          </label>
        ))}
      </div>
      <Button type="button" disabled={selectedOptionIndex === null} onClick={submitAnswer} style={{ backgroundColor: "var(--course-primary, #2f5f9f)" }}>
        Check answer
      </Button>
      {result && (
        <p
          role="status"
          aria-live="polite"
          className={`rounded-lg px-4 py-3 text-sm font-medium ${result.correct ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}
        >
          {result.feedback}
        </p>
      )}
    </fieldset>
  );
}

