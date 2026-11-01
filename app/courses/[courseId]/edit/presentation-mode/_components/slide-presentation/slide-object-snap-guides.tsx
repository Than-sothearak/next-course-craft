import type { SlideSnapGuide } from "@/lib/editor/slide-alignment";

export function SlideObjectSnapGuides({ guides }: { guides: SlideSnapGuide[] }) {
  return <>{guides.map((guide) => <div key={guide.id} data-slide-snap-guide={guide.id} data-slide-footer-guide={guide.id === "footer" || undefined}
    className={`pointer-events-none absolute z-[1001] ${guide.axis === "x" ? "inset-y-0 border-l" : "inset-x-0 border-t"} border-indigo-500`}
    style={guide.axis === "x" ? { left: `${guide.position}%` } : { top: `${guide.position}%` }}>
    <span className={`absolute whitespace-nowrap rounded bg-indigo-600 px-2 py-1 text-[10px] text-white ${guide.axis === "x" ? `top-2 ${guide.position > 90 ? "right-1" : "left-1"}` : `right-2 ${guide.position < 5 ? "top-1" : "bottom-1"}`}`}>Snapped to {guide.label.toLowerCase()}</span>
  </div>)}{guides.length > 0 && <span role="status" className="sr-only">Snapped to {guides.map((guide) => guide.label.toLowerCase()).join(" and ")}</span>}</>;
}
