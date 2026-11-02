import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as publishHtml } from "@/app/api/courses/[courseId]/publish/route";
import { getCourseEditor } from "@/lib/editor/services/course";
import { editorSnapshotSchema } from "@/lib/editor/schemas";
import { slideMasterSchema } from "@/lib/editor/slide-design";
import { buildScorm12Package, buildScorm2004Package } from "@/lib/scorm/package";

vi.mock("@/lib/db/mongodb", () => ({ connectToDatabase: vi.fn() }));
vi.mock("@/lib/dashboard/http", () => ({
  requireOwnerId: vi.fn(async () => "owner"),
  dashboardErrorResponse: vi.fn(() => new Response(null, { status: 500 })),
}));
vi.mock("@/lib/workspaces/access", () => ({
  resolveCourseAccess: vi.fn(async () => ({ ownerId: "owner" })),
}));
vi.mock("@/lib/editor/services/course", () => ({
  getCourseEditor: vi.fn(),
  getCourseAuthorName: vi.fn(async () => "Author"),
}));
vi.mock("@/lib/media/service", () => ({ storedMediaBytes: vi.fn() }));
vi.mock("node:fs/promises", () => ({
  readdir: vi.fn(async (_path: string, options?: { withFileTypes: boolean }) => {
    const files = ["export.js", "export.css"];
    return options?.withFileTypes
      ? files.map((name) => ({ name, isDirectory: () => false, isFile: () => true }))
      : files;
  }),
  readFile: vi.fn(async (_path: string, encoding?: string) => encoding ? "" : Buffer.from("")),
}));

const courseId = "507f1f77bcf86cd799439012";
const title = "My Presentation មេរៀន";

beforeEach(() => {
  vi.mocked(getCourseEditor).mockResolvedValue({
    courseId,
    ...editorSnapshotSchema.parse({
      title, description: "", revision: 1, courseLayout: "slides",
      sections: [{ id: "section", title: "Section", order: 0 }],
      lessons: [{ id: "slide", sectionId: "section", title: "Slide", order: 0, blocks: [] }],
    }),
    descriptionHtml: undefined,
    courseLayout: "slides",
    slideMaster: slideMasterSchema.parse({}),
  } as Awaited<ReturnType<typeof getCourseEditor>>);
});

describe("presentation export download names", () => {
  it("streams the HTML file with the saved course title", async () => {
    const response = await publishHtml(
      new NextRequest(`http://localhost/api/courses/${courseId}/publish`, { method: "POST" }),
      { params: Promise.resolve({ courseId }) },
    );
    expect(response.status).toBe(200);
    const records = (await response.text()).split("\n");
    const header = records.find((line) => line.startsWith('{"type":"file"'));
    expect(header).toBeDefined();
    expect(JSON.parse(header!).filename).toBe(`${title}.html`);
  });

  it.each([
    ["1.2", buildScorm12Package],
    ["2004", buildScorm2004Package],
  ] as const)("names SCORM %s packages with the title and SCORM version", async (version, build) => {
    const result = await build({ ownerId: "owner", courseId, authorName: "Author" });
    expect(result.filename).toBe(`${title}-scorm-${version}.zip`);
  });
});
