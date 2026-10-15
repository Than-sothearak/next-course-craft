import type { BlockTemplate } from "../block-template-data";

export function TextTemplatePreview({ kind }: { kind: BlockTemplate["preview"] }) {
  if (kind === "title")
    return (
      <div className="space-y-2 text-slate-700">
        <p className="m-0 leading-tight">
          <strong>
            <span className="text-2xl tracking-tight">Section heading</span>
          </strong>
        </p>
        <p className="m-0 text-xs leading-5">Write your paragraph here.</p>
      </div>
    );
  if (kind === "text")
    return (
      <article className="text-[11px] leading-4 text-slate-600">
        <p>
          Write a concise explanation for your learners. Add another sentence to
          connect the idea to a real example.
        </p>
      </article>
    );
  if (kind === "text-lead")
    return (
      <p className="m-0 text-sm leading-5 text-slate-600">
        Introduce the main idea with a clear, welcoming explanation.
      </p>
    );
  if (kind === "text-large-body")
    return (
      <p className="m-0 text-base font-medium leading-6 text-slate-800">
        Explain one important idea in a few concise sentences.
      </p>
    );
  if (kind === "text-small-note")
    return (
      <p className="m-0 text-[10px] leading-4 text-slate-500">
        Note: Add a short reminder or supporting detail here.
      </p>
    );
  if (kind === "text-centered-intro")
    return (
      <div className="space-y-1 text-center">
        <p className="m-0 text-sm font-semibold leading-5 text-slate-900">
          A new way to think about this topic
        </p>
        <p className="m-0 text-[10px] leading-4 text-slate-600">
          Add a sentence that sets up the lesson below.
        </p>
      </div>
    );
  if (kind === "text-subheading")
    return (
      <div className="space-y-1">
        <p className="m-0 text-base font-semibold leading-5 text-slate-900">
          A clear subheading
        </p>
        <p className="m-0 text-[10px] leading-4 text-slate-600">
          Use the paragraph below to explain the idea or add an example.
        </p>
      </div>
    );
  if (kind === "text-color-emphasis")
    return (
      <p className="m-0 text-[10px] leading-4 text-slate-600">
        <strong className="text-sm text-indigo-600">Key idea</strong>
        <br />
        Explain why this idea matters to the learner.
      </p>
    );
  return <div className="h-12 rounded-md bg-slate-100" />;
}
