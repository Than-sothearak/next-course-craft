import * as React from "react";
import { cn } from "@/lib/utils";

export const Checkbox = React.forwardRef<HTMLInputElement, Omit<React.ComponentProps<"input">, "type">>(function Checkbox({ className, ...props }, ref) {
  return <input ref={ref} type="checkbox" className={cn("size-4 rounded border-slate-300 accent-indigo-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-40", className)} {...props} />;
});
