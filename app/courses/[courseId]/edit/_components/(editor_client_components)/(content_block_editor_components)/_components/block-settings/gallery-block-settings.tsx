"use client";

import { Plus, Trash2 } from "lucide-react";
import type { ContentBlock } from "@/lib/schemas/block";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MediaLibraryTarget } from "../content-block-types";
import type { Dispatch, SetStateAction } from "react";

export function GalleryBlockSettings({ block, setSelectedGalleryImageIndex, setMediaLibraryTarget, onChange }: { block: Extract<ContentBlock, { type: "gallery" }>; setSelectedGalleryImageIndex: Dispatch<SetStateAction<number | null>>; setMediaLibraryTarget: Dispatch<SetStateAction<MediaLibraryTarget | null>>; onChange: (block: ContentBlock) => void }) {
  return (
    <div className="space-y-3">
      {block.data.images.map((image, index) => (
        <div
          key={`${block.id}-image-settings-${index}`}
          className="flex items-start gap-2 rounded-lg border border-slate-100 p-2"
        >
          <div className="min-w-0 flex-1 space-y-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedGalleryImageIndex(index);
                setMediaLibraryTarget("gallery");
              }}
            >
              Choose from media library
            </Button>
            <Input
              aria-label={`Gallery image ${index + 1} URL`}
              type="url"
              value={image.src}
              onChange={(event) =>
                onChange({
                  ...block,
                  data: {
                    images: block.data.images.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, src: event.target.value }
                        : item,
                    ),
                  },
                })
              }
              placeholder="Image URL"
              className="h-9"
            />
            <Input
              aria-label={`Gallery image ${index + 1} alternative text`}
              value={image.alt}
              maxLength={500}
              onChange={(event) =>
                onChange({
                  ...block,
                  data: {
                    images: block.data.images.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, alt: event.target.value }
                        : item,
                    ),
                  },
                })
              }
              placeholder="Alternative text"
              className="h-9"
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Remove gallery image ${index + 1}`}
            disabled={block.data.images.length <= 1}
            onClick={() =>
              onChange({
                ...block,
                data: {
                  images: block.data.images.filter(
                    (_, itemIndex) => itemIndex !== index,
                  ),
                },
              })
            }
            className="size-8 text-slate-400 hover:text-rose-700"
          >
            <Trash2 size={14} />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={block.data.images.length >= 8}
        onClick={() =>
          onChange({
            ...block,
            data: {
              images: [
                ...block.data.images,
                {
                  src: "https://placehold.co/480x360?text=Add+image",
                  alt: "",
                },
              ],
            },
          })
        }
      >
        <Plus size={14} />
        Add image
      </Button>
    </div>
  );
}
