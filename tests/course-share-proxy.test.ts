import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import proxy from "@/proxy";

const mocks = vi.hoisted(() => ({ principal: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: (handler: unknown) => handler }));
vi.mock("@/lib/auth/authorization", () => ({ getFreshPrincipal: mocks.principal }));

type Request = NextRequest & { auth?: { user: { id: string } } | null };
const handle = proxy as unknown as (request: Request) => Promise<Response>;

beforeEach(() => vi.clearAllMocks());

describe("public course routing", () => {
  it("allows a shared learner URL without a session", async () => {
    const response = await handle(new NextRequest(`http://localhost/share/${"a".repeat(48)}`));
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(mocks.principal).not.toHaveBeenCalled();
  });

  it("allows public learning even with a suspended account session", async () => {
    mocks.principal.mockResolvedValue({ status: "suspended" });
    const request = new NextRequest(`http://localhost/share/${"a".repeat(48)}`) as Request;
    request.auth = { user: { id: "user" } };
    expect((await handle(request)).headers.get("x-middleware-next")).toBe("1");
    expect(mocks.principal).not.toHaveBeenCalled();
  });

  it.each(["/dashboard", "/courses/private/edit", "/share/token/edit"])("retains the login gate for %s", async (path) => {
    const response = await handle(new NextRequest(`http://localhost${path}`));
    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location")!).pathname).toBe("/login");
  });
});
