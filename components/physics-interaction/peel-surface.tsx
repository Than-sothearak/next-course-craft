"use client";

import { useId } from "react";
import { contrastTextColor } from "@/lib/color";
import type { PeelSettings } from "@/lib/schemas/peel-to-reveal";
import { peelGeometry } from "@/lib/interactive/physics/peel-geometry";

/** Visual layer only: content and the spring controller are independent of this SVG. */
export function PeelSurface({ settings }: { settings: PeelSettings }) {
  const id = useId().replace(/:/g, ""), g = peelGeometry(0);
  const mirrorX = settings.direction.endsWith("right"), mirrorY = settings.direction.startsWith("bottom");
  const transform = `translate(${mirrorX ? 680 : 0} ${mirrorY ? 360 : 0}) scale(${mirrorX ? -1 : 1} ${mirrorY ? -1 : 1})`;
  const ink = contrastTextColor(settings.paperColor);
  return <svg data-peel-surface aria-hidden="true" viewBox="0 0 680 360" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
    <defs>
      <linearGradient id={`${id}-paper`} x1="0" y1="0" x2="1" y2="1"><stop stopColor={settings.paperColor} /><stop offset="1" stopColor={settings.paperColor} /></linearGradient>
      <linearGradient id={`${id}-back`} x1="0" y1="0" x2="1" y2="1"><stop stopColor={settings.paperColor} /><stop offset=".18" stopColor={settings.paperColor} /><stop offset=".43" stopColor="#ffffff" /><stop offset=".69" stopColor={settings.paperColor} /><stop offset="1" stopColor="#6b645a" /></linearGradient>
      <filter id={`${id}-shadow`} x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur data-peel-blur stdDeviation="5" /></filter>
      <pattern id={`${id}-texture`} width={settings.material === "linen" ? 6 : 4} height="6" patternUnits="userSpaceOnUse"><path d={settings.material === "linen" ? "M0 0V6 M0 0H6" : "M1 1h.5 M3 4h.4"} stroke={ink} strokeWidth={settings.material === "linen" ? 0.35 : 0.65} opacity=".08" /></pattern>
      <clipPath id={`${id}-clip`}><path data-peel-clip d={g.front} transform={transform} /></clipPath>
    </defs>
    <g transform={transform}>
      <path data-peel-front d={g.front} fill={`url(#${id}-paper)`} stroke={settings.paperColor} strokeWidth={settings.thickness} />
      {settings.material !== "smooth" && <path data-peel-texture d={g.front} fill={`url(#${id}-texture)`} />}
    </g>
    <g clipPath={`url(#${id}-clip)`} data-peel-face>
      <foreignObject x="40" y="55" width="600" height="250"><div className="flex h-full flex-col items-center justify-center gap-4 text-center" style={{ color: ink }}>
        <span className="text-[10px] font-semibold uppercase tracking-[.25em] opacity-45">A learning moment</span>
        <h3 className="max-w-full break-words text-3xl font-semibold tracking-tight">{settings.title}</h3>
        {settings.showInstructions && <p className="max-w-[430px] whitespace-pre-wrap text-sm leading-6 opacity-65">{settings.instructions}</p>}
        <span className="h-1 w-8 rounded-full" style={{ backgroundColor: settings.accentColor }} />
      </div></foreignObject>
    </g>
    <g transform={transform}>
      <path data-peel-shadow d={g.shadow} fill="#1c1917" opacity={settings.shadowIntensity / 100 * 0.6} filter={`url(#${id}-shadow)`} transform="translate(4 8)" />
      <path data-peel-flap d={g.flap} fill={`url(#${id}-back)`} stroke={settings.paperColor} strokeWidth={settings.thickness} strokeLinejoin="round" />
      <path data-peel-crease d={g.crease} fill="none" stroke="#ffffff" strokeOpacity=".75" strokeWidth="1.5" />
    </g>
  </svg>;
}
