import { afterEach, describe, expect, it, vi } from "vitest";
import { sessionRequest, SessionRequestError } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/generation-session-request";

afterEach(() => vi.unstubAllGlobals());

describe("generation session response handling", () => {
  it("reports an empty successful response as a request error instead of throwing while parsing JSON", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 200 })));

    const error = await sessionRequest("course-1").catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(SessionRequestError);
    expect(error).toMatchObject({
      message: "The generation server returned an empty response. Retry the action.",
      status: 502,
    });
  });

  it("still accepts a JSON null response for a course without a generation session", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(null)));

    await expect(sessionRequest("course-1")).resolves.toBeNull();
  });
});
