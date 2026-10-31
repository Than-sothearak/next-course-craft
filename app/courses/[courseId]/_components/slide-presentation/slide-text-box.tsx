import type { CSSProperties, ReactNode } from "react";
import type { ContentBlock } from "@/lib/schemas/block";
import { resolveSlideTextLayout } from "@/lib/editor/slide-design";
import { blockSurfaceStyle } from "../../preview/_components/(course_preview_components)/preview-utils";

export function SlideTextBox({ block, children }: { block: ContentBlock; children: ReactNode }) {
  const layout = resolveSlideTextLayout(block.slideTextLayout);
  return (
    <div
      data-slide-text-box
      data-horizontal-align={layout?.horizontal}
      data-vertical-align={layout?.vertical ?? "top"}
      className="flex min-h-full w-full flex-col"
      style={{
        ...blockSurfaceStyle(block, true),
        paddingTop: `${layout.paddingY}px`,
        paddingRight: `${layout.paddingX}px`,
        paddingBottom: `${layout.paddingY}px`,
        paddingLeft: `${layout.paddingX}px`,
        justifyContent: layout?.vertical === "middle" ? "center" : layout?.vertical === "bottom" ? "flex-end" : "flex-start",
        textAlign: layout?.horizontal,
        "--slide-text-align": layout?.horizontal,
      } as CSSProperties}
    >
      <div className="w-full shrink-0" style={{ backgroundImage: "var(--slide-text-paint, none)", backgroundClip: "text", WebkitBackgroundClip: "text", color: "var(--slide-text-fill, inherit)" }}>{children}</div>
    </div>
  );
}
