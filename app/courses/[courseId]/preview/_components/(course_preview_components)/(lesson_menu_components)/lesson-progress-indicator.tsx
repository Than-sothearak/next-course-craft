"use client";

import { Check } from "lucide-react";
export function LessonProgressIndicator({
  progress,
  complete,
}: {
  progress: number;
  complete: boolean;
}) {
  if (complete) {
    return <Check aria-label="Lesson complete" size={15} className="mt-0.5 shrink-0" style={{ color: "var(--course-primary, #2f5f9f)" }} />;
  }
  const circumference = 2 * Math.PI * 7;
  return (
    <svg
      role="img"
      aria-label={`Lesson ${progress}% complete`}
      viewBox="0 0 18 18"
      width="16"
      height="16"
      className="mt-0.5 shrink-0 -rotate-90"
    >
      <circle cx="9" cy="9" r="7" fill="none" stroke="#cbd5e1" strokeWidth="2" />
      <circle
        cx="9"
        cy="9"
        r="7"
        fill="none"
        stroke="var(--course-primary, #2f5f9f)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - progress / 100)}
        className="transition-[stroke-dashoffset] duration-150"
      />
    </svg>
  );
}
