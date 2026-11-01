"use client";

import { useEffect, useRef } from "react";
import { ChevronDown, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StatementTextEditor } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/(text_editing_components)/statement-text-editor";

type CourseOverviewEditorProps = {
  title: string;
  titleValid: boolean;
  authorVisible: boolean;
  description: string;
  descriptionHtml?: string;
  authorName: string;
  primaryColor: string;
  accentColor: string;
  onTitleChange: (title: string) => void;
  onAuthorVisibilityChange: (visible: boolean) => void;
  onDescriptionChange: (html: string, text: string) => void;
};

export function CourseOverviewEditor({
  title,
  titleValid,
  authorVisible,
  description,
  descriptionHtml,
  authorName,
  primaryColor,
  accentColor,
  onTitleChange,
  onAuthorVisibilityChange,
  onDescriptionChange,
}: CourseOverviewEditorProps) {
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const authorInitials =
    authorName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "CA";

  useEffect(() => {
    const textarea = titleRef.current;
    if (!textarea) return;
    const resize = () => {
      textarea.style.height = "0px";
      textarea.style.height = `${textarea.scrollHeight}px`;
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [title]);

  return (
    <div className="mb-0">
      <label className="block">
        <span className="sr-only">Course title</span>
        <Textarea
          ref={titleRef}
          aria-label="Course title"
          aria-invalid={!titleValid}
          aria-describedby={!titleValid ? "course-title-error" : undefined}
          rows={1}
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
          placeholder="Enter your course title"
          maxLength={160}
          className="h-auto min-h-0 w-full resize-none overflow-hidden whitespace-pre-wrap break-words rounded-none border-0 bg-transparent px-0 py-0 text-[36px] font-bold leading-[1.08] tracking-[-0.035em] text-black shadow-none outline-none placeholder:text-slate-300 focus-visible:ring-0 [overflow-wrap:anywhere] sm:text-[44px]"
        />
      </label>
      {!titleValid && (
        <p id="course-title-error" role="alert" className="mt-2 text-sm text-rose-700">
          Enter a course title before saving.
        </p>
      )}
      <div className="mt-6 flex min-h-11 items-center gap-2.5">
        {authorVisible ? (
          <>
            <span
              aria-hidden="true"
              className="grid size-10 shrink-0 place-items-center rounded-full text-sm font-medium text-white"
              style={{ backgroundColor: accentColor }}
            >
              {authorInitials}
            </span>
            <span className="max-w-[240px] truncate text-sm font-medium text-slate-500">
              {authorName}
            </span>
            <details className="relative">
              <summary
                aria-label="Author options"
                className="grid size-7 cursor-pointer list-none place-items-center rounded-md text-slate-500 hover:bg-slate-100 [&::-webkit-details-marker]:hidden"
              >
                <ChevronDown size={15} />
              </summary>
              <div className="absolute left-0 top-full z-20 mt-1 w-36 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                <button
                  type="button"
                  aria-pressed="true"
                  onClick={() => onAuthorVisibilityChange(false)}
                  className="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-2 text-left text-xs text-slate-700 hover:bg-slate-50"
                >
                  <EyeOff size={13} />
                  Hide author
                </button>
              </div>
            </details>
          </>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onAuthorVisibilityChange(true)}
          >
            <Eye size={15} />
            Show author
          </Button>
        )}
      </div>
      <div
        aria-hidden="true"
        className="mt-14 h-[5px] w-44"
        style={{ backgroundColor: primaryColor }}
      />
      <div className="mt-[4.5rem] text-[16px] leading-[2.2] text-[#202124]">
        <StatementTextEditor
          id="course-description"
          label="Edit course description"
          tag="p"
          placeholder="Describe what learners will learn and who this course is for…"
          html={descriptionHtml}
          text={description}
          className="text-[16px] leading-[2.2]"
          onChange={onDescriptionChange}
        />
      </div>
    </div>
  );
}
