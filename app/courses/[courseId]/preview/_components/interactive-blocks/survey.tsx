"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";


export function InteractiveSurvey({
  blockId,
  question,
  minLabel,
  maxLabel,
  onSubmit,
}: {
  blockId: string;
  question: string;
  minLabel: string;
  maxLabel: string;
  onSubmit?: () => void;
}) {
  const [rating, setRating] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);

  return (
    <fieldset className="space-y-4">
      <legend className="text-lg font-semibold">{question}</legend>
      <div className="flex flex-wrap items-center gap-3">
        {[1, 2, 3, 4, 5].map((value) => (
          <label
            key={`${blockId}-${value}`}
            data-slide-animation-item
            className="flex cursor-pointer flex-col items-center gap-1 text-sm"
          >
            <input
              type="radio"
              name={`survey-${blockId}`}
              value={value}
              checked={rating === value}
              onChange={() => {
                setRating(value);
                setSubmitted(false);
              }}
              className="size-5"
              style={{ accentColor: "var(--course-primary, #2f5f9f)" }}
            />
            <span>{value}</span>
          </label>
        ))}
      </div>
      <div className="flex max-w-sm justify-between text-xs text-slate-500">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
      <Button type="button" variant="outline" disabled={rating === null} onClick={() => { setSubmitted(true); onSubmit?.(); }}>
        {submitted ? "Done" : "Finish reflection"}
      </Button>
      {submitted && (
        <p role="status" aria-live="polite" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          Thanks for taking a moment to reflect.
        </p>
      )}
    </fieldset>
  );
}

