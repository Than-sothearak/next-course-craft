"use client";

import { imageAspectRatioSchema, imageFitSchema, imageCoverHeightSchema, imageCoverPositionSchema, type ContentBlock } from "@/lib/schemas/block";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { MediaLibraryTarget } from "../content-block-types";
import type { Dispatch, SetStateAction } from "react";

export function ImageBlockSettings({ block, onChange, setMediaLibraryTarget }: { block: Extract<ContentBlock, { type: "image" }>; onChange: (block: ContentBlock) => void; setMediaLibraryTarget: Dispatch<SetStateAction<MediaLibraryTarget | null>> }) {
  return (
    <div className="space-y-2">
      <Select
        aria-label="Image layout"
        value={block.data.layout ?? "full"}
        onChange={(event) => {
          const layout = event.target.value as NonNullable<
            typeof block.data.layout
          >;
          const layoutWidth =
            layout === "banner" || layout === "text-overlay" || layout === "cover"
              ? "full"
              : layout === "text-left" ||
                layout === "text-right" ||
                layout === "card"
                ? "medium"
                : "small";
          onChange({
            ...block,
            width: layout === "cover" ? "full" : block.widthCustom ? block.width : layoutWidth,
            widthCustom: layout === "cover" ? false : block.widthCustom,
            data: { ...block.data, layout },
          });
        }}
        className="h-9 w-full"
      >
        <option value="full">Image with caption</option>
        <option value="banner">Wide image banner</option>
        <option value="text-left">Text left, image right</option>
        <option value="text-right">Image left, text right</option>
        <option value="text-overlay">Text overlay</option>
        <option value="card">Image feature card</option>
        <option value="cover">Cover — full-width image</option>
      </Select>
      <>
        <label className="block space-y-1 text-xs font-medium text-slate-600">
          Image fit
          <Select aria-label="Image fit" value={block.data.imageFit ?? (!block.data.layout || block.data.layout === "full" ? "contain" : "cover")} onChange={(event) => {
            const fit = imageFitSchema.safeParse(event.target.value);
            if (fit.success) onChange({ ...block, data: { ...block.data, imageFit: fit.data } });
          }} className="h-9 w-full">
            <option value="cover">Cover (crop to fill)</option>
            <option value="contain">Contain (show entire image)</option>
            <option value="fill">Fill (stretch to fit)</option>
          </Select>
        </label>
        <label className="block space-y-1 text-xs font-medium text-slate-600">
          Image focal point
          <Select aria-label="Image focal point" value={block.data.imagePosition ?? (block.data.layout === "cover" ? block.data.coverPosition : undefined) ?? "center"} onChange={(event) => {
            const position = imageCoverPositionSchema.safeParse(event.target.value);
            if (position.success) onChange({ ...block, data: { ...block.data, imagePosition: position.data } });
          }} className="h-9 w-full">
            <option value="center">Center</option>
            <option value="top">Top</option>
            <option value="bottom">Bottom</option>
            <option value="left">Left</option>
            <option value="right">Right</option>
          </Select>
        </label>
        <label className="block space-y-1 text-xs font-medium text-slate-600">
          Image frame ratio
          <Select aria-label="Image frame ratio" value={block.data.imageAspectRatio ?? "default"} onChange={(event) => {
            if (event.target.value === "default") { onChange({ ...block, data: { ...block.data, imageAspectRatio: undefined } }); return; }
            const ratio = imageAspectRatioSchema.safeParse(event.target.value);
            if (ratio.success) onChange({ ...block, data: { ...block.data, imageAspectRatio: ratio.data } });
          }} className="h-9 w-full">
            <option value="default">Use layout default</option>
            <option value="4/3">Landscape (4:3)</option>
            <option value="16/9">Widescreen (16:9)</option>
            <option value="1/1">Square (1:1)</option>
            <option value="3/4">Portrait (3:4)</option>
          </Select>
        </label>
      </>
      {block.data.layout === "cover" && <>
        <label className="block space-y-1 text-xs font-medium text-slate-600">
          Cover height
          <Select
            aria-label="Image cover height"
            disabled={block.data.imageAspectRatio !== undefined}
            value={block.data.coverHeight ?? "medium"}
            onChange={(event) => {
              const height = imageCoverHeightSchema.safeParse(event.target.value);
              if (height.success) onChange({ ...block, data: { ...block.data, coverHeight: height.data } });
            }}
            className="h-9 w-full"
          >
            <option value="short">Short</option>
            <option value="medium">Medium</option>
            <option value="tall">Tall</option>
            <option value="viewport">Screen height</option>
          </Select>
          {block.data.imageAspectRatio && <span className="block text-xs font-normal text-slate-500">Use the default frame ratio to set a cover height.</span>}
        </label>
        <label className="block space-y-1 text-xs font-medium text-slate-600">
          Text overlay darkness
          <div className="flex items-center gap-3">
            <Input
              aria-label="Image cover overlay darkness"
              type="range"
              min={0}
              max={80}
              step={5}
              value={block.data.coverOverlayOpacity ?? 35}
              onChange={(event) => onChange({
                ...block,
                data: { ...block.data, coverOverlayOpacity: Number(event.target.value) },
              })}
              className="h-5 flex-1 p-0"
            />
            <span className="w-10 text-right tabular-nums">{block.data.coverOverlayOpacity ?? 35}%</span>
          </div>
        </label>
      </>}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setMediaLibraryTarget("image")}
      >
        Choose from media library
      </Button>
      <Input
        aria-label="Image URL"
        type="url"
        value={block.data.src}
        onChange={(event) =>
          onChange({
            ...block,
            data: { ...block.data, src: event.target.value },
          })
        }
        placeholder="Image URL"
        className="h-9"
      />
      <Input
        aria-label="Alternative text"
        value={block.data.alt}
        maxLength={500}
        onChange={(event) =>
          onChange({
            ...block,
            data: { ...block.data, alt: event.target.value },
          })
        }
        placeholder="Alternative text"
        className="h-9"
      />
      <Input
        aria-label="Caption"
        value={block.data.caption ?? ""}
        maxLength={1000}
        onChange={(event) =>
          onChange({
            ...block,
            data: { ...block.data, caption: event.target.value },
          })
        }
        placeholder="Caption (optional)"
        className="h-9"
      />
    </div>
  );
}
