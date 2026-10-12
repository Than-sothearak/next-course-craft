import { StatementTextPreview } from "./statement-text-preview";

type StatementStyle = "key" | "tip" | "warning" | "centered";

export const statementStyles: Record<StatementStyle, { container: string; title: string; body: string }> = {
  key: {
    container: "rounded-r-lg border-l-4 border-indigo-500 bg-indigo-50 px-4 py-3 text-indigo-950",
    title: "text-sm font-semibold",
    body: "mt-1 text-sm leading-6",
  },
  tip: {
    container: "rounded-r-lg border-l-4 border-emerald-500 bg-emerald-50 px-4 py-3 text-emerald-950",
    title: "text-sm font-semibold",
    body: "mt-1 text-sm leading-6",
  },
  warning: {
    container: "rounded-r-lg border-l-4 border-amber-500 bg-amber-50 px-4 py-3 text-amber-950",
    title: "text-sm font-semibold",
    body: "mt-1 text-sm leading-6",
  },
  centered: {
    container: "px-4 py-5 text-center text-slate-900",
    title: "text-xl font-semibold tracking-tight",
    body: "mx-auto mt-2 max-w-prose text-sm leading-6 text-slate-600",
  },
};

export function StatementBlockPreview({ style, title, body, titleHtml, bodyHtml }: { style: StatementStyle; title: string; body: string; titleHtml?: string; bodyHtml?: string }) {
  const classes = statementStyles[style];
  return <div className={classes.container}>
    <StatementTextPreview tag="h3" text={title || "Statement title"} html={titleHtml} className={classes.title} />
    <StatementTextPreview tag="p" text={body || "Add your statement text here."} html={bodyHtml} className={classes.body} />
  </div>;
}
