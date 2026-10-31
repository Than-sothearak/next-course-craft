/* eslint-disable @next/next/no-img-element -- Presentation backgrounds also render in standalone static exports. */
import { useId } from "react";
import { defaultSlideMaster, type SlideMaster } from "@/lib/editor/slide-design";
import { backgroundPaint, parseGradient, solidColor } from "@/lib/color";
import { SvgGradient } from "@/components/svg-gradient";

export function SlideMasterBackground({ master = defaultSlideMaster }: { master?: SlideMaster }) {
  const id = useId().replaceAll(":", "");
  const background = master.background;
  const color = solidColor(master.accentColor);
  const paint = parseGradient(master.accentColor) ? `url(#${id}-accent)` : color;
  const fill = !background && master.template === "gradient"
    ? `radial-gradient(circle at 92% 8%, ${color}55, transparent 42%), ${master.backgroundColor}`
    : master.backgroundColor;
  return (
    <span aria-hidden="true" data-slide-master-background={background?.type ?? "theme"} className="pointer-events-none absolute inset-0 block overflow-hidden" style={{ background: fill }}>
      {background?.type === "image" && background.imageSrc && <>
        <img src={background.imageSrc} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: background.imagePosition }} />
        <span className="absolute inset-0" style={{ ...backgroundPaint(master.backgroundColor), opacity: background.overlayOpacity / 100 }} />
      </>}
      {background?.type === "abstract" && <svg data-abstract-design={background.design} viewBox="0 0 960 540" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" fill="none">
        <SvgGradient id={`${id}-accent`} value={master.accentColor} />
        {background.design === "waves" && <g fill={paint}>
          <path d="M-80 470C150 270 340 620 610 400S1000 320 1080 400V620H-80Z" opacity=".10" />
          <path d="M-80 520C170 330 350 660 650 455S1000 390 1080 450V620H-80Z" opacity=".15" />
          <circle cx="900" cy="20" r="160" opacity=".08" />
        </g>}
        {background.design === "orbits" && <g stroke={paint}>
          <circle cx="910" cy="480" r="260" strokeWidth="70" opacity=".06" />
          <circle cx="910" cy="480" r="170" strokeWidth="2" opacity=".25" />
          <circle cx="910" cy="480" r="110" strokeWidth="28" opacity=".12" />
          <circle cx="0" cy="0" r="145" strokeWidth="35" opacity=".08" />
        </g>}
        {background.design === "prism" && <g fill={paint}>
          <path d="M680 0H960V330Z" opacity=".10" /><path d="M805 0H960V180Z" opacity=".18" />
          <path d="M0 340L250 540H0Z" opacity=".14" /><path d="M0 440L130 540H0Z" opacity=".12" />
        </g>}
        {background.design === "ribbons" && <g stroke={paint}>
          <path d="M640-110C650 170 1080 110 1030 440" strokeWidth="100" opacity=".08" />
          <path d="M700-110C710 160 1130 120 1090 440" strokeWidth="30" opacity=".18" />
          <path d="M-80 320C160 300 10 610 300 620" strokeWidth="65" opacity=".10" />
        </g>}
        {background.design === "dots" && <>
          <defs><pattern id={`${id}-dots`} width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r="2" fill={paint} opacity=".3" /></pattern></defs>
          <circle cx="890" cy="70" r="200" fill={`url(#${id}-dots)`} /><circle cx="30" cy="510" r="140" fill={`url(#${id}-dots)`} />
          <circle cx="940" cy="490" r="90" fill={paint} opacity=".06" />
        </>}
        {background.design === "glow" && <>
          <defs><radialGradient id={`${id}-glow`}><stop stopColor={color} stopOpacity=".3" /><stop offset="1" stopColor={color} stopOpacity="0" /></radialGradient></defs>
          <ellipse cx="900" cy="10" rx="360" ry="300" fill={`url(#${id}-glow)`} /><ellipse cx="0" cy="540" rx="340" ry="250" fill={`url(#${id}-glow)`} />
        </>}
      </svg>}
    </span>
  );
}
