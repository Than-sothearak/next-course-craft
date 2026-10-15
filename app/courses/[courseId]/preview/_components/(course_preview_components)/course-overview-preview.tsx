"use client";

import { ArrowRight, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CourseCover } from "@/components/course-cover";
import { normalizeCourseTheme } from "@/lib/editor/theme";
import { StatementTextPreview } from "../../../edit/_components/statement-text-preview";
import { lessonIcons } from "./preview-icons";
import type {
  PreviewData,
  PreviewDevice,
  PreviewLesson,
  PreviewSection,
} from "./preview-types";

type CourseOverviewPreviewProps = {
  initialData: PreviewData;
  authorName: string;
  initials: string;
  device: PreviewDevice;
  lessons: PreviewLesson[];
  sections: PreviewSection[];
  startLearning: () => void;
  selectLesson: (lessonId: string) => void;
  getLessonNavigationLockMessage: (lessonId: string) => string | null;
};

export function CourseOverviewPreview({
  initialData,
  authorName,
  initials,
  device,
  lessons,
  sections,
  startLearning,
  selectLesson,
  getLessonNavigationLockMessage,
}: CourseOverviewPreviewProps) {
  const theme = normalizeCourseTheme(initialData.theme);
  return (
    <div className="h-full overflow-y-auto">
      <section aria-label="Course cover" className="@container/course-cover">
        <CourseCover cover={theme.cover} primaryColor={theme.primaryColor} accentColor={theme.accentColor}
          className="px-5 py-12 @min-[40rem]/course-cover:px-10 @min-[48rem]/course-cover:py-24">
        <div className="mx-auto max-w-5xl">
          {initialData.authorVisible && (
            <div className="mb-6 inline-flex items-center gap-2.5 text-sm font-medium opacity-90">
              <span
                className="grid size-9 place-items-center rounded-full text-xs font-semibold"
                style={{ backgroundColor: "var(--course-accent)" }}
              >
                {initials}
              </span>
              <span>{authorName}</span>
            </div>
          )}
          <StatementTextPreview
            tag="h3"
            text={initialData.title}
            className="mx-auto text-3xl font-bold tracking-tight text-inherit @min-[40rem]/course-cover:text-4xl @min-[56rem]/course-cover:text-6xl [&_h1]:my-0 [&_h1]:text-inherit [&_h1]:font-bold [&_h1]:tracking-tight [&_h2]:my-0 [&_h2]:text-inherit [&_h2]:font-bold [&_h2]:tracking-tight [&_h3]:my-0 [&_h3]:text-inherit [&_h3]:font-bold [&_p]:my-0 [&_p]:text-inherit [&_p]:font-bold"
          />
          {lessons.length > 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={startLearning}
              className="mt-8 min-w-36 rounded-full border-white bg-white text-slate-950 hover:bg-slate-100"
            >
              Start learning
            </Button>
          )}
        </div>
        </CourseCover>
      </section>
      <div
        className={`mx-auto max-w-5xl px-5 ${device === "mobile" ? "py-8" : "py-12 sm:px-10 sm:py-16"}`}
      >
        {initialData.description.trim() && (
          <section
            aria-label="Course description"
            className="mx-auto mb-14 max-w-3xl text-slate-700"
          >
            <StatementTextPreview
              tag="p"
              text={initialData.description}
              html={initialData.descriptionHtml}
              className="text-base leading-8 [&_h1]:my-4 [&_h2]:my-3 [&_h3]:my-2 [&_p]:my-3"
            />
          </section>
        )}
        <section
          aria-labelledby="preview-course-content"
          className="mx-auto max-w-3xl"
        >
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-3">
            <div>
              <p
                className="text-xs font-semibold uppercase tracking-[0.14em]"
                style={{ color: "var(--course-primary)" }}
              >
               Content outline
              </p>
              <h2
                id="preview-course-content"
                className="mt-1 text-2xl font-bold tracking-tight"
              >
                What you’ll learn
              </h2>
            </div>
            <span className="text-sm text-slate-500">
              {lessons.length} content {lessons.length === 1 ? "item" : "items"}
            </span>
          </div>
          {lessons.length ? (
            <div className="space-y-8">
              {sections.map((section) => {
                const sectionLessons = lessons.filter(
                  (lesson) => lesson.sectionId === section.id,
                );
                if (!sectionLessons.length) return null;
                return (
                  <section key={section.id}>
                    <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                      {section.title}
                    </h3>
                    <div className="divide-y divide-slate-200 border-y border-slate-200">
                      {sectionLessons.map((lesson) => {
                        const Icon = lessonIcons[lesson.icon ?? "file"];
                        const lockMessage = getLessonNavigationLockMessage(
                          lesson.id,
                        );
                        const locked = Boolean(lockMessage);
                        return (
                          <button
                            key={lesson.id}
                            type="button"
                            disabled={locked}
                            onClick={() => selectLesson(lesson.id)}
                            aria-label={`${lesson.title}${lockMessage ? `. Locked. ${lockMessage}` : ""}`}
                            title={lockMessage ?? undefined}
                            className={`flex min-h-16 w-full items-start gap-3 px-2 py-3 text-left ${locked ? "cursor-not-allowed opacity-50" : "hover:bg-slate-50"}`}
                          >
                            <Icon
                              size={17}
                              className="mt-0.5 shrink-0 text-slate-500"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold text-slate-900">
                                {lesson.title}
                              </span>
                              <span className="mt-1 block text-xs text-slate-500">
                                {lesson.lessonType === "quiz"
                                  ? "Quiz"
                                  : "Lesson"}
                              </span>
                            </span>
                            {locked ? (
                              <LockKeyhole
                                size={15}
                                aria-hidden="true"
                                className="shrink-0 text-slate-400"
                              />
                            ) : (
                              <ArrowRight
                                size={16}
                                className="shrink-0 text-slate-400"
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-slate-300 px-5 py-8 text-center text-sm text-slate-500">
              Course content will appear here when it is added.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
