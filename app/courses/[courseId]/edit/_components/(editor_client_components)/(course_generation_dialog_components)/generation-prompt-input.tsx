"use client";

import type { RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export const starterGenerationPrompt = "Generate interactive content following the selected course structure and settings. Explain each topic in clear paragraphs, include practical examples, and use suitable CourseCraft text and interactive blocks.";

const maximumPromptLength = 5_000;
const promptInstructions = [
  {
    label: "Keep source details",
    text: "When a source file is attached, preserve all meaningful information from every assigned page or slide, including definitions, original examples, tables, code, and important images where possible. Keep source-page references and explain the material fully without summarizing away important details.",
  },
  {
    label: "Explain code",
    text: "Keep complete original HTML, CSS, and JavaScript examples in code blocks, preserving their syntax and formatting. Add normal text paragraphs explaining what the code does and how to use it.",
  },
  {
    label: "Guided practice",
    text: "Add guided practice with clear instructions and useful feedback. Use process steps for sequences, tabs for related topics, and knowledge checks to help learners apply what they have learned.",
  },
  {
    label: "Summary & next lesson",
    text: "Include a detailed lesson summary using normal text blocks with bold labels and explanatory paragraphs instead of a table. Give the next lesson a meaningful topic-based title and describe what learners will study next, following the selected course structure.",
  },
  {
    label: "Continue buttons",
    text: "For long content, add Continue buttons at natural stopping points between groups of blocks so learners can progress through the material comfortably.",
  },
] as const;

export function GenerationPromptInput({ value, onChange, inputRef, disabled }: {
  value: string;
  onChange: (value: string) => void;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  disabled: boolean;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor="course-generation-prompt" className="block text-sm font-medium text-slate-700">
        What should this course teach?
      </label>
      <Textarea
        id="course-generation-prompt"
        ref={inputRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        maxLength={maximumPromptLength}
        aria-describedby="course-generation-prompt-hint"
        placeholder="Describe the subject, key skills, or paste a lesson outline. You can leave this blank when uploading a source file."
        className="min-h-40 resize-y"
      />
      <p id="course-generation-prompt-hint" className="text-xs leading-5 text-slate-500">
        Edit the starter prompt and add your topic, or choose extra instructions below. Your selected language and course settings apply.
      </p>
      <div role="group" aria-label="Add prompt instructions" className="flex flex-wrap gap-2">
        {promptInstructions.map(({ label, text }) => {
          const nextValue = value.trimEnd() ? `${value.trimEnd()}\n\n${text}` : text;
          const alreadyAdded = value.includes(text);
          return (
            <Button
              key={label}
              type="button"
              variant="outline"
              size="sm"
              className="h-auto min-h-8 whitespace-normal px-2.5 py-1.5 text-left text-xs"
              disabled={disabled || alreadyAdded || nextValue.length > maximumPromptLength}
              title={alreadyAdded ? "Already added to your prompt" : text}
              onClick={() => {
                onChange(nextValue);
                inputRef.current?.focus();
              }}
            >
              {label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
