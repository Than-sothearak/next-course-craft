import * as React from "react";
import { cn } from "@/lib/utils";

export const Card = React.forwardRef<HTMLElement, React.ComponentProps<"article">>(function Card(
  { className, ...props },
  ref,
) {
  return <article ref={ref} className={cn("rounded-xl border border-slate-200 bg-white text-slate-950 shadow-sm", className)} {...props} />;
});

export const CardContent = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(function CardContent(
  { className, ...props },
  ref,
) {
  return <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />;
});
