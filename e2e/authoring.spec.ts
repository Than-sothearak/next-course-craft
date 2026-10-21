import { expect, test, type BrowserContext } from "@playwright/test";

type AuthorFixture = { id: string; name: string; cookie: string; courseIds: string[]; workspaceId: string };
const fixtures = JSON.parse(process.env.TEST_APP_FIXTURES ?? "null") as { authors: AuthorFixture[] } | null;
if (!fixtures || !process.env.TEST_APP_ORIGIN) throw new Error("Run browser tests with npm run test:e2e to start an isolated application and database.");
const authors = fixtures.authors;
async function authenticate(context: BrowserContext) {
  const [name, value] = authors[0].cookie.split("=");
  await context.addCookies([{ name, value, url: process.env.TEST_APP_ORIGIN!, httpOnly: true, sameSite: "Lax" }]);
}

test("anonymous users cannot read the author dashboard", async ({ page, request }) => {
  expect((await request.get("/api/dashboard")).status()).toBe(401);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?/);
});

test("workspace plus creates a new workspace while a team is selected", async ({ page, context }, testInfo) => {
  await authenticate(context);
  await page.goto(`/dashboard?workspaceId=${authors[0].workspaceId}`);
  await page.getByRole("button", { name: "Create team workspace", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Create a team workspace" })).toBeVisible();
  await expect(dialog.getByText("Invite a teammate", { exact: true })).toHaveCount(0);
  const workspaceName = `Browser test workspace ${testInfo.retry}`;
  await dialog.getByRole("textbox", { name: "Workspace name" }).fill(workspaceName);
  await dialog.getByRole("button", { name: "Create workspace", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator("#dashboard-workspace option:checked")).toContainText(workspaceName);
});

test("editor autosave persists the changed course title after reloading", async ({ page, context }, testInfo) => {
  await authenticate(context);
  const courseId = authors[0].courseIds[0];
  await page.goto(`/courses/${courseId}/edit`);
  const title = page.getByPlaceholder("Enter your course title", { exact: true });
  await expect(title).toBeVisible();
  const saved = page.waitForResponse((response) => response.url().endsWith(`/api/courses/${courseId}/editor`) && response.request().method() === "PUT");
  const courseTitle = `Browser test saved course ${testInfo.retry}`;
  await title.fill(courseTitle);
  expect((await saved).status()).toBe(200);
  await page.reload();
  await expect(page.getByPlaceholder("Enter your course title", { exact: true })).toHaveValue(courseTitle);
});

test("an author cannot read another author's private editor", async ({ context }) => {
  await authenticate(context);
  expect((await context.request.get(`/api/courses/${authors[1].courseIds[0]}/editor`)).status()).toBe(404);
});
