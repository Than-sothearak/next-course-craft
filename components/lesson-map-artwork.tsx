import { useId, type ReactNode } from "react";
import type { LessonMapTemplate } from "@/lib/schemas/block";

export const lessonMapTemplates: { id: LessonMapTemplate; title: string; description: string }[] = [
  { id: "modernCity", title: "Modern City", description: "City blocks, roads, parks, and water" },
  { id: "farmFields", title: "Farm Fields", description: "Fields, paths, crops, and farm buildings" },
  { id: "cityProvince", title: "City Province", description: "A small city opening into the countryside" },
  { id: "learningRoad", title: "Learning Road", description: "A winding road through a friendly landscape" },
];

function Tree({ x, y, scale = 1, color = "#5d9b58" }: { x: number; y: number; scale?: number; color?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <ellipse cx="4" cy="7" rx="25" ry="10" fill="#668e61" opacity=".22" />
      <path d="M0 -2h9v24H0z" fill="#956b48" />
      <circle cx="4" cy="-19" r="20" fill="#49864d" />
      <circle cx="-9" cy="-11" r="13" fill={color} />
      <circle cx="12" cy="-8" r="12" fill="#77b768" />
      <circle cx="-2" cy="-25" r="7" fill="#a2cf73" opacity=".7" />
    </g>
  );
}

function Building({ x, y, width = 58, height = 78, color = "#f2a765", roof = "#d97750" }: { x: number; y: number; width?: number; height?: number; color?: string; roof?: string }) {
  const side = width * 0.18;
  return (
    <g>
      <ellipse cx={x + width / 2 + side} cy={y + 8} rx={width * 0.65} ry="12" fill="#597d59" opacity=".2" />
      <path d={`M${x + width} ${y - height + 13}l${side} -9v${height - 2}l-${side} 10z`} fill="#bd684e" />
      <rect x={x} y={y - height} width={width} height={height} rx="8" fill={color} />
      <path d={`M${x + 3} ${y - height + 7}l${width * .45} -18 ${width * .52} 9v10z`} fill={roof} />
      <path d={`M${x + width * .48} ${y - height - 11}l${width * .52} 9 ${side} -9 -${width * .52} -10z`} fill="#ec9865" />
      <rect x={x + 10} y={y - height + 29} width="12" height="15" rx="3" fill="#fff4ca" />
      <rect x={x + width - 23} y={y - height + 29} width="12" height="15" rx="3" fill="#fff4ca" />
      <rect x={x + width * .42} y={y - 28} width="15" height="28" rx="7" fill="#885c4e" />
    </g>
  );
}

function Barn({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <ellipse cx={x + 40} cy={y + 8} rx="56" ry="11" fill="#557b52" opacity=".2" />
      <path d={`M${x + 76} ${y - 54}l16 -10v53l-16 11z`} fill="#a9473c" />
      <rect x={x} y={y - 54} width="76" height="54" rx="7" fill="#db6650" />
      <path d={`M${x - 5} ${y - 52}l40 -32 45 30 -8 8 -37 -24 -34 27z`} fill="#8f5345" />
      <path d={`M${x + 25} ${y}v-34q15 -15 30 0v34z`} fill="#fff0ca" />
      <path d={`M${x + 39} ${y - 32}v32m-14 -17h30`} stroke="#a9473c" strokeWidth="4" />
    </g>
  );
}

function Road({ d, width = 46 }: { d: string; width?: number }) {
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} stroke="#c8b68e" strokeWidth={width + 8} />
      <path d={d} stroke="#f3e9cf" strokeWidth={width} />
      <path d={d} stroke="#d9cba9" strokeWidth="2" strokeDasharray="3 17" />
    </g>
  );
}

function Park({ x, y, width, height }: { x: number; y: number; width: number; height: number }) {
  return <rect x={x} y={y} width={width} height={height} rx="24" fill="#9fcf81" stroke="#82b96e" strokeWidth="3" />;
}

function CropRows({ x, y, count = 5 }: { x: number; y: number; count?: number }) {
  return (
    <g stroke="#e8f1b6" strokeWidth="4" strokeLinecap="round" opacity=".9">
      {Array.from({ length: count }, (_, index) => (
        <path key={index} d={`M${x + index * 11} ${y}l-16 54`} />
      ))}
    </g>
  );
}

function CityScene() {
  return (
    <>
      <rect width="720" height="440" fill="#d4e9bd" />
      <path d="M0 282Q116 230 222 286t228 5q89-36 270 4v145H0z" fill="#7bc5c0" />
      <path d="M0 303q102-40 194 6t194 5" fill="none" stroke="#a6e2d6" strokeWidth="13" opacity=".75" />
      <Park x={26} y={34} width={164} height={110} />
      <Park x={506} y={275} width={177} height={120} />
      <Road d="M-20 220C110 191 146 242 250 220S390 159 470 190s144 44 280 3" width={45} />
      <Road d="M286 -20C271 82 316 118 302 194s-8 137 35 274" width={40} />
      <Building x={214} y={177} width={56} height={88} color="#8bb7d3" roof="#6c99ba" />
      <Building x={354} y={135} width={62} height={105} color="#e7a768" roof="#d17b58" />
      <Building x={472} y={286} width={56} height={80} color="#d68eae" roof="#ae648e" />
      <Building x={86} y={288} width={53} height={72} color="#f0cf79" roof="#d8a95e" />
      <Tree x={62} y={74} scale={.9} />
      <Tree x={153} y={104} scale={.7} color="#78b567" />
      <Tree x={619} y={324} scale={.92} />
      <Tree x={564} y={360} scale={.66} color="#82b96e" />
      <circle cx="242" cy="48" r="22" fill="#f5cf72" />
      <path d="M229 47h26m-13-13v26" stroke="#fff4ca" strokeWidth="4" strokeLinecap="round" />
    </>
  );
}

function FarmScene() {
  return (
    <>
      <rect width="720" height="440" fill="#b9d993" />
      <path d="M0 333Q105 267 196 318T391 303q104-46 329 5v132H0z" fill="#86bd71" />
      <path d="M0 86Q174 46 333 86T720 65v80Q557 171 384 139T0 168z" fill="#9bc97a" />
      <path d="M0 90Q170 50 330 90T720 69" fill="none" stroke="#eef0b7" strokeWidth="5" opacity=".7" />
      <Road d="M-20 250C92 200 138 193 216 220s124 88 226 40 172-68 298-2" width={48} />
      <Road d="M375 450C345 353 378 323 460 285s107-94 108-161" width={34} />
      <path d="M33 42l159-24 74 125-203 35z" fill="#c7a55f" stroke="#ebd38e" strokeWidth="5" />
      <path d="M42 51l147-21 66 111-178 31z" fill="#9ab45c" />
      <CropRows x={78} y={50} count={8} />
      <path d="M485 24l168 26-42 113-184-30z" fill="#c99d51" stroke="#ebd38e" strokeWidth="5" />
      <path d="M494 35l143 22-37 91-153-25z" fill="#739b4d" />
      <CropRows x={493} y={45} count={8} />
      <path d="M54 319l145-27 53 98-167 32z" fill="#a8c75c" stroke="#e1cc83" strokeWidth="5" />
      <CropRows x={91} y={320} count={6} />
      <Barn x={275} y={184} />
      <path d="M403 207h22v53h-22z" fill="#e6d5ad" />
      <path d="M398 207l16-16 16 16z" fill="#bc8558" />
      <ellipse cx="414" cy="262" rx="23" ry="6" fill="#688d5a" opacity=".22" />
      <Tree x={35} y={269} scale={.75} />
      <Tree x={672} y={214} scale={.8} color="#73a85a" />
      <Tree x={646} y={356} scale={.65} />
      <circle cx="584" cy="247" r="15" fill="#f4d16f" />
      <path d="M584 232v30m-15-15h30m-25-10 20 20m0-20-20 20" stroke="#578a48" strokeWidth="4" strokeLinecap="round" />
    </>
  );
}

function ProvinceScene() {
  return (
    <>
      <rect width="720" height="440" fill="#cfe5b8" />
      <path d="M0 306Q104 261 197 303t187 8q104-40 181-7t155 0v136H0z" fill="#a4ce81" />
      <path d="M0 355q140-60 272-21t248-4q98-28 200 9" fill="none" stroke="#8ebc72" strokeWidth="9" />
      <path d="M520 0q-39 108-3 174t-7 135q-32 58 18 131" fill="none" stroke="#83c6bd" strokeWidth="48" />
      <path d="M-20 220C96 205 135 256 223 220s131-101 232-45 159 101 285 61" fill="none" stroke="#bcb087" strokeWidth="51" strokeLinecap="round" />
      <path d="M-20 220C96 205 135 256 223 220s131-101 232-45 159 101 285 61" fill="none" stroke="#f4e9cb" strokeWidth="43" strokeLinecap="round" />
      <Building x={71} y={190} width={51} height={77} color="#ecad6a" roof="#cf7957" />
      <Building x={168} y={270} width={58} height={91} color="#7fa9c7" roof="#648eae" />
      <Building x={260} y={182} width={52} height={74} color="#da8eaa" roof="#b76683" />
      <Park x={47} y={42} width={148} height={82} />
      <path d="M390 40l119 16-15 69-121-15z" fill="#b9cb70" stroke="#dece8b" strokeWidth="5" />
      <path d="M558 253l125 10-35 92-133-15z" fill="#c49a53" stroke="#e4cf91" strokeWidth="5" />
      <CropRows x={568} y={264} count={6} />
      <Barn x={394} y={343} />
      <Tree x={34} y={163} scale={.64} />
      <Tree x={313} y={343} scale={.85} />
      <Tree x={612} y={106} scale={.8} color="#6ca25d" />
      <Tree x={666} y={381} scale={.73} />
    </>
  );
}

function LearningRoadScene() {
  return (
    <>
      <rect width="720" height="440" fill="#c9e3ac" />
      <path d="M0 327Q110 270 219 323t209-7q117-52 292-5v129H0z" fill="#9bc77a" />
      <path d="M0 77q117-53 247-11t241-4q120 49 232-10v111q-122 59-236 17t-231 7Q109 143 0 190z" fill="#b2d58a" />
      <path d="M-30 301C74 285 124 205 209 220s111 97 192 73 85-132 171-131 101 46 183 26" fill="none" stroke="#c6b58d" strokeWidth="57" strokeLinecap="round" />
      <path d="M-30 301C74 285 124 205 209 220s111 97 192 73 85-132 171-131 101 46 183 26" fill="none" stroke="#f6eccf" strokeWidth="48" strokeLinecap="round" />
      <path d="M-30 301C74 285 124 205 209 220s111 97 192 73 85-132 171-131 101 46 183 26" fill="none" stroke="#d8caa9" strokeWidth="2" strokeDasharray="3 18" strokeLinecap="round" />
      <path d="M63 61l29-25 28 25v49H63z" fill="#e3ad6a" />
      <path d="M55 63l37-33 38 33h-9L92 42 64 67z" fill="#b86655" />
      <rect x="84" y="77" width="17" height="33" rx="8" fill="#885c4e" />
      <rect x="167" y="343" width="73" height="54" rx="14" fill="#fff2ce" />
      <path d="M159 351l44-33 46 34z" fill="#cb7756" />
      <rect x="197" y="367" width="17" height="30" rx="8" fill="#885c4e" />
      <Park x={454} y={28} width={156} height={84} />
      <Tree x={488} y={72} scale={.7} />
      <Tree x={566} y={81} scale={.63} color="#81b768" />
      <Tree x={343} y={117} scale={.9} />
      <Tree x={409} y={373} scale={.9} color="#6fa45d" />
      <Tree x={640} y={354} scale={.8} />
      <circle cx="627" cy="182" r="24" fill="#f2cf72" />
      <path d="M614 182h26m-13-13v26" stroke="#fff3c5" strokeWidth="4" strokeLinecap="round" />
      <path d="M310 57l19-22 18 22v33h-37z" fill="#86b3cf" />
      <path d="M305 58l24-24 24 24z" fill="#6f8fa8" />
    </>
  );
}

const scenes: Record<LessonMapTemplate, () => ReactNode> = {
  modernCity: CityScene,
  farmFields: FarmScene,
  cityProvince: ProvinceScene,
  learningRoad: LearningRoadScene,
};

export function LessonMapArtwork({ template, className, stretch = false }: { template: LessonMapTemplate; className?: string; stretch?: boolean }) {
  const gradientId = `map-paper-${useId().replaceAll(":", "")}`;
  const title = lessonMapTemplates.find((item) => item.id === template)?.title ?? "Lesson Map";
  const Scene = scenes[template];
  return (
    <svg
      viewBox="0 0 720 440"
      role="img"
      aria-label={`${title} illustrated lesson map`}
      preserveAspectRatio={stretch ? "none" : "xMidYMid slice"}
      className={className}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f7f5e8" />
          <stop offset="1" stopColor="#e9eddc" />
        </linearGradient>
      </defs>
      <rect width="720" height="440" fill={`url(#${gradientId})`} />
      <Scene />
      <path d="M10 12h700a8 8 0 0 1 8 8v400a8 8 0 0 1-8 8H10a8 8 0 0 1-8-8V20a8 8 0 0 1 8-8z" fill="none" stroke="#fff9e7" strokeWidth="9" opacity=".75" />
    </svg>
  );
}
