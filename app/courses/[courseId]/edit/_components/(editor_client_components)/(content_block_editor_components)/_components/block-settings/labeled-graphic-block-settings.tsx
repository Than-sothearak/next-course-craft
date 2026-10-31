"use client";

import { ColorPicker } from "@/components/ui/color-picker";

import { Plus, Trash2 } from "lucide-react";
import type { ContentBlock } from "@/lib/schemas/block";
import { createClientId } from "@/lib/client-id";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { graphicImageFitSchema } from "@/lib/editor/graphic-layout";
import type { MediaLibraryTarget } from "../content-block-types";
import type { Dispatch, SetStateAction } from "react";

export function LabeledGraphicBlockSettings({ block, onChange, setMediaLibraryTarget, presentation = false }: { block: Extract<ContentBlock, { type: "labeledGraphic" }>; onChange: (block: ContentBlock) => void; setMediaLibraryTarget: Dispatch<SetStateAction<MediaLibraryTarget | null>>; presentation?: boolean }) {
  return (
    <div className="space-y-3">
      {presentation && <label className="block space-y-1 text-xs font-medium text-slate-600">Image fit
        <Select aria-label="Interactive image fit" value={block.data.objectFit ?? "fill"} className="h-9" onChange={(event) => {
          const fit = graphicImageFitSchema.safeParse(event.target.value);
          if (fit.success) onChange({ ...block, data: { ...block.data, objectFit: fit.data } });
        }}>
          <option value="fill">Fill</option><option value="cover">Cover</option><option value="contain">Contain</option><option value="scale-down">Scale down</option><option value="none">Original size</option>
        </Select>
      </label>}
      <Select
        aria-label="Graphic interaction mode"
        value={block.data.interactionMode ?? "explore"}
        onChange={(event) => {
          const interactionMode = event.target.value as "explore" | "spotTarget";
          const markers = interactionMode === "spotTarget"
            ? block.data.markers.map((marker, index) => ({
              ...marker,
              isTarget: block.data.markers.some((entry) => entry.isTarget)
                ? Boolean(marker.isTarget)
                : index === 0,
            }))
            : block.data.markers;
          onChange({
            ...block,
            data: {
              ...block.data,
              interactionMode,
              ...(interactionMode === "spotTarget" ? {
                sceneTheme: block.data.sceneTheme ?? "data",
                challengePrompt: block.data.challengePrompt ?? "Find the clue in the scene.",
                successMessage: block.data.successMessage ?? "Clue found! Great work scanning the scene.",
              } : {}),
              markers,
            },
          });
        }}
        className="h-9 w-full"
      >
        <option value="explore">Explore hotspots</option>
        <option value="spotTarget">Spot the clue mini-game</option>
      </Select>
      {block.data.interactionMode === "spotTarget" ? (
        <>
          <Select
            aria-label="Mini-game scene"
            value={block.data.sceneTheme ?? "data"}
            onChange={(event) => onChange({
              ...block,
              data: { ...block.data, sceneTheme: event.target.value as NonNullable<typeof block.data.sceneTheme> },
            })}
            className="h-9 w-full"
          >
            <option value="data">Data dashboard</option>
            <option value="security">Security inbox</option>
            <option value="network">Network map</option>
            <option value="agriculture">Crop field</option>
          </Select>
          <Textarea
            aria-label="Mini-game challenge"
            value={block.data.challengePrompt ?? ""}
            maxLength={300}
            onChange={(event) => onChange({
              ...block,
              data: { ...block.data, challengePrompt: event.target.value },
            })}
            placeholder="What should learners find?"
            className="min-h-16 resize-y"
          />
          <Textarea
            aria-label="Mini-game success message"
            value={block.data.successMessage ?? ""}
            maxLength={500}
            onChange={(event) => onChange({
              ...block,
              data: { ...block.data, successMessage: event.target.value },
            })}
            placeholder="What should learners learn after finding it?"
            className="min-h-16 resize-y"
          />
          <p className="text-xs text-slate-500">Choose exactly one winning hotspot. Drag the points on the graphic to line them up with scene details.</p>
        </>
      ) : (
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setMediaLibraryTarget("labeledGraphic")}
          >
            Choose graphic from media library
          </Button>
          <Input
            aria-label="Graphic image URL"
            type="url"
            value={block.data.src}
            onChange={(event) => onChange({ ...block, data: { ...block.data, src: event.target.value, mapTemplate: undefined } })}
            placeholder="Image URL"
            className="h-9"
          />
        </>
      )}
      <Input
        aria-label="Graphic alternative text"
        value={block.data.alt}
        maxLength={500}
        onChange={(event) => onChange({ ...block, data: { ...block.data, alt: event.target.value } })}
        placeholder="Describe the image or game scene"
        className="h-9"
      />
      {block.data.interactionMode !== "spotTarget" && (
        <p className="text-xs text-slate-500">
          Drag a point on the image to position it. Click a point to preview its popup.
        </p>
      )}
      <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-2">
        <label className="block space-y-1 text-xs font-medium text-slate-600">
          Default point color
          <ColorPicker
            aria-label="Graphic marker color"
            value={block.data.markerColor ?? "#2f5f9f"}
            onChange={(color) => onChange({
              ...block,
              data: { ...block.data, markerColor: color },
            })}
          />
        </label>
        <label className="block space-y-1 text-xs font-medium text-slate-600">
          Number text
          <ColorPicker
            aria-label="Graphic marker text color"
            value={block.data.textColor ?? "#ffffff"}
            onChange={(color) => onChange({
              ...block,
              data: { ...block.data, textColor: color },
            })}
          />
        </label>
        <label className="block space-y-1 text-xs font-medium text-slate-600">
          Radar pulse
          <ColorPicker
            aria-label="Graphic marker radar color"
            value={block.data.radarColor ?? block.data.markerColor ?? "#2f5f9f"}
            onChange={(color) => onChange({
              ...block,
              data: { ...block.data, radarColor: color },
            })}
          />
        </label>
      </div>
      {block.data.markers.map((marker, index) => (
        <div key={marker.id} className="space-y-2 rounded-lg border border-slate-200 p-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-500">Marker {index + 1}</span>
            {block.data.markers.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Delete graphic marker ${index + 1}`}
                onClick={() => onChange({
                  ...block,
                  data: { ...block.data, markers: block.data.markers.filter((entry) => entry.id !== marker.id) },
                })}
                className="size-8 text-slate-400 hover:text-rose-600"
              >
                <Trash2 size={14} />
              </Button>
            )}
          </div>
          <label className="block space-y-1 text-xs font-medium text-slate-600">
            Point color
            <span className="flex min-w-0 items-start gap-1">
              <ColorPicker aria-label={`Graphic marker ${index + 1} color`} value={marker.color ?? block.data.markerColor ?? "#2f5f9f"} onChange={(color) => onChange({ ...block, data: { ...block.data, markers: block.data.markers.map((entry) => entry.id === marker.id ? { ...entry, color: color } : entry) } })} />
              {marker.color && <Button type="button" variant="ghost" size="sm" aria-label={`Use default color for graphic marker ${index + 1}`} onClick={() => onChange({ ...block, data: { ...block.data, markers: block.data.markers.map((entry) => entry.id === marker.id ? { ...entry, color: undefined } : entry) } })}>Use default</Button>}
            </span>
          </label>
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
            <Checkbox aria-label={`Graphic marker ${index + 1} radar animation`} checked={marker.radarEnabled !== false} onChange={(event) => onChange({ ...block, data: { ...block.data, markers: block.data.markers.map((entry) => entry.id === marker.id ? { ...entry, radarEnabled: event.target.checked } : entry) } })} />
            Radar animation
          </label>
          <Input
            aria-label={`Graphic marker ${index + 1} label`}
            value={marker.label}
            maxLength={100}
            onChange={(event) => onChange({
              ...block,
              data: { ...block.data, markers: block.data.markers.map((entry) => entry.id === marker.id ? { ...entry, label: event.target.value } : entry) },
            })}
            placeholder="Marker label"
            className="h-9"
          />
          <Textarea
            aria-label={`Graphic marker ${index + 1} explanation`}
            value={marker.description}
            maxLength={2000}
            onChange={(event) => onChange({
              ...block,
              data: { ...block.data, markers: block.data.markers.map((entry) => entry.id === marker.id ? { ...entry, description: event.target.value } : entry) },
            })}
            placeholder="What should learners know about this part?"
            className="min-h-16 resize-y"
          />
          {block.data.interactionMode === "spotTarget" && (
            <>
              <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                <Checkbox
                  aria-label={`Mark hotspot ${index + 1} as the correct target`}
                  checked={Boolean(marker.isTarget)}
                  onChange={(event) => onChange({
                    ...block,
                    data: {
                      ...block.data,
                      markers: block.data.markers.map((entry) => ({
                        ...entry,
                        isTarget: event.target.checked ? entry.id === marker.id : entry.id === marker.id ? false : entry.isTarget,
                      })),
                    },
                  })}
                />
                Correct target
              </label>
              <Textarea
                aria-label={`Graphic marker ${index + 1} retry hint`}
                value={marker.missFeedback ?? ""}
                maxLength={500}
                onChange={(event) => onChange({
                  ...block,
                  data: { ...block.data, markers: block.data.markers.map((entry) => entry.id === marker.id ? { ...entry, missFeedback: event.target.value } : entry) },
                })}
                placeholder="Hint shown when this point is missed"
                className="min-h-14 resize-y"
              />
            </>
          )}
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={block.data.markers.length >= 20}
        onClick={() => onChange({
          ...block,
          data: { ...block.data, markers: [...block.data.markers, { id: createClientId(), label: "New marker", description: "", x: 50, y: 50, ...(block.data.interactionMode === "spotTarget" ? { isTarget: false } : {}) }] },
        })}
        className="w-full justify-center"
      >
        <Plus size={14} /> Add marker
      </Button>
    </div>
  );
}
