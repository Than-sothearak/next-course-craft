"use client";

import type { ContentBlock } from "@/lib/schemas/block";
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
            layout === "banner" || layout === "text-overlay"
              ? "full"
              : layout === "text-left" ||
                layout === "text-right" ||
                layout === "card"
                ? "medium"
                : "small";
          onChange({
            ...block,
            width: block.widthCustom ? block.width : layoutWidth,
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
      </Select>
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
