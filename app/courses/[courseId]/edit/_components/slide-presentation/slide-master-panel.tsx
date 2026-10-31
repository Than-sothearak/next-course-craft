"use client";

import { ColorPicker } from "@/components/ui/color-picker";
import { Button } from "@/components/ui/button";
import { CircleHelp, Image, Monitor, MousePointer2, Palette, PanelBottom, PanelTop, Type } from "lucide-react";
import { defaultSlideBodyTypography, defaultSlideMaster, resolveSlideSize, slideMasterPresets, type SlideMaster } from "@/lib/editor/slide-design";
import { SlideMasterBackgroundControls } from "./slide-master-background-controls";
import { SlideFooterControls } from "./slide-footer-controls";
import { SlideCanvasSizeControls } from "./slide-canvas-size-controls";
import { SlideHeaderControls } from "./slide-header-controls";
import { SlideInspectorSection } from "./slide-inspector-section";
import { SlideNavigationGuideControls } from "./slide-navigation-guide-controls";
import { SlideNavigationButtonControls } from "./slide-navigation-button-controls";
import { SlideTypographyControls } from "./slide-typography-controls";

export function SlideMasterPanel({ value, courseId, onChange }: { value?: SlideMaster; courseId: string; onChange: (value: SlideMaster) => void }) {
  const master = value ?? defaultSlideMaster;
  const size = resolveSlideSize(master);
  return (
    <section aria-label="Master slide settings" className="space-y-2">
      <SlideInspectorSection title="Canvas size" icon={Monitor}>
      <SlideCanvasSizeControls key={`${size.width}x${size.height}`} master={master} onChange={onChange} />
      </SlideInspectorSection>
      <SlideInspectorSection title="Theme & colors" icon={Palette}>
      <div className="grid grid-cols-2 gap-2" aria-label="Presentation themes">
        {slideMasterPresets.map((preset) => <Button key={preset.id} type="button" variant="outline" aria-pressed={master.template === preset.id} onClick={() => onChange({ ...master, template: preset.id, backgroundColor: preset.backgroundColor, textColor: preset.textColor, accentColor: preset.accentColor })} className="h-auto flex-col items-stretch gap-2 p-2 text-left text-xs aria-pressed:ring-2 aria-pressed:ring-indigo-500">
          <span className="flex h-9 flex-col justify-center rounded-sm px-2" style={{ background: preset.backgroundColor, color: preset.textColor, borderTop: `4px solid ${preset.accentColor}` }}><span className="h-1 w-2/3 rounded bg-current opacity-70" /></span>
          {preset.name}
        </Button>)}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {(["backgroundColor", "textColor", "accentColor"] as const).map((field) => <div key={field} className="space-y-1 text-xs text-slate-600"><span className="block truncate">{field === "backgroundColor" ? "Background" : field === "textColor" ? "Text" : "Accent"}</span><ColorPicker aria-label={`Master ${field}`} value={master[field]} onChange={(color) => onChange({ ...master, [field]: color })} /></div>)}
      </div>
      </SlideInspectorSection>
      <SlideInspectorSection title="Slide background" icon={Image}>
      <SlideMasterBackgroundControls master={master} courseId={courseId} onChange={onChange} />
      </SlideInspectorSection>
      <SlideInspectorSection title="Header" icon={PanelTop}>
      <SlideHeaderControls master={master} courseId={courseId} onChange={onChange} />
      </SlideInspectorSection>
      <SlideInspectorSection title="Footer" icon={PanelBottom}>
      <SlideFooterControls master={master} courseId={courseId} onChange={onChange} />
      </SlideInspectorSection>
      <SlideInspectorSection title="Body text & lists" icon={Type}>
        <p className="text-xs text-slate-500">Default style for text and list objects. Formatting applied to selected text takes precedence.</p>
        <SlideTypographyControls label="Body text and lists" value={master.bodyTypography ?? { ...defaultSlideBodyTypography, color: master.textColor }} onChange={(bodyTypography) => onChange({ ...master, bodyTypography })} />
      </SlideInspectorSection>
      <SlideInspectorSection title="Navigation buttons" icon={MousePointer2}><SlideNavigationButtonControls master={master} onChange={onChange} /></SlideInspectorSection>
      <SlideInspectorSection title="Navigation guide" icon={CircleHelp}><SlideNavigationGuideControls master={master} onChange={onChange} /></SlideInspectorSection>
    </section>
  );
}
