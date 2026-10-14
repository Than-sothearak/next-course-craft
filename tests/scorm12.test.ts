// @vitest-environment jsdom
import { inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { DashboardError } from "@/lib/dashboard/rules";
import { createScorm12Manifest } from "@/lib/scorm12/manifest";
import { parseScorm12Snapshot } from "@/lib/scorm12/snapshot";
import { createZipArchive } from "@/lib/scorm12/zip";
import { createScormProgressAdapter } from "@/player/src/scorm-runtime";

const validSnapshot = {
  title: "Safety & onboarding",
  description: "Course description",
  revision: 3,
  sections: [{ id: "section-a", title: "Start", order: 0 }],
  lessons: [{
    id: "lesson-a",
    sectionId: "section-a",
    title: "Welcome",
    order: 0,
    blocks: [{ id: "continue-a", version: 1, type: "divider" as const, data: { style: "continue" as const, label: "Continue" } }],
  }],
};

describe("SCORM 1.2 package primitives", () => {
  it("validates the export snapshot and requires at least one lesson", () => {
    expect(parseScorm12Snapshot(validSnapshot).lessons).toHaveLength(1);
    expect(() => parseScorm12Snapshot({ ...validSnapshot, lessons: [] })).toThrow(DashboardError);
    expect(() => parseScorm12Snapshot({ ...validSnapshot, title: "" })).toThrow("invalid and cannot be exported");
  });

  it("creates an escaped SCORM 1.2 manifest with every package path", () => {
    const manifest = createScorm12Manifest({
      identifier: "course-a-r3",
      title: "Safety & <quality>",
      files: [{ path: "index.html" }, { path: "assets/player.js" }, { path: "media/photo.jpg" }],
    });

    expect(manifest).toContain("<schemaversion>1.2</schemaversion>");
    expect(manifest).toContain('adlcp:scormtype="sco"');
    expect(manifest).toContain("Safety &amp; &lt;quality&gt;");
    expect(manifest).toContain('<file href="assets/player.js"/>');
    expect(manifest).toContain('<file href="media/photo.jpg"/>');
    expect(manifest.match(/index\.html/g)).toHaveLength(2);
    const parsedXml = new DOMParser().parseFromString(manifest, "application/xml");
    expect(parsedXml.getElementsByTagName("parsererror")).toHaveLength(0);
  });

  it("writes a UTF-8 ZIP entry that can be inflated by standard ZIP readers", () => {
    const archive = createZipArchive([{ path: "media/caf\u00e9.txt", data: "SCORM package" }]);
    expect(archive.readUInt32LE(0)).toBe(0x04034b50);
    const filenameLength = archive.readUInt16LE(26);
    const compressedSize = archive.readUInt32LE(18);
    const payloadOffset = 30 + filenameLength;
    const contents = inflateRawSync(archive.subarray(payloadOffset, payloadOffset + compressedSize));
    expect(archive.toString("utf8", 30, payloadOffset)).toBe("media/caf\u00e9.txt");
    expect(contents.toString("utf8")).toBe("SCORM package");
    const endRecord = archive.length - 22;
    const centralOffset = archive.readUInt32LE(endRecord + 16);
    expect(archive.readUInt32LE(endRecord)).toBe(0x06054b50);
    expect(archive.readUInt16LE(endRecord + 10)).toBe(1);
    expect(archive.readUInt32LE(centralOffset)).toBe(0x02014b50);
    expect(archive.readUInt32LE(centralOffset + 42)).toBe(0);
  });

  it("rejects unsafe archive paths", () => {
    expect(() => createZipArchive([{ path: "../imsmanifest.xml", data: "bad" }])).toThrow("cannot traverse");
  });
});

describe("SCORM 1.2 LMS progress adapter", () => {
  function makeHost(initialValues: Record<string, string> = {}) {
    const values = { ...initialValues };
    const calls: string[] = [];
    const listeners = new Map<string, (event: Event) => void>();
    const api = {
      LMSInitialize: (value: "") => (calls.push(`initialize:${value}`), "true"),
      LMSFinish: (value: "") => (calls.push(`finish:${value}`), "true"),
      LMSGetValue: (key: string) => values[key] ?? "",
      LMSSetValue: (key: string, value: string) => (values[key] = value, calls.push(`set:${key}`), "true"),
      LMSCommit: (value: "") => (calls.push(`commit:${value}`), "true"),
    };
    const host = {
      API: api,
      parent: null as unknown,
      opener: null,
      btoa: globalThis.btoa.bind(globalThis),
      atob: globalThis.atob.bind(globalThis),
      setTimeout: (() => 1) as unknown as Window["setTimeout"],
      clearTimeout: (() => undefined) as unknown as Window["clearTimeout"],
      addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => {
        listeners.set(type, listener as (event: Event) => void);
      },
    };
    host.parent = host;
    return {
      host: host as unknown as Window,
      values,
      calls,
      finish: () => listeners.get("pagehide")?.(new Event("pagehide")),
    };
  }

  const course = {
    courseId: "course-a",
    revision: 3,
    sections: [{ id: "section-a", order: 0 }],
    lessons: [{
      id: "lesson-a",
      sectionId: "section-a",
      order: 0,
      blocks: [{ id: "continue-a", type: "divider" }],
    }],
  };

  it("initializes, saves progress for resume, marks completion, commits, and finishes", () => {
    const runtime = makeHost();
    const adapter = createScormProgressAdapter(course, runtime.host);
    expect(adapter).not.toBeNull();
    expect(runtime.calls).toContain("initialize:");

    const partialSnapshot = {
      visitedLessonIds: [],
      lessonScrollProgress: { "lesson-a": 63 },
      revealedDividerIds: ["continue-a"],
      completedDividerIds: [],
      selectedLessonId: "lesson-a",
    };
    adapter!.save("course-a", partialSnapshot, false);
    expect(runtime.values["cmi.core.lesson_status"]).toBe("incomplete");
    expect(adapter!.load("course-a")).toEqual(partialSnapshot);

    const snapshot = {
      ...partialSnapshot,
      visitedLessonIds: ["lesson-a"],
      lessonScrollProgress: { "lesson-a": 100 },
      completedDividerIds: ["continue-a"],
    };
    adapter!.save("course-a", snapshot, true);
    expect(runtime.values["cmi.core.lesson_location"]).toBe("0");
    expect(runtime.values["cmi.core.lesson_status"]).toBe("completed");
    expect(runtime.values["cmi.suspend_data"]).toContain('"k":"course-a:3"');
    expect(runtime.values["cmi.suspend_data"].length).toBeLessThan(4096);

    runtime.finish();
    expect(runtime.calls).toContain("commit:");
    expect(runtime.calls).toContain("finish:");
    const resumedRuntime = makeHost(runtime.values);
    const resumed = createScormProgressAdapter(course, resumedRuntime.host)!.load("course-a");
    expect(resumed).toEqual(snapshot);
  });

  it("returns null when no SCORM 1.2 LMS API is present", () => {
    const host = {
      parent: null as unknown,
      opener: null,
      btoa: globalThis.btoa.bind(globalThis),
      atob: globalThis.atob.bind(globalThis),
    };
    host.parent = host;
    expect(createScormProgressAdapter(course, host as unknown as Window)).toBeNull();
  });

  it("clears completion from an older course revision", () => {
    const runtime = makeHost({
      "cmi.core.lesson_status": "completed",
      "cmi.suspend_data": JSON.stringify({ k: "course-a:2", v: "AQ==" }),
    });
    const adapter = createScormProgressAdapter(course, runtime.host)!;

    expect(adapter.load("course-a")).toMatchObject({ visitedLessonIds: [] });
    expect(runtime.values["cmi.core.lesson_status"]).toBe("incomplete");
    expect(runtime.values["cmi.suspend_data"]).toBe("");
  });
});
