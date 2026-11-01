"use client";

import { Select } from "@/components/ui/select";
import type { EditorSnapshotInput } from "@/lib/editor/schemas";

export function MoveContentSectionSelect({ sections, lesson, onMove }: {
  sections: EditorSnapshotInput["sections"];
  lesson: Pick<EditorSnapshotInput["lessons"][number], "title" | "sectionId">;
  onMove: (sectionId: string) => void;
}) {
  const destinations = sections.filter((section) => section.id !== lesson.sectionId);
  if (!destinations.length) return null;
  return <label className="block px-2 py-2 text-xs text-slate-600">
    Move to section
    <Select aria-label={`Move ${lesson.title} to section`} value="" className="mt-1 h-9 w-full text-xs" onChange={(event) => {
      const destinationId = event.currentTarget.value;
      if (!destinationId) return;
      const menu = event.currentTarget.closest("details");
      onMove(destinationId);
      menu?.removeAttribute("open");
    }}>
      <option value="">Choose section</option>
      {destinations.map((section) => <option key={section.id} value={section.id}>{section.title}</option>)}
    </Select>
  </label>;
}
