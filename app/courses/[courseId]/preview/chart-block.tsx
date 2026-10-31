import { useId, type CSSProperties } from "react";
import type { ContentBlock } from "@/lib/schemas/block";
import { backgroundPaint, parseGradient, solidColor } from "@/lib/color";
import { SvgGradient } from "@/components/svg-gradient";

export type ChartBlockData = Extract<ContentBlock, { type: "chart" }>["data"];

function formatValue(value: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
}

function chartColorStyle(color: string, id: string): CSSProperties {
  return { "--chart-accent": solidColor(color), "--chart-svg": parseGradient(color) ? `url(#${id})` : color } as CSSProperties;
}

function chartSegmentStyle(color: string, index: number): CSSProperties {
  return parseGradient(color) ? { ...backgroundPaint(color), opacity: Math.max(0.3, 1 - index * 0.15) } : { backgroundColor: index === 0 ? "var(--chart-accent)" : `color-mix(in srgb, var(--chart-accent) ${Math.max(30, 100 - index * 15)}%, white)` };
}

function BarChart({ data }: { data: ChartBlockData }) {
  const max = Math.max(1, ...data.fields.map((field) => field.value));
  return (
    <div className="space-y-4" aria-label="Horizontal bar chart">
      {data.fields.map((field) => (
        <div key={field.id} className="grid grid-cols-[minmax(72px,1fr)_minmax(0,3fr)_auto] items-center gap-3 sm:gap-4">
          <span className="truncate text-sm text-slate-600">{field.label || "Untitled field"}</span>
          <span className="h-3 overflow-hidden rounded-full bg-slate-100">
            <span
              className="block h-full rounded-full transition-[width] duration-300"
              style={{ width: `${(field.value / max) * 100}%`, ...backgroundPaint(data.color) }}
            />
          </span>
          <span className="min-w-10 text-right text-sm font-medium tabular-nums text-slate-800">
            {formatValue(field.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

function ColumnChart({ data, gradientId }: { data: ChartBlockData; gradientId: string }) {
  const max = Math.max(1, ...data.fields.map((field) => field.value));
  const chartHeight = 180;
  const chartWidth = 640;
  const step = chartWidth / data.fields.length;
  const barWidth = Math.min(52, step * 0.58);
  return (
    <svg
      role="img"
      aria-label={`Column chart: ${data.fields.map((field) => `${field.label} ${formatValue(field.value)}`).join(", ")}`}
      viewBox={`0 0 ${chartWidth} ${chartHeight + 38}`}
      className="block h-56 w-full overflow-visible"
      preserveAspectRatio="xMidYMid meet"
    >
      <SvgGradient id={gradientId} value={data.color} />
      <path d={`M 0 ${chartHeight} H ${chartWidth}`} stroke="#e2e8f0" strokeWidth="2" />
      {data.fields.map((field, index) => {
        const height = (field.value / max) * (chartHeight - 12);
        const x = index * step + (step - barWidth) / 2;
        const y = chartHeight - height;
        return (
          <g key={field.id}>
            <rect x={x} y={y} width={barWidth} height={height} rx="6" fill="var(--chart-svg)" opacity={0.88} />
            <text x={x + barWidth / 2} y={Math.max(14, y - 8)} textAnchor="middle" className="fill-slate-700 text-[12px]">
              {formatValue(field.value)}
            </text>
            <text x={x + barWidth / 2} y={chartHeight + 24} textAnchor="middle" className="fill-slate-500 text-[12px]">
              {field.label || `Field ${index + 1}`}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function LineChart({ data, gradientId }: { data: ChartBlockData; gradientId: string }) {
  const max = Math.max(1, ...data.fields.map((field) => field.value));
  const chartHeight = 180;
  const chartWidth = 640;
  const padding = 18;
  const points = data.fields.map((field, index) => {
    const x = data.fields.length === 1
      ? chartWidth / 2
      : padding + (index / (data.fields.length - 1)) * (chartWidth - padding * 2);
    const y = chartHeight - padding - (field.value / max) * (chartHeight - padding * 2);
    return { ...field, x, y };
  });
  const pointString = points.map((point) => `${point.x},${point.y}`).join(" ");
  return (
    <svg
      role="img"
      aria-label={`Line chart: ${data.fields.map((field) => `${field.label} ${formatValue(field.value)}`).join(", ")}`}
      viewBox={`0 0 ${chartWidth} ${chartHeight + 44}`}
      className="block h-56 w-full overflow-visible"
      preserveAspectRatio="xMidYMid meet"
    >
      <SvgGradient id={gradientId} value={data.color} />
      <path d={`M ${padding} 0 V ${chartHeight} H ${chartWidth - padding}`} fill="none" stroke="#e2e8f0" strokeWidth="2" />
      {points.length > 1 && <polyline points={pointString} fill="none" stroke="var(--chart-svg)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />}
      {points.map((point, index) => (
        <g key={point.id}>
          <circle cx={point.x} cy={point.y} r="6" fill="white" stroke="var(--chart-svg)" strokeWidth="4" />
          <text x={point.x} y={Math.max(12, point.y - 12)} textAnchor="middle" className="fill-slate-700 text-[12px]">
            {formatValue(point.value)}
          </text>
          <text x={point.x} y={chartHeight + 26} textAnchor="middle" className="fill-slate-500 text-[12px]">
            {point.label || `Field ${index + 1}`}
          </text>
        </g>
      ))}
    </svg>
  );
}

function DonutChart({ data, gradientId }: { data: ChartBlockData; gradientId: string }) {
  const total = data.fields.reduce((sum, field) => sum + field.value, 0);
  const denominator = total || 1;
  const circumference = 2 * Math.PI * 62;
  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-center">
      <svg role="img" aria-label={`Donut chart: ${data.fields.map((field) => `${field.label} ${formatValue(field.value)}`).join(", ")}`} viewBox="0 0 160 160" className="size-40 shrink-0 -rotate-90">
        <SvgGradient id={gradientId} value={data.color} />
        <circle cx="80" cy="80" r="62" fill="none" stroke="#f1f5f9" strokeWidth="24" />
        {data.fields.map((field, index) => {
          const length = (field.value / denominator) * circumference;
          const currentOffset = data.fields
            .slice(0, index)
            .reduce((sum, item) => sum + (item.value / denominator) * circumference, 0);
          const shade = Math.max(30, 100 - index * 15);
          return (
            <circle
              key={field.id}
              cx="80"
              cy="80"
              r="62"
              fill="none"
              stroke={parseGradient(data.color) ? "var(--chart-svg)" : index === 0 ? "var(--chart-accent)" : `color-mix(in srgb, var(--chart-accent) ${shade}%, white)`}
              opacity={parseGradient(data.color) ? Math.max(0.3, 1 - index * 0.15) : undefined}
              strokeWidth="24"
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={-currentOffset}
            />
          );
        })}
      </svg>
      <div className="min-w-0 space-y-3">
        {data.fields.map((field, index) => (
          <div key={field.id} className="flex items-center gap-3 text-sm">
            <span
              aria-hidden="true"
              className="size-3 shrink-0 rounded-sm"
              style={chartSegmentStyle(data.color, index)}
            />
            <span className="min-w-0 flex-1 text-slate-600">{field.label || "Untitled field"}</span>
            <span className="font-medium tabular-nums text-slate-800">{formatValue(field.value)}{total ? ` · ${Math.round((field.value / total) * 100)}%` : ""}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StackedChart({ data }: { data: ChartBlockData }) {
  const total = data.fields.reduce((sum, field) => sum + field.value, 0);
  const denominator = total || 1;
  return (
    <div className="space-y-5">
      <div className="flex h-7 w-full overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`Stacked chart: ${data.fields.map((field) => `${field.label} ${formatValue(field.value)}`).join(", ")}`}>
        {data.fields.map((field, index) => (
          <span
            key={field.id}
            title={`${field.label}: ${formatValue(field.value)}`}
            className="h-full transition-[width] duration-300"
            style={{
              width: `${(field.value / denominator) * 100}%`,
              ...chartSegmentStyle(data.color, index),
            }}
          />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {data.fields.map((field, index) => (
          <div key={field.id} className="flex min-w-0 items-center gap-2 text-sm">
            <span
              aria-hidden="true"
              className="size-3 shrink-0 rounded-sm"
              style={chartSegmentStyle(data.color, index)}
            />
            <span className="min-w-0 flex-1 truncate text-slate-600">{field.label || "Untitled field"}</span>
            <span className="font-medium tabular-nums text-slate-800">{formatValue(field.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChartBlockPreview({ data }: { data: ChartBlockData }) {
  const gradientId = `chart-${useId().replaceAll(":", "")}`;
  let chart: React.ReactNode;
  if (data.chartType === "bar") chart = <BarChart data={data} />;
  else if (data.chartType === "column") chart = <ColumnChart data={data} gradientId={gradientId} />;
  else if (data.chartType === "line") chart = <LineChart data={data} gradientId={gradientId} />;
  else if (data.chartType === "donut") chart = <DonutChart data={data} gradientId={gradientId} />;
  else chart = <StackedChart data={data} />;

  return (
    <figure className="w-full min-w-0 space-y-5" style={chartColorStyle(data.color, gradientId)}>
      {(data.title || data.description) && (
        <figcaption className="space-y-1">
          {data.title && <h3 className="m-0 text-lg font-semibold tracking-tight text-slate-900">{data.title}</h3>}
          {data.description && <p className="m-0 text-sm leading-6 text-slate-500">{data.description}</p>}
        </figcaption>
      )}
      {chart}
    </figure>
  );
}
