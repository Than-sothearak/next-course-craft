import type { CourseCover } from "@/lib/editor/course-cover";

export function CoverDecoration({ template, accentColor }: { template: CourseCover["template"]; accentColor: string }) {
  if (template === "waves") return <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1200 500" preserveAspectRatio="none">
    <path d="M0 370C230 180 440 530 740 300S1060 160 1200 240V500H0Z" fill={accentColor} opacity=".3" />
    <path d="M0 430C280 270 490 570 820 370S1100 310 1200 340V500H0Z" fill="white" opacity=".12" />
    <circle cx="1080" cy="70" r="150" fill="white" opacity=".05" />
  </svg>;
  if (template === "geometric") return <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
    <div className="absolute -right-12 -top-24 h-[150%] w-1/3 rotate-[25deg] opacity-25" style={{ backgroundColor: accentColor }} />
    <div className="absolute -bottom-20 -left-20 size-64 rounded-full border-[36px] border-white/10" />
    <div className="absolute right-[12%] top-[18%] size-16 rotate-12 rounded-xl border-2 border-white/25" />
  </div>;
  if (template === "editorial") return <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
    <div className="absolute inset-y-0 left-0 w-3" style={{ backgroundColor: accentColor }} />
    <div className="absolute -right-16 top-1/2 size-80 -translate-y-1/2 rounded-full border border-white/15" />
    <div className="absolute -right-6 top-1/2 size-60 -translate-y-1/2 rounded-full border border-white/10" />
    <div className="absolute inset-x-8 top-6 h-px bg-white/20" />
  </div>;
  return null;
}
