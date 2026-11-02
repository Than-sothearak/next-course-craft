"use client";
import { ChevronDown, ChevronRight, Folder } from "lucide-react";
import type { DashboardFilters, FolderTreeNode } from "@/lib/dashboard/types";
import { dashboardHref } from "@/lib/dashboard/query";
import { Button } from "@/components/ui/button";
import { DashboardLink } from "../../dashboard-link";

export function FolderTreeNavigation({
  nodes,
  filters,
  expanded,
  onToggle,
  onNavigate,
  depth = 0,
}: {
  nodes: FolderTreeNode[];
  filters: DashboardFilters;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onNavigate?: () => void;
  depth?: number;
}) {
  return (
    <ul className="min-w-0 space-y-0.5" role={depth === 0 ? "tree" : "group"} aria-label={depth === 0 ? "Folders" : undefined}>
      {nodes.map((node) => {
        const hasChildren = node.children.length > 0;
        const isExpanded = expanded.has(node.id);
        const selected = filters.folderId === node.id;
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
                  className="size-9 shrink-0 text-slate-400 hover:text-slate-700 lg:size-7"
                >
                  {isExpanded ? (
                    <ChevronDown size={14} />
                  ) : (
                    <ChevronRight size={14} />
                  )}
                </Button>
              ) : (
                <span className="size-9 shrink-0 lg:size-7" aria-hidden="true" />
              )}
              <DashboardLink
                href={dashboardHref({ ...filters, folderId: node.id })}
                onClick={onNavigate}
                aria-current={selected ? "page" : undefined}
                title={node.name}
                className="cursor-pointer flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-md text-left text-[13px] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-indigo-600 lg:min-h-9"
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
              </DashboardLink>
            </div>
            {hasChildren && isExpanded && (
              <div className={depth < 4 ? "ml-[13px] min-w-0 border-l border-slate-200 pl-1.5" : "ml-1 min-w-0 border-l border-slate-200 pl-1"}>
                <FolderTreeNavigation
                  nodes={node.children}
                  filters={filters}
                  expanded={expanded}
                  onToggle={onToggle}
                  onNavigate={onNavigate}
                  depth={depth + 1}
                />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
