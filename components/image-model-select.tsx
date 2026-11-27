"use client";

import { createContext, useContext, type ComponentProps } from "react";
import { Select } from "@/components/ui/select";
import { courseImageModelValues, defaultCourseImageGenerationModel, type CourseImageModel } from "@/lib/ai/image-style";

export const DefaultImageModelContext = createContext(defaultCourseImageGenerationModel);

export function ImageModelSelect({ value, onChange, defaultModel, ...props }: Omit<ComponentProps<typeof Select>, "value" | "onChange" | "children"> & {
  value?: CourseImageModel;
  onChange: (model: CourseImageModel | undefined) => void;
  defaultModel?: string;
}) {
  const contextDefault = useContext(DefaultImageModelContext);
  return <Select {...props} value={value ?? ""} onChange={(event) => onChange(event.target.value ? event.target.value as CourseImageModel : undefined)}>
    <option value="">Default ({defaultModel ?? contextDefault})</option>
    {courseImageModelValues.map((model) => <option key={model} value={model}>{model}</option>)}
  </Select>;
}
