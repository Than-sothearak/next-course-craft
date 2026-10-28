import type { CSSProperties, ReactNode } from "react";
import { defaultSlideMaster, type SlideMaster } from "@/lib/editor/slide-design";

export function SlideSurface({ master, title, number, total, controls, menuControl, children }: {
  master?: SlideMaster;
  title: ReactNode;
  number: number;
  total: number;
  controls?: ReactNode;
  menuControl?: ReactNode;
  children: ReactNode;
}) {
  const design = master ?? defaultSlideMaster;
  const background = design.template === "gradient"
    ? `radial-gradient(circle at 92% 8%, ${design.accentColor}55, transparent 42%), ${design.backgroundColor}`
    : design.backgroundColor;
  return (
    <div className="relative h-full w-full overflow-hidden" style={{ background, color: design.textColor, "--course-accent": design.accentColor, "--course-primary": design.accentColor } as CSSProperties}>
      <div className="absolute inset-x-0 top-0 h-2" style={{ backgroundColor: design.accentColor }} />
      <header className={`absolute top-9 min-h-14 text-[32px] font-bold leading-tight tracking-tight ${menuControl ? "left-16 right-16" : "left-12 right-12"}`}>{title}</header>
      <div className="absolute inset-x-0 bottom-[78px] top-[108px] overflow-auto">{children}</div>
      <footer className="absolute bottom-11 left-12 right-12 flex items-center justify-between border-t pt-2 text-xs opacity-65" style={{ borderColor: design.accentColor }}>
        <span>{design.footerText}</span>
        {design.showSlideNumber && <span>{number} / {total}</span>}
      </footer>
      {controls}
      {menuControl}
    </div>
  );
}
