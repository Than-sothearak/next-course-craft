"use client";

import * as React from "react";
import { ChevronDown, LockKeyhole, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PreviewData, PreviewDevice, PreviewLesson } from "./preview-types";
import { lessonIcons } from "./preview-icons";
import { LessonProgressIndicator } from "./(lesson_menu_components)/lesson-progress-indicator";
export function LessonMenu({
  initialData,
  progress,
  visitedLessonCount,
  lessons,
  sections,
  device,
  sidebarCollapsed,
  collapsedSectionIds,
  lessonSearch,
  selectedLesson,
  lessonScrollProgress,
  visitedLessonIds,
  getLessonNavigationLockMessage,
  selectLesson,
  setCollapsedSectionIds,
  setLessonSearch,
  setMobileMenuOpen,
  mobile = false,
}: {
  initialData: Pick<PreviewData, "title">;
  progress: number;
  visitedLessonCount: number;
  lessons: PreviewData["lessons"];
  sections: PreviewData["sections"];
  device: PreviewDevice;
  sidebarCollapsed: boolean;
  collapsedSectionIds: Set<string>;
  lessonSearch: string;
  selectedLesson: PreviewLesson | null;
  lessonScrollProgress: Record<string, number>;
  visitedLessonIds: Set<string>;
  getLessonNavigationLockMessage: (lessonId: string) => string | null;
  selectLesson: (lessonId: string) => void;
  setCollapsedSectionIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  setLessonSearch: React.Dispatch<React.SetStateAction<string>>;
  setMobileMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  mobile?: boolean;
}) {
  if (!mobile && sidebarCollapsed) return null;
  const menuWidth = mobile
    ? "w-[min(84%,320px)] shrink-0 shadow-2xl"
    : `${device === "tablet" ? "w-[220px]" : "w-[270px]"} shrink-0 border-r border-slate-200`;
  const normalizedLessonSearch = lessonSearch.trim().toLocaleLowerCase();
  const menuSections = sections.flatMap((section) => {
    const sectionLessons = lessons.filter(
      (lesson) => lesson.sectionId === section.id,
    );
    const sectionMatches = section.title
      .toLocaleLowerCase()
      .includes(normalizedLessonSearch);
    const visibleLessons = !normalizedLessonSearch || sectionMatches
      ? sectionLessons
      : sectionLessons.filter((lesson) =>
          lesson.title.toLocaleLowerCase().includes(normalizedLessonSearch),
        );
    return visibleLessons.length
      ? [{ section, sectionLessons, visibleLessons }]
      : [];
  });
  return (
    <aside
      className={`flex min-h-0 flex-col bg-white ${mobile ? "relative z-10 h-full overflow-hidden" : "overflow-y-auto"} ${menuWidth}`}
    >
      <div className="shrink-0 px-4 py-5 text-white sm:px-5" style={{ backgroundColor: "var(--course-primary)" }}>
        <div className="flex items-start justify-between gap-2">
          <p className="line-clamp-3 text-lg font-semibold leading-tight">
            {initialData.title}
          </p>
          {mobile && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Close course menu"
              onClick={() => setMobileMenuOpen(false)}
              className="-mr-2 -mt-2 size-8 text-white hover:bg-white/15 hover:text-white"
            >
              <X size={17} />
            </Button>
          )}
        </div>
        <div className="mt-5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.12em]">
          <span>{progress}% complete</span>
          <span>
            {visitedLessonCount}/{lessons.length}
          </span>
        </div>
        <div
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/25"
          role="progressbar"
          aria-label="Course completion"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <div
            className="h-full rounded-full bg-white transition-[width]"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto py-2">
        <div className="px-3 pb-3 pt-1">
          <div className="relative">
            <Search
              size={15}
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <Input
              type="search"
              aria-label="Search lessons and quizzes"
              placeholder="Search course content"
              value={lessonSearch}
              onChange={(event) => setLessonSearch(event.target.value)}
              className="h-9 pl-9 text-xs"
            />
          </div>
        </div>
        {menuSections.map(({ section, sectionLessons, visibleLessons }) => {
          const completedCount = sectionLessons.filter((lesson) =>
            visitedLessonIds.has(lesson.id),
          ).length;
          const sectionProgress = Math.round(
            (completedCount / sectionLessons.length) * 100,
          );
          const isCollapsed =
            !normalizedLessonSearch && collapsedSectionIds.has(section.id);
          const sectionListId = `lesson-nav-section-${section.id}`;
          return (
            <section key={section.id}>
              <h2 className="bg-slate-50 px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                <button
                  type="button"
                  aria-label={`Toggle section ${section.title}`}
                  aria-expanded={!isCollapsed}
                  aria-controls={sectionListId}
                  onClick={() =>
                    setCollapsedSectionIds((previous) => {
                      const next = new Set(previous);
                      if (next.has(section.id)) next.delete(section.id);
                      else next.add(section.id);
                      return next;
                    })
                  }
                  className="flex w-full items-center justify-between gap-2 text-left"
                >
                  <span className="min-w-0 truncate">{section.title}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="text-[9px] font-medium normal-case tracking-normal text-slate-500">
                      {completedCount}/{sectionLessons.length} complete
                    </span>
                    <ChevronDown
                      size={13}
                      aria-hidden="true"
                      className={`transition-transform ${isCollapsed ? "-rotate-90" : ""}`}
                    />
                  </span>
                </button>
              </h2>
              <div
                role="progressbar"
                aria-label={`${section.title} progress`}
                aria-valuemin={0}
                aria-valuemax={sectionLessons.length}
                aria-valuenow={completedCount}
                className="h-0.5 bg-slate-100"
              >
                <div
                  className="h-full transition-[width]"
                  style={{ width: `${sectionProgress}%`, backgroundColor: "var(--course-primary)" }}
                />
              </div>
              <ul id={sectionListId} hidden={isCollapsed} className="divide-y divide-slate-100">
                {visibleLessons.map((lesson) => {
                  const Icon = lessonIcons[lesson.icon ?? "file"];
                  const active = selectedLesson?.id === lesson.id;
                  const visited = visitedLessonIds.has(lesson.id);
                  const lockMessage = getLessonNavigationLockMessage(lesson.id);
                  const locked = Boolean(lockMessage);
                  return (
                    <li key={lesson.id}>
                      <button
                        type="button"
                        disabled={locked}
                        onClick={() => selectLesson(lesson.id)}
                        aria-current={active ? "page" : undefined}
                        aria-label={`${lesson.title}${lockMessage ? `. Locked. ${lockMessage}` : ""}`}
                        title={lockMessage ?? undefined}
                        className={`flex min-h-20 w-full items-start gap-2.5 px-4 py-4 text-left ${locked ? "cursor-not-allowed opacity-50" : active ? "" : "hover:bg-slate-50"}`}
                        style={active ? { backgroundColor: "color-mix(in srgb, var(--course-primary) 10%, white)" } : undefined}
                      >
                        <Icon
                          size={14}
                          className="mt-0.5 shrink-0 text-slate-500"
                        />
                        <span className="min-w-0 flex-1">
                          <span
                            className={`block truncate whitespace-nowrap text-sm leading-5 ${active ? "font-semibold" : "font-medium text-slate-800"}`}
                            style={active ? { color: "var(--course-primary)" } : undefined}
                          >
                            {lesson.title}
                          </span>
                          <span className="mt-1 block text-[11px] text-slate-500">
                            {lesson.lessonType === "quiz" ? "Quiz" : "Lesson"}
                            {locked ? " · Locked until current lesson is complete" : ""}
                          </span>
                        </span>
                        {locked ? (
                          <LockKeyhole size={14} aria-hidden="true" className="mt-1 shrink-0 text-slate-400" />
                        ) : (
                          <LessonProgressIndicator
                            progress={lessonScrollProgress[lesson.id] ?? 0}
                            complete={visited}
                          />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
        {normalizedLessonSearch && menuSections.length === 0 && (
          <p className="px-4 py-6 text-center text-xs text-slate-500">
            No lessons or quizzes match that search.
          </p>
        )}
      </div>
    </aside>
  );
  }
