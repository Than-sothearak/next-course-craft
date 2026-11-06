import { StatementTextPreview } from "./statement-text-preview";

type StatementStyle = "key" | "tip" | "warning" | "centered";

export const statementStyles: Record<StatementStyle, { container: string; title: string; body: string }> = {
  key: {
    container: "rounded-r-lg border-l-4 border-[var(--course-primary,#2f5f9f)] bg-[color-mix(in_srgb,var(--course-primary,#2f5f9f)_8%,white)] px-4 py-3 text-inherit",
    title: "text-[28px] font-semibold",
    body: "mt-1 text-[16px] leading-6",
  },
  tip: {
    container: "rounded-r-lg border-l-4 border-[var(--course-primary,#2f5f9f)] bg-[color-mix(in_srgb,var(--course-primary,#2f5f9f)_8%,white)] px-4 py-3 text-inherit",
    title: "text-[28px] font-semibold",
    body: "mt-1 text-[16px] leading-6",
  },
  warning: {
    container: "rounded-r-lg border-l-4 border-[var(--course-primary,#2f5f9f)] bg-[color-mix(in_srgb,var(--course-primary,#2f5f9f)_8%,white)] px-4 py-3 text-inherit",
    title: "text-[28px] font-semibold",
    body: "mt-1 text-[16px] leading-6",
  },
  centered: {
    container: "px-4 py-5 text-center text-inherit",
    title: "text-[28px] font-semibold tracking-tight",
    body: "mx-auto mt-2 max-w-prose text-[16px] leading-6 text-inherit",
  },
};

export function StatementBlockPreview({ style, title, body, titleHtml, bodyHtml, transparentSurface = false }: { style: StatementStyle; title: string; body: string; titleHtml?: string; bodyHtml?: string; transparentSurface?: boolean }) {
  const classes = statementStyles[style];
  return <div className={classes.container} style={transparentSurface ? { backgroundColor: "transparent", color: "inherit", padding: 0 } : undefined}>
    <StatementTextPreview tag="h3" text={title || "Statement title"} html={titleHtml} className={classes.title} inheritColor />
    <StatementTextPreview tag="p" text={body || "Add your statement text here."} html={bodyHtml} className={classes.body} inheritColor />
  </div>;
}
