import * as React from "react";
import { cn } from "@/lib/utils";

export const Radio = React.forwardRef<HTMLInputElement, Omit<React.ComponentProps<"input">, "type">>(function Radio({ className, ...props }, ref) {
  return <input ref={ref} type="radio" className={cn("size-4 border-slate-300 accent-indigo-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-40", className)} {...props} />;
});
