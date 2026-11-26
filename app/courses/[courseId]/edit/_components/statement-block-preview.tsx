import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, type LucideIcon } from "lucide-react";
import type { StatementStyle } from "@/lib/schemas/block";
import { cn } from "@/lib/utils";
import { StatementTextPreview } from "./statement-text-preview";

type StatementStylePresentation = {
  container: string;
  title: string;
  body: string;
  icon?: LucideIcon;
  iconColor?: string;
};

export const statementStyles: Record<StatementStyle, StatementStylePresentation> = {
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
  alert: {
    container: "rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950 shadow-sm",
    title: "text-lg font-semibold leading-6",
    body: "mt-1 text-sm leading-6",
    icon: AlertTriangle,
    iconColor: "text-amber-600",
  },
  danger: {
    container: "rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-rose-950 shadow-sm",
    title: "text-lg font-semibold leading-6",
    body: "mt-1 text-sm leading-6",
    icon: AlertTriangle,
    iconColor: "text-rose-600",
  },
  info: {
    container: "rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sky-950 shadow-sm",
    title: "text-lg font-semibold leading-6",
    body: "mt-1 text-sm leading-6",
    icon: Info,
    iconColor: "text-sky-600",
  },
  success: {
    container: "rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-950 shadow-sm",
    title: "text-lg font-semibold leading-6",
    body: "mt-1 text-sm leading-6",
    icon: CheckCircle2,
    iconColor: "text-emerald-600",
  },
};

export function StatementBlockSurface({ style, children, transparentSurface = false, className }: {
  style: StatementStyle;
  children?: ReactNode;
  transparentSurface?: boolean;
  className?: string;
}) {
  const classes = statementStyles[style];
  const Icon = classes.icon;
  return <div data-statement-style={style} className={cn(classes.container, Icon && "flex min-w-0 items-start gap-3", className)} style={transparentSurface ? { backgroundColor: "transparent", color: "inherit", padding: 0 } : undefined}>
    {Icon && <Icon aria-hidden="true" className={`mt-1 size-5 shrink-0 ${classes.iconColor}`} />}
    <div className={Icon ? "min-w-0 flex-1" : undefined}>{children}</div>
  </div>;
}

export function StatementBlockPreview({ style, title, body, titleHtml, bodyHtml, transparentSurface = false, standardMode = false }: { style: StatementStyle; title: string; body: string; titleHtml?: string; bodyHtml?: string; transparentSurface?: boolean; standardMode?: boolean }) {
  const classes = statementStyles[style];
  return <StatementBlockSurface style={style} transparentSurface={transparentSurface}>
    <StatementTextPreview tag="h3" text={title || "Statement title"} html={titleHtml} className={classes.title} inheritColor />
    <StatementTextPreview tag="p" text={body || "Add your statement text here."} html={bodyHtml} className={classes.body} inheritColor standardMode={standardMode} />
  </StatementBlockSurface>;
}
