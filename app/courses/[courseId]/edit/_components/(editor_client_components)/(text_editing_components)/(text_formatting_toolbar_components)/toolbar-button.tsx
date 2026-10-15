import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

export function ToolbarButton({ label, active, onClick, children }: { label: string; active?: boolean; onClick: () => void; children: ReactNode }) {
  return <Button type="button" variant={active ? "secondary" : "ghost"} size="icon" aria-label={label} title={label} onMouseDown={(event) => event.preventDefault()} onClick={onClick} className="size-8 rounded-md">{children}</Button>;
}

