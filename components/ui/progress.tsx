import * as React from "react";
import { cn } from "@/lib/utils";

export type ProgressProps = Omit<React.ComponentProps<"div">, "aria-valuemax" | "aria-valuemin" | "aria-valuenow"> & {
  value?: number | null;
};

export function Progress({ value, className, ...props }: ProgressProps) {
  const hasValue = typeof value === "number" && Number.isFinite(value);
  const normalizedValue = hasValue ? Math.max(0, Math.min(100, value)) : null;

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={normalizedValue ?? undefined}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-slate-200", className)}
      {...props}
    >
      <div
        className={cn(
          "h-full rounded-full bg-indigo-600 transition-[width] duration-500",
          normalizedValue === null && "w-1/3 motion-safe:animate-pulse",
        )}
        style={normalizedValue === null ? undefined : { width: `${normalizedValue}%` }}
      />
    </div>
  );
}
