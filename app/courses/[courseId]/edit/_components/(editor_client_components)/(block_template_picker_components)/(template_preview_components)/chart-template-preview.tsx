import { useId } from "react";
import { backgroundPaint, solidColor } from "@/lib/color";
import type { BlockTemplate } from "../block-template-data";

type ChartData = NonNullable<BlockTemplate["chart"]>;
const defaultAccent = "var(--course-primary, #2f5f9f)";
const formatValue = (value: number) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value);

function fieldColor(data: ChartData, index: number) {
  return solidColor(data.fields[index].color ?? data.color ?? defaultAccent);
}

function segmentColor(data: ChartData, index: number) {
  const color = fieldColor(data, index);
  return data.fields[index].color ? color : `color-mix(in srgb, ${color} ${Math.max(35, 100 - index * 20)}%, white)`;
}

function ChartLegend({ data }: { data: ChartData }) {
  return <div className={`grid min-w-0 gap-x-3 gap-y-1.5 ${data.chartType === "stacked" ? "grid-cols-2" : "flex-1"}`}>
    {data.fields.map((field, index) => <div key={field.id} className="flex min-w-0 items-center gap-1.5 text-[9px] leading-3">
      <span aria-hidden="true" className="size-2 shrink-0 rounded-sm" style={{ background: segmentColor(data, index) }} />
      <span className="min-w-0 flex-1 truncate text-slate-500">{field.label}</span>
      <span className="font-medium tabular-nums text-slate-700">{formatValue(field.value)}</span>
    </div>)}
  </div>;
}

export function ChartTemplatePreview({ data }: { data: ChartData }) {
  const titleId = useId();
  const max = Math.max(1, ...data.fields.map((field) => field.value));
  const total = data.fields.reduce((sum, field) => sum + field.value, 0) || 1;
  const chartLabel = `${data.chartType} chart: ${data.fields.map((field) => `${field.label} ${formatValue(field.value)}`).join(", ")}`;
  // These dimensions are for a picker thumbnail; lesson charts retain their own layout.
  const width = 240;
  const baseline = 84;
  const points = data.fields.map((field, index) => ({
    x: data.fields.length === 1 ? width / 2 : 18 + index / (data.fields.length - 1) * (width - 36),
    y: baseline - field.value / max * 60,
  }));

  return <figure data-template-chart-preview={data.chartType} aria-labelledby={data.title ? titleId : undefined} className="flex h-36 min-w-0 flex-col justify-center gap-3">
    {(data.title || data.description) && <figcaption className="space-y-0.5">
      {data.title && <p id={titleId} className="text-[11px] font-semibold leading-4 text-slate-800">{data.title}</p>}
      {data.description && <p className="line-clamp-1 text-[10px] leading-3.5 text-slate-500">{data.description}</p>}
    </figcaption>}
    {data.chartType === "bar" && <div role="img" aria-label={chartLabel} className="space-y-2.5">
      {data.fields.map((field) => <div key={field.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.8fr)_auto] items-center gap-2 text-[10px] leading-3.5">
        <span className="truncate text-slate-500">{field.label}</span>
        <span className="h-2 overflow-hidden rounded-full bg-slate-200/70"><span className="block h-full rounded-full" style={{ width: `${field.value / max * 100}%`, ...backgroundPaint(field.color ?? data.color ?? defaultAccent) }} /></span>
        <span className="min-w-4 text-right font-medium tabular-nums text-slate-700">{formatValue(field.value)}</span>
      </div>)}
    </div>}
    {(data.chartType === "column" || data.chartType === "line") && <svg role="img" aria-label={chartLabel} viewBox={`0 0 ${width} 106`} className="block w-full">
      {[24, 54, baseline].map((y) => <path key={y} d={`M 8 ${y} H ${width - 8}`} stroke="#e2e8f0" strokeWidth="1" strokeDasharray={y === baseline ? undefined : "3 4"} />)}
      {data.chartType === "line" && <polyline points={points.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke={solidColor(data.color ?? defaultAccent)} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
      {data.fields.map((field, index) => {
        const x = data.chartType === "column" ? (index + 0.5) * width / data.fields.length : points[index].x;
        const y = points[index].y;
        return <g key={field.id}>
          {data.chartType === "column" ? <rect x={x - 14} y={y} width="28" height={baseline - y} rx="3" fill={fieldColor(data, index)} /> : <circle cx={x} cy={y} r="3" fill="white" stroke={fieldColor(data, index)} strokeWidth="2" />}
          <text x={x} y={y - 8} textAnchor="middle" className="fill-slate-600 text-[10px]">{formatValue(field.value)}</text>
          <text x={x} y="101" textAnchor="middle" className="fill-slate-500 text-[9px]">{field.label}</text>
        </g>;
      })}
    </svg>}
    {data.chartType === "donut" && <div className="flex items-center gap-3">
      <svg role="img" aria-label={chartLabel} viewBox="0 0 80 80" className="size-20 shrink-0 -rotate-90">
        <circle cx="40" cy="40" r="29" fill="none" stroke="#e2e8f0" strokeWidth="12" />
        {data.fields.map((field, index) => <circle key={field.id} cx="40" cy="40" r="29" fill="none" stroke={segmentColor(data, index)} strokeWidth="12" pathLength="100" strokeDasharray={`${field.value / total * 100} 100`} strokeDashoffset={-data.fields.slice(0, index).reduce((sum, item) => sum + item.value / total * 100, 0)} />)}
      </svg>
      <ChartLegend data={data} />
    </div>}
    {data.chartType === "stacked" && <div className="space-y-3">
      <div role="img" aria-label={chartLabel} className="flex h-4 overflow-hidden rounded-full bg-slate-200/70">
        {data.fields.map((field, index) => <span key={field.id} style={{ width: `${field.value / total * 100}%`, background: segmentColor(data, index) }} />)}
      </div>
      <ChartLegend data={data} />
    </div>}
  </figure>;
}
