import * as React from "react";
import { cn } from "@/lib/utils";

const chevronIcon =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E";

export const Select = React.forwardRef<HTMLSelectElement, React.ComponentProps<"select">>(function Select(
  { className, style, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cn(
        "flex h-10 w-full appearance-none rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-10 text-sm text-slate-900 shadow-sm outline-none transition-colors focus-visible:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-100 aria-invalid:border-rose-500 aria-invalid:focus-visible:ring-rose-100 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      style={{
        backgroundImage: `url("${chevronIcon}")`,
        backgroundPosition: "right 0.75rem center",
        backgroundRepeat: "no-repeat",
        backgroundSize: "1rem 1rem",
        ...style,
      }}
      {...props}
    />
  );
});
