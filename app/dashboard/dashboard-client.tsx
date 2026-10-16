"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ChevronRight, LayoutGrid, List, Search, X, Users, Plus } from "lucide-react";
import type { DashboardData } from "@/lib/dashboard/types";
import { dashboardQueryKey } from "@/lib/dashboard/query";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { DashboardDialogs } from "./_components/(dashboard_client_components)/dashboard-dialogs";
import { CourseCard } from "./_components/(dashboard_client_components)/course-card";
import { DashboardActions } from "./_components/(dashboard_client_components)/dashboard-actions";
import { useDashboard } from "./_components/dashboard-provider";
import { DashboardCoursesSkeleton, DashboardFoldersSkeleton } from "./_components/dashboard-skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { EmptyState } from "./_components/(dashboard_client_components)/empty-state";
import { FolderCard } from "./_components/(dashboard_client_components)/folder-card";
import { useDismissDetailsOnOutsideClick } from "@/lib/ui/use-dismiss-details";
import { WorkspaceManagerDialog } from "./_components/workspace-manager-dialog";

type Props = {
  initialData: DashboardData;
  initialError: string | null;
  userName: string;
};

export default function DashboardClient({
  initialData,
  initialError,
  userName,
}: Props) {
  useDismissDetailsOnOutsideClick();
  const { filters, setFilters, setNavigation, navigating, navigateToFolder, navigateToWorkspace, busy, setBusy, showNewFolder, setShowNewFolder, showNewCourse, setShowNewCourse, showWorkspaceManager, setShowWorkspaceManager } = useDashboard();
  const { q: query, status, sort } = filters;
  const queryKey = dashboardQueryKey(filters);
  const [data, setData] = useState(initialData);
  const [folderView, setFolderView] = useState<"grid" | "list">("grid");
  const [loadedQueryKey, setLoadedQueryKey] = useState(queryKey);
  const [failedQueryKey, setFailedQueryKey] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const requestSequence = useRef(0);
  const [error, setError] = useState(initialError);
  const [deletedCourse, setDeletedCourse] = useState<{
    id: string;
    title: string;
  } | null>(null);
  useEffect(() => {
    // The streamed server data is already current; fetch only after filters change.
    if (initialError || busy || queryKey === loadedQueryKey) return;
    const controller = new AbortController();
    const sequence = ++requestSequence.current;
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/dashboard?${queryKey}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const body = await response.json();
        if (!response.ok)
          throw new Error(body.error ?? "Could not load courses.");
        if (controller.signal.aborted || sequence !== requestSequence.current) return;
        setData(body as DashboardData);
        setNavigation(body as DashboardData);
        setLoadedQueryKey(queryKey);
        setFailedQueryKey(null);
        setError(null);
      } catch (cause) {
        if (controller.signal.aborted || sequence !== requestSequence.current) return;
        setFailedQueryKey(queryKey);
        setError(
          cause instanceof Error ? cause.message : "Could not load courses.",
        );
      }
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [queryKey, loadedQueryKey, initialError, busy, retry, setNavigation]);

  async function refresh() {
    const response = await fetch(`/api/dashboard?${queryKey}`, {
      cache: "no-store",
    });
    const body = await response.json();
    if (!response.ok)
      throw new Error(body.error ?? "Could not refresh your workspace.");
    setData(body as DashboardData);
    setNavigation(body as DashboardData);
    setLoadedQueryKey(queryKey);
    setFailedQueryKey(null);
  }

  async function request(url: string, method: string, body?: unknown) {
    if (initialError) return;
    ++requestSequence.current;
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
    if (url === "/api/folders" || url === "/api/courses") payload.workspaceId = filters.workspaceId;
    await request(url, method, payload);
    if (method === "POST" && url === "/api/folders") setShowNewFolder(false);
    if (method === "POST" && url === "/api/courses") setShowNewCourse(false);
  }

  const disabled = Boolean(initialError) || busy || navigating;
  const readOnly = data.workspaceRole === "viewer" || !data.permissions?.includes("courses.edit");
  const canCreate = !readOnly && Boolean(data.permissions?.includes("courses.create"));
  const unavailable = failedQueryKey === queryKey && loadedQueryKey !== queryKey;
  const loading = navigating || (loadedQueryKey !== queryKey && !unavailable);

  return (
    <section className="min-w-0 px-5 py-7 sm:px-8 lg:px-8 xl:p-4">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-[34px]">
            Good to see you, {userName.split(" ")[0]}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Organize your workspace and pick up where you left off.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 lg:hidden">
            <label><span className="sr-only">Switch workspace</span><Select value={filters.workspaceId ?? ""} disabled={disabled} onChange={(event) => navigateToWorkspace(event.target.value || null)} className="h-9 max-w-52"><option value="">Personal</option>{data.workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}</Select></label>
            {data.permissions?.includes("workspaces.manage") && <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => setShowWorkspaceManager(true)}><Plus size={15} />Team</Button>}
            {data.permissions?.includes("workspaces.manage") && filters.workspaceId && (data.workspaceRole === "owner" || data.workspaceRole === "admin") && <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => setShowWorkspaceManager(true)} aria-label="Manage team"><Users size={15} /></Button>}
          </div>
          {canCreate && <DashboardActions
            disabled={disabled || readOnly}
            onNewFolder={() => setShowNewFolder(true)}
            onNewCourse={() => setShowNewCourse(true)}
          />}
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-6 flex items-start justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
        >
          <p>{error}</p>
          {unavailable && <Button variant="outline" size="sm" onClick={() => { setFailedQueryKey(null); setError(null); setRetry((value) => value + 1); }}>Retry</Button>}
          {!initialError && !unavailable && (
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

      <WorkspaceManagerDialog
        key={filters.workspaceId ?? "create-workspace"}
        open={showWorkspaceManager}
        workspaceId={filters.workspaceId}
        role={data.workspaceRole}
        onClose={() => setShowWorkspaceManager(false)}
        onCreated={(workspace) => { setShowWorkspaceManager(false); navigateToWorkspace(workspace.id); }}
      />

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
          {loading || unavailable ? <Skeleton className="h-5 w-32" /> : data.breadcrumbs.map((crumb, index) => (
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
            disabled={disabled}
            onChange={(event) => setFilters({ ...filters, q: event.target.value })}
            placeholder="Search courses and folders"
            className="pl-9 pr-3"
          />
        </label>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          {loading || unavailable ? <Skeleton className="h-4 w-32" /> : <>
          <span>
            {data.folders.length}{" "}
            {data.folders.length === 1 ? "folder" : "folders"}
          </span>
          <span>
            {data.courses.length}{" "}
            {data.courses.length === 1 ? "course" : "courses"}
          </span>
          </>}
        </div>
        <div className="flex gap-2">
          <label>
            <span className="sr-only">Filter course status</span>
            <Select
              aria-label="Filter course status"
              value={status}
              disabled={disabled}
              onChange={(event) => setFilters({ ...filters, status: event.target.value as typeof status })}
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
              aria-label="Sort courses"
              value={sort}
              disabled={disabled}
              onChange={(event) => setFilters({ ...filters, sort: event.target.value as typeof sort })}
              className="h-9 w-auto px-2.5 text-slate-600"
            >
              <option value="updated">Recently edited</option>
              <option value="title">Title</option>
              <option value="created">Date created</option>
            </Select>
          </label>
        </div>
      </div>

      {loading ? <>
        <p role="status" className="sr-only">Loading your folders and courses…</p>
        <DashboardFoldersSkeleton view={folderView} />
        <DashboardCoursesSkeleton />
      </> : !unavailable && <>
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
                ? "grid gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
                : "grid gap-2"
            }
          >
            {data.folders.map((folder) => (
              <FolderCard
                key={folder.id}
                folder={folder}
                data={data}
                disabled={disabled || readOnly}
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
                key={`${course.id}:${data.workspaceId ?? "personal"}`}
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
            canCreate={canCreate}
            hasFolders={data.folders.length > 0}
            query={query}
            onCreate={() => setShowNewCourse(true)}
            disabled={disabled || readOnly}
          />
        )}
      </section>
      </>}
    </section>
  );
}
