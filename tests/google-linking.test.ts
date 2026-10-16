import { describe, expect, it, vi } from "vitest";
import { allowGoogleSignIn } from "@/lib/auth/google-linking";

const profile = { email: "person@example.com", email_verified: true };
function lookup(role = "editor", current: string | null = null) {
  return { isLinked: vi.fn(async () => false), findByEmail: vi.fn(async () => ({ id: "existing", role, status: "active" })), currentUserId: vi.fn(async () => current) };
}
describe("Google identity linking with platform administration", () => {
  it("allows a verified Google email to link an ordinary existing account", async () => {
    expect(await allowGoogleSignIn(profile, lookup())).toBe(true);
    expect(await allowGoogleSignIn({ ...profile, email_verified: false }, lookup())).toBe(false);
  });
  it.each(["admin", "super_admin"])("does not add Google to a %s account based solely on email", async (role) => {
    expect(await allowGoogleSignIn(profile, lookup(role))).toBe(false);
    expect(await allowGoogleSignIn(profile, lookup(role, "another-user"))).toBe(false);
    expect(await allowGoogleSignIn(profile, lookup(role, "existing"))).toBe(true);
  });
  it("accepts an already linked Google identity without inferring any role from email", async () => {
    const dependencies = lookup("super_admin");
    dependencies.isLinked.mockResolvedValue(true);
    expect(await allowGoogleSignIn(profile, dependencies)).toBe(true);
    expect(dependencies.findByEmail).not.toHaveBeenCalled();
  });
});
