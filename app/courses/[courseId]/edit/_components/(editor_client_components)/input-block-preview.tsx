type InputBlockPreviewProps =
  | { type: "knowledgeCheck"; question: string; options: string[]; correctOptionIndex?: number }
  | { type: "survey"; question: string; minLabel: string; maxLabel: string };

export function InputBlockPreview(props: InputBlockPreviewProps) {
  if (props.type === "knowledgeCheck")
    return (
      <div className="space-y-2 text-[10px] text-slate-700">
        <p className="font-semibold leading-4 text-slate-900">
          {props.question}
        </p>
        <div className="space-y-1.5">
          {props.options.map((option, index) => (
            <div
              key={`${index}-${option}`}
              className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1.5"
            >
              <span
                aria-hidden="true"
                className={`grid size-3.5 shrink-0 place-items-center rounded-full border ${index === (props.correctOptionIndex ?? 0) ? "border-indigo-600" : "border-slate-300"}`}
              >
                {index === (props.correctOptionIndex ?? 0) && (
                  <span className="size-1.5 rounded-full bg-indigo-600" />
                )}
              </span>
              <span>{option || `Answer option ${index + 1}`}</span>
            </div>
          ))}
        </div>
      </div>
    );

  return (
    <div className="space-y-2 text-[10px] text-slate-700">
      <p className="font-semibold text-slate-900">{props.question}</p>
      <div className="flex items-center justify-between gap-1">
        {[1, 2, 3, 4, 5].map((rating) => (
          <span
            key={rating}
            className="grid size-7 place-items-center rounded-full border border-slate-300 bg-white text-[10px] text-slate-600"
          >
            {rating}
          </span>
        ))}
      </div>
      <div className="flex justify-between text-[9px] text-slate-400">
        <span>{props.minLabel}</span>
        <span>{props.maxLabel}</span>
      </div>
    </div>
  );
}
