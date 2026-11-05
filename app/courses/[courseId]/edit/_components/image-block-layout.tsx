import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ContentBlock, ImageCoverHeight, ImageCoverPosition, ImageLayout } from "@/lib/schemas/block";

export function ImageBlockLayout({
  layout = "full",
  title,
  body,
  caption,
  coverHeight = "medium",
  coverPosition = "center",
  coverOverlayOpacity = 35,
  coverContentWidth = "full",
  image,
  editable = false,
  onTitleChange,
  onBodyChange,
}: {
  layout?: ImageLayout;
  title?: string;
  body?: string;
  caption?: string;
  coverHeight?: ImageCoverHeight;
  coverPosition?: ImageCoverPosition;
  coverOverlayOpacity?: number;
  coverContentWidth?: ContentBlock["width"];
  image: ReactNode;
  editable?: boolean;
  onTitleChange?: (value: string) => void;
  onBodyChange?: (value: string) => void;
}) {
  const titleContent = (className: string) => editable ? (
    <Input
      aria-label="Image block title"
      value={title ?? ""}
      maxLength={500}
      onChange={(event) => onTitleChange?.(event.target.value)}
      placeholder="Add a title"
      className={`h-auto min-h-0 w-full rounded-none border-0 bg-transparent px-0 py-0 text-inherit shadow-none outline-none placeholder:text-slate-400 focus-visible:border-0 focus-visible:ring-0 focus-visible:ring-offset-0 ${className}`}
    />
  ) : title ? <h3 className={className}>{title}</h3> : null;
  const bodyContent = (className: string) => editable ? (
    <Textarea
      aria-label="Image block text"
      value={body ?? ""}
      maxLength={5_000}
      rows={2}
      onChange={(event) => {
        onBodyChange?.(event.target.value);
        event.currentTarget.style.height = "auto";
        event.currentTarget.style.height = `${event.currentTarget.scrollHeight}px`;
      }}
      placeholder="Add supporting text"
      className={`mt-2 min-h-12 w-full resize-y rounded-none border-0 bg-transparent p-0 text-inherit shadow-none outline-none placeholder:text-slate-400 focus-visible:border-0 focus-visible:ring-0 focus-visible:ring-offset-0 ${className}`}
    />
  ) : body ? <p className={className}>{body}</p> : null;
  const copy = (className = "") => (
    <div className={className}>
      {titleContent("text-xl font-semibold leading-tight tracking-tight text-slate-900")}
      {bodyContent("text-base leading-7 text-slate-600")}
    </div>
  );

  if (layout === "text-left" || layout === "text-right") {
    const text = copy("min-w-0 py-2");
    const visual = <div className="aspect-[4/3] min-w-0 overflow-hidden rounded-xl bg-slate-100 [&>button]:h-full [&>button]:w-full">{image}</div>;
    return (
      <div className="grid items-center gap-5 md:grid-cols-2 md:gap-8">
        {layout === "text-left" ? <>{text}{visual}</> : <>{visual}{text}</>}
      </div>
    );
  }

  if (layout === "text-overlay") {
    return (
      <div className="relative isolate min-h-64 overflow-hidden rounded-2xl bg-slate-900">
        <div className="absolute inset-0 overflow-hidden [&>button]:absolute [&>button]:inset-0 [&>button]:h-full [&>button]:w-full">{image}</div>
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/20 to-transparent" />
        <div className="relative z-10 flex min-h-64 flex-col justify-end p-6 text-white sm:p-8">
          {titleContent("max-w-2xl text-2xl font-semibold leading-tight tracking-tight")}
          {bodyContent("max-w-2xl text-sm leading-6 text-white/90 sm:text-base")}
          {caption && <p className="mt-3 text-xs text-white/70">{caption}</p>}
        </div>
      </div>
    );
  }

  if (layout === "card") {
    return (
      <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="aspect-video overflow-hidden bg-slate-100 [&>button]:h-full [&>button]:w-full">{image}</div>
        {title || body || caption ? <div className="p-5 sm:p-6">
          {copy()}
          {caption && <p className="mt-3 text-xs text-slate-500">{caption}</p>}
        </div> : null}
      </article>
    );
  }

  if (layout === "cover") {
    const contentWidthClass = {
      full: "max-w-[920px]",
      medium: "max-w-[720px]",
      small: "max-w-[520px]",
    }[coverContentWidth];
    const heightClass = {
      short: "h-56 sm:h-64",
      medium: "h-72 sm:h-96",
      tall: "h-[22rem] sm:h-[32rem]",
      viewport: "h-[80vh] min-h-80 max-h-[720px]",
    }[coverHeight];
    const positionClass = {
      center: "[&_img]:object-center",
      top: "[&_img]:object-top",
      bottom: "[&_img]:object-bottom",
      left: "[&_img]:object-left",
      right: "[&_img]:object-right",
    }[coverPosition];
    return (
      <figure data-image-layout="cover" data-cover-height={coverHeight} className="w-full">
        <div className={`relative isolate w-full overflow-hidden bg-slate-900 ${heightClass}`}>
          <div className={`absolute inset-0 [&_img]:h-full [&_img]:w-full [&_img]:object-cover [&_button]:absolute [&_button]:inset-0 [&_button]:h-full [&_button]:w-full [&_button]:rounded-none ${positionClass}`}>
            {image}
          </div>
          {coverOverlayOpacity > 0 && <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-slate-950" style={{ opacity: coverOverlayOpacity / 100 }} />}
          {(title || body || editable) && <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-end py-8 text-white sm:py-12">
            <div data-cover-content-width={coverContentWidth} className={`pointer-events-auto mx-auto w-full ${contentWidthClass} px-4`}>
              {titleContent("text-2xl font-semibold leading-tight tracking-tight text-white sm:text-4xl")}
              {bodyContent("text-sm leading-6 text-white/90 sm:text-lg sm:leading-7")}
            </div>
          </div>}
        </div>
        {caption && <figcaption className="mt-3 text-center text-sm text-slate-500">{caption}</figcaption>}
      </figure>
    );
  }

  if (layout === "banner") {
    return (
      <figure>
        <div className="aspect-[21/9] min-h-40 overflow-hidden rounded-xl bg-slate-100 [&>button]:h-full [&>button]:w-full">{image}</div>
        {caption && <figcaption className="mt-3 text-center text-sm text-slate-500">{caption}</figcaption>}
      </figure>
    );
  }

  return (
    <figure>
      <div className="max-h-[640px] overflow-hidden rounded-lg">{image}</div>
      {caption && <figcaption className="mt-3 text-center text-sm text-slate-500">{caption}</figcaption>}
    </figure>
  );
}
