import { ArrowUpRight, Link2 } from "lucide-react";
import type { ContentBlock } from "@/lib/schemas/block";
import { isSafeLinkHref } from "@/lib/editor/link-utils";

type LinkBlockData = Extract<ContentBlock, { type: "link" }>["data"];

export function CourseLinkBlock({
  data,
  interactive = true,
}: {
  data: LinkBlockData;
  interactive?: boolean;
}) {
  const href = isSafeLinkHref(data.url) ? data.url : undefined;
  const card = data.style === "card";
  const button = data.style === "button";
  const className = card
    ? "group flex w-full items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-[var(--course-primary)] hover:shadow-md"
    : button
      ? "group inline-flex max-w-full items-center justify-center gap-2 rounded-lg bg-[var(--course-primary)] px-5 py-3 text-center font-semibold text-white shadow-sm transition hover:brightness-95"
      : "group inline-flex max-w-full items-center gap-2 font-semibold text-[var(--course-primary)] underline decoration-2 underline-offset-4 hover:opacity-80";

  return (
    <a
      href={href}
      target={data.openInNewTab ? "_blank" : undefined}
      rel={data.openInNewTab ? "noopener noreferrer" : undefined}
      aria-disabled={!href || !interactive || undefined}
      onClick={(event) => {
        if (!interactive || !href) event.preventDefault();
      }}
      className={`${className} ${interactive && href ? "cursor-pointer" : "cursor-default"}`}
    >
      {card && (
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-indigo-50 text-[var(--course-primary)]">
          <Link2 size={20} aria-hidden="true" />
        </span>
      )}
      <span className={card ? "min-w-0 flex-1" : "min-w-0"}>
        <span className="block truncate">{data.label || "Open resource"}</span>
        {data.description && (
          <span className={`mt-1 block text-sm leading-5 ${button ? "font-normal text-white/85" : "font-normal text-slate-500 no-underline"}`}>
            {data.description}
          </span>
        )}
      </span>
      <ArrowUpRight
        size={card ? 18 : 16}
        aria-hidden="true"
        className={`shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 ${button ? "text-white/80" : "text-[var(--course-primary)]"}`}
      />
    </a>
  );
}
