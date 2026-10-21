"use client";
import { FilePlus2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DashboardActions({
  disabled,
  onNewCourse,
}: {
  disabled: boolean;
  onNewFolder: () => void;
  onNewCourse: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button disabled={disabled} onClick={onNewCourse} className="cursor-pointer">
        <FilePlus2 size={16} aria-hidden="true" /> New
        course
      </Button>
    </div>
  );
}
