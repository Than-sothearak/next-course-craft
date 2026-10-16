"use client";
import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EmptyState({
  hasFolders,
  query,
  onCreate,
  disabled,
  canCreate = false,
}: {
  hasFolders: boolean;
  query: string;
  onCreate: () => void;
  disabled: boolean;
  canCreate?: boolean;
}) {
  let title = "Your first course starts here";
  let message =
    "Create a course to begin shaping your next learning experience.";
  if (query) {
    title = "No matches found";
    message = "Try another search or adjust the status filter.";
  } else if (hasFolders) {
    title = "No courses in this folder yet";
    message = "Add a course here, or move one in from its menu.";
  }
  if (!canCreate && !query) {
    title = "No courses available yet";
    message = "Courses you own or that are shared with you will appear here. Contact your administrator if you need course access.";
  }
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-indigo-50 text-indigo-600">
        <BookOpen size={22} aria-hidden="true" />
      </span>
      <h3 className="mt-4 font-semibold text-slate-900">{title}</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
        {message}
      </p>
      {!query && canCreate && (
        <Button
          disabled={disabled}
          onClick={onCreate}
          className="mt-5 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-40"
        >
          Create your first course
        </Button>
      )}
    </div>
  );
}
