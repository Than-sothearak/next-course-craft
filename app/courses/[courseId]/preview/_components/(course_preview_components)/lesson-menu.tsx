"use client";

import * as React from "react";
import { ChevronDown, LockKeyhole, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
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
  initialData: Pick<PreviewData, "title" | "courseLayout">;
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
  const menuScrollRef = React.useRef<HTMLDivElement>(null);
  const activeLessonButtonRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    const viewport = menuScrollRef.current;
    const activeLessonButton = activeLessonButtonRef.current;
    if (!viewport || !activeLessonButton) return;

    const viewportRect = viewport.getBoundingClientRect();
    const lessonRect = activeLessonButton.getBoundingClientRect();
    const lessonTop = viewport.scrollTop + lessonRect.top - viewportRect.top;
    const centeredTop = lessonTop - (viewport.clientHeight - activeLessonButton.offsetHeight) / 2;
    viewport.scrollTo({ top: Math.max(0, centeredTop), behavior: "smooth" });
  }, [selectedLesson?.id, mobile, lessonSearch, collapsedSectionIds]);

  if (!mobile && sidebarCollapsed) return null;
  const slideCourse = initialData.courseLayout === "slides";
  const menuWidth = mobile
    ? `${slideCourse ? "w-[min(84%,240px)]" : "w-[min(84%,320px)]"} shrink-0 shadow-2xl`
    : `${device === "tablet" ? "w-[220px]" : "w-[270px]"} shrink-0 border-r border-slate-200`;
  const normalizedLessonSearch = lessonSearch.trim().toLocaleLowerCase();
  const lessonTitle = (lesson: PreviewLesson) =>
    slideCourse && lesson.id === lessons[0]?.id ? initialData.title : lesson.title;
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
          lessonTitle(lesson).toLocaleLowerCase().includes(normalizedLessonSearch),
        );
    return visibleLessons.length
      ? [{ section, sectionLessons, visibleLessons }]
      : [];
  });
  return (
    <aside
      className={`flex min-h-0 flex-col bg-white ${mobile ? "relative z-10 h-full overflow-hidden" : "overflow-y-auto"} ${menuWidth}`}
    >
      <div className={cn("shrink-0 text-white", slideCourse ? "px-3 py-3" : "px-4 py-5 sm:px-5")} style={{ backgroundColor: "var(--course-primary)" }}>
        <div className="flex items-start justify-between gap-2">
          <p className={cn("font-semibold leading-tight", slideCourse ? "line-clamp-2 text-sm" : "line-clamp-3 text-lg")}>
            {initialData.title}
          </p>
          {mobile && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Close course menu"
              onClick={() => setMobileMenuOpen(false)}
              className={cn("text-white hover:bg-white/15 hover:text-white", slideCourse ? "-mr-1 -mt-1 size-6" : "-mr-2 -mt-2 size-8")}
            >
              <X size={slideCourse ? 13 : 17} />
            </Button>
          )}
        </div>
        <div className={cn("flex items-center justify-between font-semibold uppercase tracking-[0.12em]", slideCourse ? "mt-2.5 text-[9px]" : "mt-5 text-[10px]")}>
          <span>{progress}% complete</span>
          <span>
            {visitedLessonCount}/{lessons.length}
          </span>
        </div>
        <div
          className={cn("overflow-hidden rounded-full bg-white/25", slideCourse ? "mt-1.5 h-1" : "mt-2 h-1.5")}
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
      <div ref={menuScrollRef} className={cn("min-h-0 flex-1 overflow-y-auto", slideCourse ? "py-1" : "py-2")}>
        <div className={slideCourse ? "px-2 pb-2 pt-1" : "px-3 pb-3 pt-1"}>
          <div className="relative">
            <Search
              size={slideCourse ? 13 : 15}
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <Input
              type="search"
              aria-label={slideCourse ? "Search slides and quizzes" : "Search lessons and quizzes"}
              placeholder={slideCourse ? "Search slides" : "Search course content"}
              value={lessonSearch}
              onChange={(event) => setLessonSearch(event.target.value)}
              className={slideCourse ? "h-7 py-1 pl-8 text-[11px]" : "h-9 pl-9 text-xs"}
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
              <h2 className={cn("bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-600", slideCourse ? "px-3 py-1.5" : "px-4 py-2")}>
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
                  className="cursor-pointer flex w-full items-center justify-between gap-2 text-left"
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
                  const title = lessonTitle(lesson);
                  const Icon = lessonIcons[lesson.icon ?? "file"];
                  const active = selectedLesson?.id === lesson.id;
                  const visited = visitedLessonIds.has(lesson.id);
                  const lockMessage = getLessonNavigationLockMessage(lesson.id);
                  const locked = Boolean(lockMessage);
                  return (
                    <li key={lesson.id}>
                      <button
                        type="button"
                        ref={active ? activeLessonButtonRef : undefined}
                        disabled={locked}
                        onClick={() => selectLesson(lesson.id)}
                        aria-current={active ? "page" : undefined}
                        aria-label={`${title}${lockMessage ? `. Locked. ${lockMessage}` : ""}`}
                        title={lockMessage ?? undefined}
                        className={cn("cursor-pointer flex w-full items-start text-left", slideCourse ? "min-h-12 gap-2 px-3 py-2" : "min-h-20 gap-2.5 px-4 py-4", locked ? "cursor-not-allowed opacity-50" : !active && "hover:bg-slate-50")}
                        style={active ? { backgroundColor: "color-mix(in srgb, var(--course-primary) 10%, white)" } : undefined}
                      >
                        <Icon
                          size={slideCourse ? 12 : 14}
                          className="mt-0.5 shrink-0 text-slate-500"
                        />
                        <span className="min-w-0 flex-1">
                          <span
                            className={cn("block truncate whitespace-nowrap", slideCourse ? "text-xs leading-4" : "text-sm leading-5", active ? "font-semibold" : "font-medium text-slate-800")}
                            style={active ? { color: "var(--course-primary)" } : undefined}
                          >
                            {title}
                          </span>
                          <span className={cn("block text-slate-500", slideCourse ? "mt-0.5 text-[10px] leading-3" : "mt-1 text-[11px]")}>
                            {lesson.lessonType === "quiz" ? "Quiz" : slideCourse ? "Slide" : "Lesson"}
                            {locked ? ` · Locked until current ${slideCourse ? "slide" : "lesson"} is complete` : ""}
                          </span>
                        </span>
                        {locked ? (
                          <LockKeyhole size={slideCourse ? 12 : 14} aria-hidden="true" className="mt-1 shrink-0 text-slate-400" />
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
