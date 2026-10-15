/* eslint-disable @next/next/no-img-element -- Shared by author settings and the static learner export. */
import type { ReactNode } from "react";
import { normalizeCourseCover, type CourseCover } from "@/lib/editor/course-cover";
import { CoverDecoration } from "./(course_cover_components)/cover-decoration";

export function CourseCover({ cover: input, primaryColor, accentColor, children, className = "" }: {
  cover?: CourseCover; primaryColor: string; accentColor: string; children: ReactNode; className?: string;
}) {
  const cover = normalizeCourseCover(input);
  const backgroundColor = cover.backgroundColor ?? primaryColor;
  const gradient = cover.template === "gradient" || (cover.template === "image" && !cover.imageSrc);
  return <div data-course-cover={cover.template} className={`relative isolate min-w-0 overflow-hidden ${className}`} style={{
    color: cover.textColor, textAlign: cover.alignment, backgroundColor,
    backgroundImage: gradient ? `radial-gradient(ellipse at 100% 0%, color-mix(in srgb, ${accentColor} 25%, transparent), transparent 60%), linear-gradient(135deg, color-mix(in srgb, ${backgroundColor} 72%, #0f172a), color-mix(in srgb, ${backgroundColor} 18%, #020617))` : undefined,
  }}>
    {cover.template === "image" && cover.imageSrc && <>
      <img src={cover.imageSrc} alt={cover.imageAlt} className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: cover.imagePosition }} />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-black" style={{ opacity: cover.overlayOpacity / 100 }} />
    </>}
    <CoverDecoration template={cover.template} accentColor={accentColor} />
    <div className="relative z-10 min-w-0 [overflow-wrap:anywhere]">{children}</div>
  </div>;
}
