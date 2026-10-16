import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { assertMutationOrigin } from "@/lib/auth/http-security";

afterEach(() => vi.unstubAllEnvs());
describe("authenticated mutation origins", () => {
  it("rejects cross-origin cookie mutations and cross-site requests without an Origin", () => {
    vi.stubEnv("AUTH_URL", "");
    expect(() => assertMutationOrigin(new NextRequest("https://course.example/api/admin/users", { method: "PATCH", headers: { Origin: "https://other.example" } }))).toThrow("origin is not allowed");
    expect(() => assertMutationOrigin(new NextRequest("https://course.example/api/admin/users", { method: "PATCH", headers: { "Sec-Fetch-Site": "cross-site" } }))).toThrow("origin is not allowed");
  });
  it("accepts the configured canonical origin behind a trusted proxy", () => {
    vi.stubEnv("AUTH_URL", "https://course.example");
    expect(() => assertMutationOrigin(new NextRequest("http://localhost/api/admin/users", { method: "PATCH", headers: { Origin: "https://course.example" } }))).not.toThrow();
    expect(() => assertMutationOrigin(new NextRequest("http://localhost/api/admin/users", { method: "PATCH", headers: { Origin: "https://other.example" } }))).toThrow();
  });
});
