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

  return <div className="space-y-1.5 text-[11px] leading-4 text-slate-700">
    {items.map((item, index) => <p key={item} className="flex gap-2">
      <span className={`w-7 shrink-0 text-right ${style === "check" || style === "numbered" || style === "lettered" || style === "roman" ? "font-semibold text-indigo-600" : "text-indigo-600"}`}>{labels[style][index]}</span>
      <span>{item}</span>
    </p>)}
  </div>;
}

