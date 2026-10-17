type ListPreviewStyle = "disc" | "circle" | "square" | "check" | "dash" | "numbered" | "lettered" | "roman";

export function ListTemplatePreview({ style }: { style: ListPreviewStyle }) {
  const labels: Record<ListPreviewStyle, string[]> = {
    disc: ["•", "•", "•"],
    circle: ["○", "○", "○"],
    square: ["▪", "▪", "▪"],
    check: ["✓", "✓", "✓"],
    dash: ["–", "–", "–"],
    numbered: ["1.", "2.", "3."],
    lettered: ["A.", "B.", "C."],
    roman: ["I.", "II.", "III."],
  };
  const items = style === "numbered" || style === "lettered" || style === "roman"
    ? ["Review the example", "Try the steps yourself", "Check your result"]
    : ["First point", "Second point", "Third point"];

  return <div className="space-y-3 text-xs leading-5 text-slate-700">
    {items.map((item, index) => <p key={item} className="flex items-center gap-3">
      <span
        className={`grid size-8 shrink-0 place-items-center rounded-full font-semibold ${style === "numbered" || style === "lettered" || style === "roman" ? "text-[11px]" : "text-sm"}`}
        style={{ backgroundColor: "color-mix(in srgb, var(--course-primary, #2f5f9f) 10%, white)", color: "var(--course-primary, #2f5f9f)" }}
      >{labels[style][index]}</span>
      <span className={`min-w-0 flex-1 ${style === "check" ? "rounded-lg border border-slate-200 bg-slate-50 px-3 py-2" : "py-1.5"}`}>{item}</span>
    </p>)}
  </div>;
}

