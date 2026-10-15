import type { ReactNode } from "react";
import {
  codeExamplePresets,
  codeExampleSample,
  type CodeExampleTemplate,
} from "@/lib/editor/code-example";
import { highlightCode } from "@/lib/editor/code-highlighting";

export function CodeTemplatePreview({
  template = "midnight-code",
}: {
  template?: CodeExampleTemplate;
}) {
  const preset =
    codeExamplePresets.find((item) => item.id === template) ??
    codeExamplePresets[0];
  const sample = codeExampleSample;
  const children: ReactNode[] = [];
  let offset = 0;
  for (const token of highlightCode(sample.code, sample.language)) {
    children.push(sample.code.slice(offset, token.from));
    children.push(
      <span key={token.from} className={`cc-code-token-${token.kind}`}>
        {sample.code.slice(token.from, token.to)}
      </span>,
    );
    offset = token.to;
  }
  children.push(sample.code.slice(offset));
  const explained = template !== "midnight-code";
  const explanation = <p>{sample.explanation}</p>;
  return (
    <div
      data-template-code-preview=""
      className="lesson-rich-text code-template-thumbnail"
    >
      <div className="mb-1 flex justify-between gap-2 text-[8px] font-medium text-slate-500">
        <span>greeting.js</span>
        <span>JavaScript</span>
      </div>
      <div className="tiptap">
        {explained && <h2>{sample.title}</h2>}
        {explained && preset.explanationPosition === "above" && explanation}
        <pre
          data-code-theme={preset.theme}
          data-code-language={sample.language}
        >
          <code>{children}</code>
        </pre>
        {explained && preset.explanationPosition === "below" && explanation}
      </div>
    </div>
  );
}
