import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ config: null as unknown }));

vi.mock("next-auth", () => ({
  default: (config: unknown) => {
    mocks.config = config;
    return { handlers: {}, auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() };
  },
}));

vi.mock("next-auth/providers/google", () => ({
  default: (options: Record<string, unknown>) => ({ id: "google", ...options }),
}));

vi.mock("next-auth/providers/github", () => ({
  default: { id: "github" },
}));

type SignInInput = {
  account?: { provider: string } | null;
  profile?: { email?: string; email_verified?: boolean } | null;
};

type AuthOptions = {
  providers: Array<{
    id: string;
    allowDangerousEmailAccountLinking?: boolean;
  }>;
  callbacks: {
    signIn: (input: SignInInput) => boolean | Promise<boolean>;
  };
};

function getAuthOptions(): AuthOptions {
  return mocks.config as AuthOptions;
}

describe("OAuth account linking", () => {
  beforeAll(async () => {
    vi.stubEnv("MONGODB_URI", "");
    vi.resetModules();
    await import("../lib/auth");
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it("allows email-based linking only for Google", () => {
    const { providers } = getAuthOptions();
    const google = providers.find((provider) => provider.id === "google");
    const github = providers.find((provider) => provider.id === "github");

    expect(google?.allowDangerousEmailAccountLinking).toBe(true);
    expect(github?.allowDangerousEmailAccountLinking).not.toBe(true);
  });

  it("requires Google to report a verified email", async () => {
    const { signIn } = getAuthOptions().callbacks;

    expect(await signIn({
      account: { provider: "google" },
      profile: { email: "person@example.com", email_verified: true },
    })).toBe(true);
    expect(await signIn({
      account: { provider: "google" },
      profile: { email: "person@example.com", email_verified: false },
    })).toBe(false);
    expect(await signIn({
      account: { provider: "google" },
      profile: {},
    })).toBe(false);
  });
});
