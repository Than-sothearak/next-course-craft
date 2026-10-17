import { z } from "zod";

export const slideMediaSourceSchema = z.string().max(2_048).refine((value) => {
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return false;
  if (!value || value.startsWith("/") && !value.startsWith("//")) return true;
  try { return ["http:", "https:"].includes(new URL(value).protocol); } catch { return false; }
}, "Media must use an app path or HTTP(S) URL.");
