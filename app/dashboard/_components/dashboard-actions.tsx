"use client";
import { FilePlus2, FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DashboardActions({ disabled, onNewFolder, onNewCourse }: { disabled: boolean; onNewFolder: () => void; onNewCourse: () => void }) {
  return <div className="flex flex-wrap gap-2">
    <Button variant="outline" disabled={disabled} onClick={onNewFolder}><FolderPlus size={16} aria-hidden="true" /> New folder</Button>
    <Button disabled={disabled} onClick={onNewCourse}><FilePlus2 size={16} aria-hidden="true" /> New course</Button>
  </div>;
}
