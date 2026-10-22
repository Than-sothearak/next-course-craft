import { randomUUID } from "node:crypto";
import { MongoClient, ObjectId } from "mongodb";
import { expect, test, type BrowserContext } from "@playwright/test";
import { instant } from "@next/playwright";

let cookie: string;

test.beforeAll(async () => {
  const client = await new MongoClient(process.env.MONGODB_URI!).connect();
  try {
    const db = client.db();
    if (!db.databaseName.startsWith("coursecraft_verification_")) throw new Error("Run with npm run test:e2e and its isolated database.");
    const now = new Date();
    const userId = new ObjectId();
    const sessionToken = randomUUID();
    await db.collection("users").insertOne({
      _id: userId, name: "Navigation Test Admin", email: `${userId}@example.invalid`,
      role: "super_admin", status: "active", deletedAt: null, createdAt: now, updatedAt: now,
    });
    await db.collection("sessions").insertOne({ userId, sessionToken, expires: new Date(Date.now() + 3_600_000) });
    cookie = sessionToken;
  } finally {
    await client.close();
  }
});

async function authenticate(context: BrowserContext) {
  await context.addCookies([{ name: "authjs.session-token", value: cookie, url: process.env.TEST_APP_ORIGIN!, httpOnly: true, sameSite: "Lax" }]);
}

test("prefetches private admin sections on hover and reuses them on return", async ({ page, context }) => {
  await authenticate(context);
  const paths = ["users", "approvals", "roles", "courses", "workspaces", "audit-logs", "settings"];
  const headings = ["User management", "Approval queue", "Roles & permissions", "Course management", "Workspace management", "Audit log", "Platform settings"];
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "A clear view of Coursecraft", exact: true })).toBeVisible();
  for (const [index, path] of paths.entries()) {
    const link = page.locator(`nav[aria-label="Administration"] a[href="/admin/${path}"]`);
    await link.hover();
    await instant(page, async () => {
      await link.click();
      await expect(page).toHaveURL(new RegExp(`/admin/${path}$`));
      await expect(page.getByRole("heading", { name: headings[index], exact: true })).toBeVisible({ timeout: 3000 });
      if (path === "settings") await expect(page.getByRole("checkbox", { name: "AI generation enabled" })).toBeVisible();
      else await expect(page.getByRole("table").filter({ visible: true })).toBeVisible({ timeout: 3000 });
    });
  }
  await instant(page, async () => {
    await page.goBack();
    await expect(page).toHaveURL(/\/admin\/audit-logs$/);
    await expect(page.getByRole("heading", { name: "Audit log", exact: true })).toBeVisible();
    await expect(page.getByRole("table").filter({ visible: true })).toBeVisible();
  });
});

test("prefetches settings after intent and reuses them on return", async ({ page, context }) => {
  await authenticate(context);
  const settingsPrefetch = page.waitForResponse((response) => new URL(response.url()).pathname === "/admin/settings" && Boolean(response.request().headers()["next-router-prefetch"]) && !response.request().headers()["next-router-segment-prefetch"] && response.ok());
  await page.goto("/admin");
  await expect(page.getByRole("heading", { level: 1 }).filter({ visible: true })).toHaveText("A clear view of Coursecraft");
  await page.locator('nav[aria-label="Administration"] a[href="/admin/settings"]').hover();
  await settingsPrefetch;
  await page.locator('nav[aria-label="Administration"] a[href="/admin/settings"]').click();
  await expect(page.getByRole("checkbox", { name: "AI generation enabled" })).toBeVisible();
  await page.locator('nav[aria-label="Administration"] a[href="/admin/users"]').click();
  await expect(page.getByRole("table").filter({ visible: true })).toBeVisible();

  await instant(page, async () => {
    await page.goBack();
    await expect(page).toHaveURL(/\/admin\/settings$/);
    await expect(page.getByRole("checkbox", { name: "AI generation enabled" })).toBeVisible();
  });
});

for (const intent of ["focus", "touch"] as const) {
  test(`prefetches only the intended Admin page after ${intent}`, async ({ page, context }) => {
    await authenticate(context);
    const destinations: string[] = [];
    page.on("request", (request) => {
      const path = new URL(request.url()).pathname;
      if (path.startsWith("/admin/")) destinations.push(path);
    });
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "A clear view of Coursecraft", exact: true })).toBeVisible();
    expect(destinations).toEqual([]);
    const prefetch = page.waitForResponse((response) => new URL(response.url()).pathname === "/admin/users" && Boolean(response.request().headers()["next-router-prefetch"]) && response.ok());
    const link = page.locator('nav[aria-label="Administration"] a[href="/admin/users"]');
    if (intent === "focus") await link.focus();
    else await link.dispatchEvent("touchstart");
    await prefetch;
    expect(destinations.length).toBeGreaterThan(0);
    expect(destinations.every((path) => path === "/admin/users")).toBe(true);
  });
}

test("invalidates a prefetched workspace list after an admin update", async ({ page, context }) => {
  await authenticate(context);
  await page.goto("/admin/workspaces");
  await page.getByRole("table").filter({ visible: true }).locator("tbody tr").first().getByRole("link", { name: "View", exact: true }).click();
  await expect(page.getByRole("link", { name: "← All workspaces", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Update", exact: true }).filter({ visible: true }).click();
  const dialog = page.getByRole("dialog");
  const name = `Updated workspace ${randomUUID().slice(0, 8)}`;
  await dialog.getByLabel("Workspace name", { exact: true }).fill(name);
  const invalidation = page.waitForResponse((response) => Boolean(response.request().headers()["next-action"]) && response.ok());
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await invalidation;
  await expect(page.getByRole("heading", { level: 1 }).filter({ visible: true })).toHaveText(name);
  await page.getByRole("link", { name: "← All workspaces", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Workspace management", exact: true })).toBeVisible();
  await expect(page.getByRole("table").filter({ visible: true })).toContainText(name);
});
