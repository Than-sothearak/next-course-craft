import type { PreviewDevice, PreviewOrientation } from "../preview-types";

export function previewFrameSize(device: PreviewDevice, orientation: PreviewOrientation, availableWidth: number, availableHeight: number) {
  const width = Math.max(0, availableWidth);
  const height = Math.max(0, availableHeight);
  if (device === "desktop") return { width, height };
  const landscape = orientation === "landscape";
  const nominal = device === "mobile"
    ? landscape ? { width: 844, height: 390 } : { width: 390, height: 844 }
    : landscape ? { width: 1024, height: 768 } : { width: 768, height: 1024 };
  const scale = Math.min(1, width / nominal.width, height / nominal.height);
  return { width: nominal.width * scale, height: nominal.height * scale };
}
