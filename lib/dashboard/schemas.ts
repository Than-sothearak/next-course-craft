import { z } from "zod";

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Invalid identifier.");
export const nullableObjectIdSchema = objectIdSchema.nullable();

export const folderNameSchema = z.string().trim().min(1, "Enter a folder name.").max(120, "Folder names must be 120 characters or fewer.");
export const createFolderSchema = z.object({ name: folderNameSchema, parentId: nullableObjectIdSchema.default(null), workspaceId: nullableObjectIdSchema.default(null) });
export const updateFolderSchema = z.object({ name: folderNameSchema.optional(), parentId: nullableObjectIdSchema.optional() }).refine((value) => value.name !== undefined || value.parentId !== undefined, "Change a name or destination.");

const externalCourseCoverImageSchema = z.string().url().max(2_048).refine((value) => {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}, "Cover image must use HTTP or HTTPS.");
const courseMediaFileUrlSchema = z.string().regex(/^\/api\/assets\/[a-f\d]{24}\/file$/i, "Choose a media asset from this course.");
const courseCoverImageSchema = z.union([externalCourseCoverImageSchema, courseMediaFileUrlSchema]);

import { courseLayoutSchema } from "@/lib/editor/course-layout";

export const createCourseSchema = z.object({
  courseLayout: courseLayoutSchema.optional(),
  title: z.string().trim().min(1, "Enter a course title.").max(160, "Course titles must be 160 characters or fewer."),
  description: z.string().trim().max(5_000).default(""),
  coverImage: externalCourseCoverImageSchema.nullable().optional(),
  folderId: nullableObjectIdSchema.default(null),
  workspaceId: nullableObjectIdSchema.default(null),
});
export const updateCourseSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(5_000).optional(),
  coverImage: courseCoverImageSchema.nullable().optional(),
  folderId: nullableObjectIdSchema.optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
}).refine((value) => Object.keys(value).length > 0, "Provide at least one course field to change.");
export const deleteCourseSchema = z.object({ confirmTitle: z.string().trim().min(1) });
export const duplicateCourseSchema = z.object({ workspaceId: nullableObjectIdSchema });

export type CreateFolderInput = z.infer<typeof createFolderSchema>;
export type UpdateFolderInput = z.infer<typeof updateFolderSchema>;
export type CreateCourseInput = z.infer<typeof createCourseSchema>;
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>;
export type DuplicateCourseInput = z.infer<typeof duplicateCourseSchema>;
