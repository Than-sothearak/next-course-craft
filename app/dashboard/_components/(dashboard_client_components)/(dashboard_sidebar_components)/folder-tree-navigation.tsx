"use client";
import { ChevronDown, ChevronRight, Folder } from "lucide-react";
import type { FolderTreeNode } from "@/lib/dashboard/types";
import { Button } from "@/components/ui/button";

export function FolderTreeNavigation({
  nodes,
  currentFolderId,
  expanded,
  onToggle,
  onOpen,
}: {
  nodes: FolderTreeNode[];
  currentFolderId: string | null;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  return (
    <ul className="space-y-0.5" role="tree" aria-label="Folders">
      {nodes.map((node) => {
        const hasChildren = node.children.length > 0;
        const isExpanded = expanded.has(node.id);
        const selected = currentFolderId === node.id;
        return (
          <li key={node.id} role="none">
            <div
              role="treeitem"
              aria-expanded={hasChildren ? isExpanded : undefined}
              aria-selected={selected}
              className={`group flex min-w-0 items-center gap-0.5 rounded-lg pr-2 ${selected ? "bg-indigo-50 text-indigo-800" : "text-slate-600 hover:bg-slate-100"}`}
            >
              {hasChildren ? (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onToggle(node.id)}
                  aria-label={`${isExpanded ? "Collapse" : "Expand"} ${node.name}`}
                  aria-expanded={isExpanded}
                  className="size-7 shrink-0 text-slate-400 hover:text-slate-700"
                >
                  {isExpanded ? (
                    <ChevronDown size={14} />
                  ) : (
                    <ChevronRight size={14} />
                  )}
                </Button>
              ) : (
                <span className="size-7 shrink-0" aria-hidden="true" />
              )}
              <button
                type="button"
                onClick={() => onOpen(node.id)}
                title={node.name}
                className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md text-left text-[13px] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-indigo-600"
              >
                <Folder
                  size={15}
                  className={`shrink-0 ${selected ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-500"}`}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 truncate">{node.name}</span>
                <span
                  className={`text-[11px] tabular-nums ${selected ? "text-indigo-600" : "text-slate-400"}`}
                >
                  {node.courseCount}
                </span>
              </button>
            </div>
            {hasChildren && isExpanded && (
              <div className="ml-[13px] border-l border-slate-200 pl-1.5">
                <FolderTreeNavigation
                  nodes={node.children}
                  currentFolderId={currentFolderId}
                  expanded={expanded}
                  onToggle={onToggle}
                  onOpen={onOpen}
                />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
