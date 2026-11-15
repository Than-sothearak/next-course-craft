import { afterEach, describe, expect, it, vi } from "vitest";
import { BSON } from "mongodb";
import { Types } from "mongoose";
import { GenerationCheckpoint } from "@/models/GenerationCheckpoint";
import { editorLessonSchema } from "@/lib/editor/schemas";
import { generationCheckpointPayload, saveGenerationCheckpoint } from "@/lib/ai/generation/generation-job-store";

const job = { _id: new Types.ObjectId(), ownerId: new Types.ObjectId(), courseId: new Types.ObjectId(), expiresAt: new Date() };
const draft = () => editorLessonSchema.parse({
  id: "lesson", sectionId: "learn", title: "Lesson", order: 0,
  blocks: [
    { id: "image", version: 1, type: "image", data: {
      src: "/api/assets/image/file", alt: "Diagram", caption: undefined, title: undefined, body: undefined,
    } },
    { id: "graphic", version: 1, type: "labeledGraphic", data: {
      src: "/api/assets/graphic/file", alt: "Labeled diagram", markerColor: undefined, textColor: undefined, radarColor: undefined,
      markers: [{ id: "marker", label: "Part", description: "Description", x: 50, y: 50, color: undefined }],
    } },
  ],
});
const bsonRoundTrip = (payload: unknown) => BSON.deserialize(BSON.serialize({ payload }, { ignoreUndefined: false })).payload as unknown;
afterEach(() => vi.restoreAllMocks());

describe("image generation checkpoint persistence", () => {
  it("keeps a generated lesson valid through a BSON save and reload", async () => {
    const lesson = draft();
    // This is the failure caused by storing explicit undefined values in Mixed payloads.
    expect(editorLessonSchema.safeParse(bsonRoundTrip(lesson)).success).toBe(false);
    let stored: unknown;
    vi.spyOn(GenerationCheckpoint, "updateOne").mockImplementation((async (_filter: unknown, update: { $setOnInsert: { payload: unknown } }) => {
      stored = bsonRoundTrip(update.$setOnInsert.payload);
      return {};
    }) as never);
    vi.spyOn(GenerationCheckpoint, "findOne").mockImplementation((() => ({ lean: async () => ({ payload: stored }) })) as never);
    await saveGenerationCheckpoint(job, "sessionDraft", "lesson", lesson);
    expect(editorLessonSchema.safeParse(stored).success).toBe(true);
    expect(editorLessonSchema.parse(await generationCheckpointPayload(job, "sessionDraft", "lesson"))).toEqual(lesson);
  });

  it("recovers existing image draft checkpoints with null optional fields", async () => {
    const stored = bsonRoundTrip(draft());
    vi.spyOn(GenerationCheckpoint, "findOne").mockImplementation((() => ({ lean: async () => ({ payload: stored }) })) as never);
    expect(editorLessonSchema.parse(await generationCheckpointPayload(job, "sessionDraft", "lesson"))).toEqual(draft());
  });

  it("continues rejecting null required image fields", async () => {
    const stored = draft();
    const broken = { ...stored, blocks: [{ ...stored.blocks[0], data: { src: null, alt: null } }] };
    vi.spyOn(GenerationCheckpoint, "findOne").mockImplementation((() => ({ lean: async () => ({ payload: broken }) })) as never);
    expect(editorLessonSchema.safeParse(await generationCheckpointPayload(job, "sessionDraft", "lesson")).success).toBe(false);
  });
});
