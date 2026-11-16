import { Check } from "lucide-react";

type ListPreviewStyle = "disc" | "circle" | "square" | "check" | "dash" | "numbered" | "lettered" | "roman";

export function ListTemplatePreview({ style }: { style: ListPreviewStyle }) {
  const labels: Record<ListPreviewStyle, string[]> = {
    disc: ["•", "•", "•"],
    circle: ["○", "○", "○"],
    square: ["▪", "▪", "▪"],
    check: ["", "", ""],
    dash: ["–", "–", "–"],
    numbered: ["1.", "2.", "3."],
    lettered: ["A.", "B.", "C."],
    roman: ["I.", "II.", "III."],
  };
  const items = style === "numbered" || style === "lettered" || style === "roman"
    ? ["Review the example", "Try the steps yourself", "Check your result"]
    : ["First point", "Second point", "Third point"];

  return <div className="space-y-3 text-xs leading-5 text-slate-700">
    {items.map((item, index) => <p key={item} className={`flex min-w-0 items-center gap-3 ${style === "check" ? "rounded-xl border border-slate-200/90 bg-white p-2 shadow-sm" : ""}`}>
      <span
        className={`grid size-8 shrink-0 place-items-center font-semibold ${style === "check" ? "rounded-lg border border-[color-mix(in_srgb,var(--course-primary,#2f5f9f)_30%,transparent)] bg-[color-mix(in_srgb,var(--course-primary,#2f5f9f)_10%,white)] text-[var(--course-primary,#2f5f9f)] shadow-sm" : "rounded-full"} ${style === "numbered" || style === "lettered" || style === "roman" ? "text-[11px]" : "text-sm"}`}
        style={{ backgroundColor: "color-mix(in srgb, var(--course-primary, #2f5f9f) 10%, white)", color: "var(--course-primary, #2f5f9f)" }}
      >{style === "check" ? <Check size={15} strokeWidth={2.75} aria-hidden="true" /> : labels[style][index]}</span>
      <span className={`min-w-0 flex-1 break-words ${style === "check" ? "px-1 py-1" : "py-1.5"}`}>{item}</span>
    </p>)}
  </div>;
}

