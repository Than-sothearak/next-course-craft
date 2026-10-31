"use client";

import { useId } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { List, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ContentBlock } from "@/lib/schemas/block";
import { SortableItem } from "./sortable-item";

function blockTypeLabel(block: ContentBlock) {
  if (block.type === "heading") return "Heading";
  if (block.type === "richText") {
    if (/<(?:ul|ol)\b/i.test(block.data.html)) return "List";
    if (/<blockquote\b/i.test(block.data.html)) return "Quote";
    if (/<pre\b/i.test(block.data.html)) return "Code";
    return "Text";
  }
  if (block.type === "link") return "Link";
  if (block.type === "statement") return "Statement";
  if (block.type === "image") return "Image";
  if (block.type === "gallery") return "Image gallery";
  if (block.type === "video") return "Video";
  if (block.type === "audioInstruction") return "Audio instruction";
  if (block.type === "audio") return "Audio";
  if (block.type === "interactionButton") return "Interaction button";
  if (block.type === "divider") return "Divider";
  if (block.type === "flipCard") return "Flashcards";
  if (block.type === "accordion") return block.data.layout === "tabs" ? "Tabs" : "Accordion";
  if (block.type === "labeledGraphic") return block.data.interactionMode === "spotTarget" ? "Mini-game" : "Labeled graphic";
  if (block.type === "processSteps") return "Process steps";
  if (block.type === "lessonMap") return "Lesson Map";
  if (block.type === "chart") return "Chart";
  if (block.type === "knowledgeCheck") return "Knowledge check";
  return "Survey";
}

function blockTitle(block: ContentBlock) {
  if (block.type === "heading") return block.data.text.trim() || "Heading";
  if (block.type === "richText") {
    const text = block.data.html
      .replace(/<br\s*\/?\s*>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;|&#160;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    return text.slice(0, 72) || blockTypeLabel(block);
  }
  if (block.type === "link") return block.data.label.trim() || "Link";
  if (block.type === "statement") return block.data.title.trim() || "Statement";
  if (block.type === "image")
    return block.data.title?.trim() || block.data.caption?.trim() || block.data.alt.trim() || "Image";
  if (block.type === "gallery") return `${block.data.images.length} image${block.data.images.length === 1 ? "" : "s"}`;
  if (block.type === "video") return "Video content";
  if (block.type === "audioInstruction") return block.data.label;
  if (block.type === "audio") return block.data.fileName.trim() || "Audio content";
  if (block.type === "interactionButton") return block.data.label;
  if (block.type === "divider")
    return block.data.style === "continue" ? block.data.label.trim() || "Continue button" : `${block.data.style} divider`;
  if (block.type === "flipCard") {
    const front = block.data.cards[0]?.front;
    return front?.type === "text" ? front.text.trim() || "Flip card" : front?.alt.trim() || "Flip card";
  }
  if (block.type === "accordion") return block.data.items[0]?.title.trim() || "Reveal sections";
  if (block.type === "labeledGraphic") {
    if (block.data.interactionMode === "spotTarget") return block.data.challengePrompt?.trim() || "Spot the clue";
    return `${block.data.markers.length} labeled marker${block.data.markers.length === 1 ? "" : "s"}`;
  }
  if (block.type === "processSteps") return block.data.steps[0]?.title.trim() || "Process steps";
  if (block.type === "lessonMap") return `${block.data.checkpoints.length} map checkpoint${block.data.checkpoints.length === 1 ? "" : "s"}`;
  if (block.type === "chart") return block.data.title.trim() || "Chart";
  if (block.type === "attachment") return block.data.fileName.trim() || "File attachment";
  if (block.type === "knowledgeCheck") return block.data.question.trim() || "Knowledge check";
  return block.data.question.trim() || "Survey";
}

export function BlockManagerSidebar({
  open,
  blocks,
  onClose,
  onReorder,
}: {
  open: boolean;
  blocks: ContentBlock[];
  onClose: () => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
}) {
  const dndId = `block-manager-${useId().replaceAll(":", "")}`;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    if (!event.over || event.active.id === event.over.id) return;
    const fromIndex = blocks.findIndex(
      (block) => `manager-block-${block.id}` === event.active.id,
    );
    const toIndex = blocks.findIndex(
      (block) => `manager-block-${block.id}` === event.over?.id,
    );
    if (fromIndex >= 0 && toIndex >= 0) onReorder(fromIndex, toIndex);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 top-[68px] z-40">
      <button
        type="button"
        aria-label="Close block manager"
        onClick={onClose}
        className="cursor-pointer absolute inset-0 bg-slate-950/20 lg:bg-transparent"
      />
      <aside
        id="lesson-block-manager"
        aria-label="Manage lesson blocks"
        className="absolute inset-y-0 right-0 flex w-[min(24rem,calc(100vw-1rem))] flex-col border-l border-slate-200 bg-white shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <List size={17} className="text-slate-500" />
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Manage blocks</h2>
              <p className="text-xs text-slate-500">{blocks.length} block{blocks.length === 1 ? "" : "s"}</p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Close block manager"
            onClick={onClose}
            className="size-8"
          >
            <X size={17} />
          </Button>
        </header>
        {blocks.length ? (
          <DndContext
            id={dndId}
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={blocks.map((block) => `manager-block-${block.id}`)}
              strategy={verticalListSortingStrategy}
            >
              <div
                role="list"
                aria-label="Lesson blocks"
                className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3"
              >
                {blocks.map((block, index) => (
                  <SortableItem
                    key={block.id}
                    id={`manager-block-${block.id}`}
                    alwaysShowHandle
                    handleClassName="text-[#2f5f9f] hover:bg-blue-100 hover:text-[#1d4e89]"
                    className="rounded-lg border border-slate-200 bg-white shadow-sm transition-colors hover:border-slate-300"
                  >
                    <div
                      role="listitem"
                      className="flex min-w-0 flex-1 items-center gap-2 py-2 pr-3"
                    >
                      <span className="grid size-6 shrink-0 place-items-center rounded bg-slate-100 text-[10px] font-semibold tabular-nums text-slate-500">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-800">
                          {blockTitle(block)}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          {blockTypeLabel(block)}
                        </p>
                      </div>
                    </div>
                  </SortableItem>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <div className="grid flex-1 place-items-center p-6 text-center">
            <div>
              <p className="text-sm font-medium text-slate-800">No blocks yet</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Add lesson content to manage its order here.
              </p>
            </div>
          </div>
        )}
        <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
          Drag the handle to reorder blocks.
        </p>
      </aside>
    </div>
  );
}
