"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  LayoutGrid,
  List,
  Search,
  X,
} from "lucide-react";
import type { DashboardData, FolderTreeNode } from "@/lib/dashboard/types";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { DashboardDialogs } from "./_components/dashboard-dialogs";
import { CourseCard } from "./_components/course-card";
import { DashboardActions } from "./_components/dashboard-actions";
import { DashboardNavbar } from "./_components/dashboard-navbar";
import { DashboardSidebar } from "./_components/dashboard-sidebar";
import { EmptyState } from "./_components/empty-state";
import { FolderCard } from "./_components/folder-card";
import { useDismissDetailsOnOutsideClick } from "@/lib/ui/use-dismiss-details";

type Props = {
  initialData: DashboardData;
  initialFolderId: string | null;
  initialQuery: string;
  initialStatus: string;
  initialSort: string;
  initialError: string | null;
  userName: string;
};

function expandedFolderIds(nodes: FolderTreeNode[]): Set<string> {
  const expanded = new Set<string>();
  for (const node of nodes) {
    if (node.children.length) expanded.add(node.id);
    for (const id of expandedFolderIds(node.children)) expanded.add(id);
  }
  return expanded;
}

export default function DashboardClient({
  initialData,
  initialFolderId,
  initialQuery,
  initialStatus,
  initialSort,
  initialError,
  userName,
}: Props) {
  useDismissDetailsOnOutsideClick();
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [folderId, setFolderId] = useState(initialFolderId);
  const [query, setQuery] = useState(initialQuery);
  const [status, setStatus] = useState(initialStatus);
  const [sort, setSort] = useState(initialSort);
  const [folderView, setFolderView] = useState<"grid" | "list">("grid");
  const [expandedFolders, setExpandedFolders] = useState(() =>
    expandedFolderIds(initialData.folderTree),
  );
  const [error, setError] = useState(initialError);
  const [deletedCourse, setDeletedCourse] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [showNewCourse, setShowNewCourse] = useState(false);

  useEffect(() => {
    if (initialError) return;
    const timer = setTimeout(async () => {
      const params = new URLSearchParams({ status, sort, q: query });
      if (folderId) params.set("folderId", folderId);
      try {
        const response = await fetch(`/api/dashboard?${params.toString()}`, {
          cache: "no-store",
        });
        const body = await response.json();
        if (!response.ok)
          throw new Error(body.error ?? "Could not load courses.");
        setData(body as DashboardData);
        setError(null);
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : "Could not load courses.",
        );
      }
    }, 180);
    return () => clearTimeout(timer);
  }, [folderId, initialError, query, sort, status]);

  async function refresh() {
    const params = new URLSearchParams({ status, sort, q: query });
    if (folderId) params.set("folderId", folderId);
    const response = await fetch(`/api/dashboard?${params.toString()}`, {
      cache: "no-store",
    });
    const body = await response.json();
    if (!response.ok)
      throw new Error(body.error ?? "Could not refresh your workspace.");
    setData(body as DashboardData);
  }

  async function request(url: string, method: string, body?: unknown) {
    if (initialError) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error ?? "That change could not be saved.");
      }
      if (method === "DELETE" && url.startsWith("/api/courses/")) {
        const courseId = url.split("/").at(-1);
        const course = data.courses.find((item) => item.id === courseId);
        if (course) setDeletedCourse({ id: course.id, title: course.title });
      }
      await refresh();
      if (url.endsWith("/restore")) setDeletedCourse(null);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "That change could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function submit(
    event: FormEvent<HTMLFormElement>,
    url: string,
    method: string,
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload: Record<string, string | null> = {};
    form.forEach((value, key) => {
      payload[key] = String(value);
    });
    if (payload.folderId === "") payload.folderId = null;
    if (payload.parentId === "") payload.parentId = null;
    if (payload.coverImage === "") payload.coverImage = null;
    await request(url, method, payload);
    if (method === "POST" && url === "/api/folders") setShowNewFolder(false);
    if (method === "POST" && url === "/api/courses") setShowNewCourse(false);
  }

  function navigateToFolder(nextFolderId: string | null) {
    setFolderId(nextFolderId);
    const params = new URLSearchParams();
    if (nextFolderId) params.set("folderId", nextFolderId);
    router.push(params.size ? `/dashboard?${params.toString()}` : "/dashboard");
  }

  const currentFolderId = data.currentFolder?.id ?? folderId;
  const disabled = Boolean(initialError) || busy;

  return (
    <main className="flex min-h-screen flex-col bg-[#f7f8fc] text-slate-900">
      <DashboardNavbar userName={userName} />

      <div className="grid flex-1 lg:grid-cols-[260px_minmax(0,1fr)]">
        <DashboardSidebar data={data} currentFolderId={currentFolderId} expandedFolders={expandedFolders} disabled={disabled} onToggleFolder={(id) => setExpandedFolders((previous) => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; })} onOpenFolder={navigateToFolder} onNewFolder={() => setShowNewFolder(true)} onNewCourse={() => setShowNewCourse(true)} />

        <section className="min-w-0 px-5 py-7 sm:px-8 lg:px- xl:p-4">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-[34px]">
                Good to see you, {userName.split(" ")[0]}
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                Organize your workspace and pick up where you left off.
              </p>
            </div>
            <DashboardActions disabled={disabled} onNewFolder={() => setShowNewFolder(true)} onNewCourse={() => setShowNewCourse(true)} />
          </div>

          {error && (
            <div
              role="alert"
              className="mt-6 flex items-start justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
            >
              <p>{error}</p>
              {!initialError && (
                <button
                  onClick={() => setError(null)}
                  className="rounded p-0.5 hover:bg-amber-100"
                  aria-label="Dismiss message"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          )}
          {deletedCourse && (
            <div
              role="status"
              className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950"
            >
              <span>â€œ{deletedCourse.title}â€ moved to recently deleted.</span>
              <button
                onClick={() =>
                  void request(
                    `/api/courses/${deletedCourse.id}/restore`,
                    "POST",
                  )
                }
                disabled={busy}
                className="shrink-0 rounded-md px-2 py-1 font-semibold text-emerald-800 underline underline-offset-2 hover:bg-emerald-100 disabled:opacity-50"
              >
                Undo
              </button>
            </div>
          )}

          <DashboardDialogs
            openFolder={showNewFolder}
            openCourse={showNewCourse}
            data={data}
            busy={busy}
            onCloseFolder={() => setShowNewFolder(false)}
            onCloseCourse={() => setShowNewCourse(false)}
            onSubmit={submit}
          />

          <div className="mt-8 flex flex-wrap items-center gap-3 text-sm">
            <nav
              aria-label="Breadcrumb"
              className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto text-slate-500"
            >
              {data.breadcrumbs.map((crumb, index) => (
                <span
                  key={crumb.id ?? "root"}
                  className="inline-flex shrink-0 items-center gap-1"
                >
                  {index > 0 && <ChevronRight size={15} aria-hidden="true" />}
                  {index === data.breadcrumbs.length - 1 ? (
                    <span
                      aria-current="page"
                      className="max-w-48 truncate font-semibold text-slate-800"
                    >
                      {crumb.name}
                    </span>
                  ) : (
                    <button
                      onClick={() => navigateToFolder(crumb.id)}
                      className="max-w-48 truncate rounded px-1 py-0.5 hover:bg-white hover:text-indigo-700"
                    >
                      {crumb.name}
                    </button>
                  )}
                </span>
              ))}
            </nav>
            <label className="relative min-w-[210px] flex-1 sm:max-w-xs">
              <span className="sr-only">Search courses and folders</span>
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search courses and folders"
                className="pl-9 pr-3"
              />
            </label>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span>
                {data.folders.length}{" "}
                {data.folders.length === 1 ? "folder" : "folders"}
              </span>
              <span>
                {data.courses.length}{" "}
                {data.courses.length === 1 ? "course" : "courses"}
              </span>
            </div>
            <div className="flex gap-2">
              <label>
                <span className="sr-only">Filter course status</span>
                <Select
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  className="h-9 w-auto px-2.5 text-slate-600"
                >
                  <option value="all">All statuses</option>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </Select>
              </label>
              {data.folders.length > 0 && (
                <div
                  role="group"
                  aria-label="Folder view"
                  className="hidden rounded-lg border border-slate-200 bg-white p-0.5 sm:flex"
                >
                  <button
                    onClick={() => setFolderView("grid")}
                    aria-label="Grid view"
                    aria-pressed={folderView === "grid"}
                    className={`rounded-md p-1.5 ${folderView === "grid" ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:bg-slate-50"}`}
                  >
                    <LayoutGrid size={15} />
                  </button>
                  <button
                    onClick={() => setFolderView("list")}
                    aria-label="List view"
                    aria-pressed={folderView === "list"}
                    className={`rounded-md p-1.5 ${folderView === "list" ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:bg-slate-50"}`}
                  >
                    <List size={15} />
                  </button>
                </div>
              )}
              <label>
                <span className="sr-only">Sort items</span>
                <Select
                  value={sort}
                  onChange={(event) => setSort(event.target.value)}
                  className="h-9 w-auto px-2.5 text-slate-600"
                >
                  <option value="updated">Recently edited</option>
                  <option value="title">Title</option>
                  <option value="created">Date created</option>
                </Select>
              </label>
            </div>
          </div>

          {data.folders.length > 0 && (
            <section className="mt-5" aria-labelledby="folders-title">
              <div className="mb-3 flex items-center justify-between">
                <h2
                  id="folders-title"
                  className="text-sm font-semibold text-slate-700"
                >
                  Folders
                </h2>
                <span className="text-xs text-slate-400">
                  {data.folders.length} shown
                </span>
              </div>
              <div
                className={
                  folderView === "grid"
                  ? "grid gap-3 sm:grid-cols-2 xl:grid-cols-5 2xl:grid-cols-6"
                    : "grid gap-2"
                }
              >
                {data.folders.map((folder) => (
                  <FolderCard
                    key={folder.id}
                    folder={folder}
                    data={data}
                    disabled={disabled}
                    busy={busy}
                    onOpen={() => navigateToFolder(folder.id)}
                    onSubmit={submit}
                    onRequest={request}
                  />
                ))}
              </div>
            </section>
          )}

          <section className="mt-8" aria-labelledby="courses-title">
            <div className="mb-3 flex items-center justify-between">
              <h2
                id="courses-title"
                className="text-sm font-semibold text-slate-700"
              >
                Courses
              </h2>
              <span className="text-xs text-slate-400">Showing up to 200</span>
            </div>
            {data.courses.length ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6">
                {data.courses.map((course) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    data={data}
                    disabled={disabled}
                    busy={busy}
                    onSubmit={submit}
                    onRequest={request}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                hasFolders={data.folders.length > 0}
                query={query}
                onCreate={() => setShowNewCourse(true)}
                disabled={disabled}
              />
            )}
          </section>
        </section>
      </div>
    </main>
  );
}


