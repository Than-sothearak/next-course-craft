import type { BlockTemplate } from "../block-template-data";

export function AccordionTemplatePreview({
  data,
}: {
  data: NonNullable<BlockTemplate["accordion"]>;
}) {
  if (data.layout === "tabs") {
    return (
      <div className="space-y-2">
        <div className="flex gap-1 border-b border-slate-200">
          {data.items.map((item, index) => (
            <span
              key={item.id}
              className={`border-b-2 px-2 py-1 text-[8px] font-medium ${index === 0 ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-400"}`}
            >
              {item.title}
            </span>
          ))}
        </div>
        <div className="min-h-14 rounded-b-md border border-t-0 border-slate-200 bg-white p-2 text-[8px] leading-3 text-slate-600">
          {data.items[0]?.body}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {data.items.map((item, index) => (
        <div
          key={item.id}
          className="overflow-hidden rounded-md border border-slate-200 bg-white"
        >
          <div className="flex items-center justify-between gap-1 px-2 py-1.5 text-[8px] font-semibold text-slate-700">
            <span className="line-clamp-1">{item.title}</span>
            <span className="text-xs text-slate-400">
              {index === 0 ? "−" : "+"}
            </span>
          </div>
          {index === 0 && (
            <p className="border-t border-slate-100 px-2 py-1.5 text-[7px] leading-3 text-slate-500">
              {item.body}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
