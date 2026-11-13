/* eslint-disable @next/next/no-img-element -- Preview the private course-card asset through its authenticated URL. */
import { Card } from "@/components/ui/card";

export function CourseCardImagePreview({ imageSrc, imageAlt, title }: { imageSrc: string; imageAlt: string; title: string }) {
  return <Card aria-label="Course card image preview" className="max-w-sm overflow-hidden">
    <img src={imageSrc} alt={imageAlt} className="aspect-video w-full object-cover" />
    <p className="break-words p-3 text-sm font-semibold text-slate-900">{title}</p>
  </Card>;
}
