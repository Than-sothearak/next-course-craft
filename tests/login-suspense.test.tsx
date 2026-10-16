import { isValidElement, Suspense, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "../app/login/page";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  signIn: vi.fn(),
  redirect: vi.fn((path: string) => { throw new Error(`Redirect to ${path}`); }),
}));

vi.mock("../lib/auth", () => ({ auth: mocks.auth, signIn: mocks.signIn }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/server", async (original) => ({ ...await original<typeof import("next/server")>(), connection: vi.fn(async () => undefined) }));

type LoginPageProps = {
  searchParams: Promise<{ callbackUrl?: string }>;
};

function collectFormActions(node: unknown): Array<(formData: FormData) => unknown> {
  if (Array.isArray(node)) return node.flatMap(collectFormActions);
  if (!isValidElement(node)) return [];

  const element = node as ReactElement<{ action?: unknown; children?: unknown }>;
  const action = typeof element.props.action === "function"
    ? [element.props.action as (formData: FormData) => unknown]
    : [];

  return [...action, ...collectFormActions(element.props.children)];
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue(null);
});

describe("login loading boundary", () => {
  it("defers session access inside Suspense and provides a login-shaped fallback", async () => {
    const props: LoginPageProps = {
      searchParams: Promise.resolve({ callbackUrl: "/dashboard" }),
    };
    const page = LoginPage(props) as ReactElement<{
      children: ReactElement<LoginPageProps>;
      fallback: ReactElement;
    }>;

    expect(page.type).toBe(Suspense);
    expect(mocks.auth).not.toHaveBeenCalled();
    expect(renderToStaticMarkup(page.props.fallback)).toContain('aria-label="Loading sign-in page"');

    const loadLogin = page.props.children.type as (input: LoginPageProps) => Promise<ReactElement>;
    const content = await loadLogin(page.props.children.props);

    expect(mocks.auth).toHaveBeenCalledOnce();
    expect(content.type).toBe("main");
  });

  it("keeps the validated callback redirect for authenticated sessions", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
    const props: LoginPageProps = {
      searchParams: Promise.resolve({ callbackUrl: "//example.com" }),
    };
    const page = LoginPage(props) as ReactElement<{ children: ReactElement<LoginPageProps> }>;
    const loadLogin = page.props.children.type as (input: LoginPageProps) => Promise<ReactElement>;

    await expect(loadLogin(page.props.children.props)).rejects.toThrow("Redirect to /");
    expect(mocks.redirect).toHaveBeenCalledWith("/");
  });

  it("starts Google sign-in with the validated callback redirect", async () => {
    const props: LoginPageProps = {
      searchParams: Promise.resolve({ callbackUrl: "/dashboard?view=recent" }),
    };
    const page = LoginPage(props) as ReactElement<{ children: ReactElement<LoginPageProps> }>;
    const loadLogin = page.props.children.type as (input: LoginPageProps) => Promise<ReactElement>;
    const content = await loadLogin(page.props.children.props);
    const [googleAction] = collectFormActions(content);

    expect(googleAction).toBeTypeOf("function");
    await googleAction(new FormData());

    expect(mocks.signIn).toHaveBeenCalledWith("google", {
      redirectTo: "/dashboard?view=recent",
    });
  });
});
