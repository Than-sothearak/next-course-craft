import { fitSlideFrame, minimumSlideAudioHeight, type SlideFrame, type SlideSize } from "./slide-design";

export type SlideAlignment = "left" | "center" | "right" | "top" | "middle" | "bottom" | "header" | "footer";
export type SlideSnapGuide = { id: SlideAlignment; axis: "x" | "y"; position: number; label: string };
export type SlideAlignmentLines = { headerBottom?: number; footerTop?: number };

/** Visual bounds account for rotation and the canvas's physical aspect ratio. */
export function slideObjectBounds(frame: SlideFrame, area: SlideSize) {
  const radians = (frame.rotation ?? 0) * Math.PI / 180;
  const cos = Math.abs(Math.cos(radians)), sin = Math.abs(Math.sin(radians));
  const width = frame.width * area.width / 100, height = frame.height * area.height / 100;
  const extentX = (cos * width + sin * height) / area.width * 100;
  const extentY = (sin * width + cos * height) / area.height * 100;
  const center = frame.x + frame.width / 2, middle = frame.y + frame.height / 2;
  return { left: center - extentX / 2, right: center + extentX / 2, top: middle - extentY / 2, bottom: middle + extentY / 2, center, middle };
}

function targets(frame: SlideFrame, area: SlideSize, lines: SlideAlignmentLines) {
  const bounds = slideObjectBounds(frame, area);
  const result: (SlideSnapGuide & { offset: number })[] = [
    { id: "left", axis: "x", position: 0, label: "Left edge", offset: -bounds.left },
    { id: "right", axis: "x", position: 100, label: "Right edge", offset: 100 - bounds.right },
    { id: "center", axis: "x", position: 50, label: "Horizontal center", offset: 50 - bounds.center },
    { id: "top", axis: "y", position: 0, label: "Canvas top", offset: -bounds.top },
    { id: "bottom", axis: "y", position: 100, label: "Canvas bottom", offset: 100 - bounds.bottom },
    { id: "middle", axis: "y", position: 50, label: "Vertical center", offset: 50 - bounds.middle },
  ];
  if (lines.headerBottom !== undefined) result.push({ id: "header", axis: "y", position: lines.headerBottom, label: "Header", offset: lines.headerBottom - bounds.top });
  if (lines.footerTop !== undefined) result.push({ id: "footer", axis: "y", position: lines.footerTop, label: "Footer", offset: lines.footerTop - bounds.bottom });
  return result;
}

export function alignSlideObjectFrame(frame: SlideFrame, alignment: SlideAlignment, area: SlideSize, lines: SlideAlignmentLines = {}): SlideFrame {
  const target = targets(frame, area, lines).find((item) => item.id === alignment);
  if (!target) return frame;
  return fitSlideFrame(frame, target.axis === "x" ? { x: frame.x + target.offset } : { y: frame.y + target.offset }, minimumSlideAudioHeight);
}

/** The tolerance is in screen pixels, independent of canvas size and editor zoom. */
export function snapSlideObjectFrame(frame: SlideFrame, area: SlideSize, displayed: SlideSize, lines: SlideAlignmentLines = {}, distance = 8): { frame: SlideFrame; guides: SlideSnapGuide[] } {
  if (displayed.width <= 0 || displayed.height <= 0) return { frame, guides: [] };
  let next = frame;
  const guides: SlideSnapGuide[] = [];
  for (const axis of ["x", "y"] as const) {
    const extent = axis === "x" ? displayed.width : displayed.height;
    const candidates = targets(next, area, lines).filter((target) => target.axis === axis && !(target.id === "footer" && target.position === 100) && Math.abs(target.offset) / 100 * extent <= distance + .000001)
      .sort((a, b) => Math.abs(a.offset) - Math.abs(b.offset));
    for (const candidate of candidates) {
      const aligned = alignSlideObjectFrame(next, candidate.id, area, lines);
      const actual = targets(aligned, area, lines).find((item) => item.id === candidate.id)!;
      // Do not show a guide when canvas constraints prevented exact alignment.
      if (Math.abs(actual.offset) > .000001) continue;
      next = aligned;
      guides.push({ id: candidate.id, axis, position: candidate.position, label: candidate.label });
      break;
    }
  }
  return { frame: next, guides };
}
