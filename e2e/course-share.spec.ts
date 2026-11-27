import { expect, test } from "@playwright/test";

const fixtures = JSON.parse(process.env.TEST_APP_FIXTURES ?? "null") as {
  authors: Array<{ cookie: string; courseIds: string[] }>;
} | null;
if (!fixtures || !process.env.TEST_APP_ORIGIN) throw new Error("Run with npm run test:e2e to use an isolated application and database.");
const author = fixtures.authors[0];

test("publishes a course from the Publish menu and revokes anonymous access", async ({ page, context, browser }) => {
  const [name, value] = author.cookie.split("=");
  await context.addCookies([{ name, value, url: process.env.TEST_APP_ORIGIN!, httpOnly: true, sameSite: "Lax" }]);
  await page.goto(`/courses/${author.courseIds[0]}/preview`);
  await page.getByRole("button", { name: "Publish course", exact: true }).click();
  await page.getByRole("menuitem", { name: "Share link", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Share course", exact: true });
  await dialog.getByRole("button", { name: "Publish share link", exact: true }).click();
  const input = dialog.getByRole("textbox", { name: "Public share link", exact: true });
  await expect(input).toHaveValue(/\/share\/[a-f\d]{48}$/);
  const url = await input.inputValue();
  const anonymous = await browser.newContext();
  try {
    const learner = await anonymous.newPage();
    const errors: string[] = [];
    learner.on("pageerror", (error) => errors.push(error.message));
    await learner.goto(url);
    await expect(learner.getByRole("button", { name: "Start learning", exact: true })).toBeVisible();
    await expect(learner.getByRole("button", { name: "Publish course", exact: true })).toHaveCount(0);
    await learner.getByRole("button", { name: "Start learning", exact: true }).click();
    await expect(learner.getByText("Training activity 1.", { exact: false }).first()).toBeVisible();
    await learner.setViewportSize({ width: 390, height: 844 });
    expect(await learner.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await dialog.getByRole("button", { name: "Publish update", exact: true }).click();
    await expect(input).toHaveValue(url);
    await dialog.getByRole("button", { name: "Turn off link", exact: true }).click();
    await expect(dialog.getByText("Public access is off. The previous link no longer works.", { exact: true })).toBeVisible();
    await learner.goto(url);
    await expect(learner.getByRole("heading", { name: "404", exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  } finally { await anonymous.close(); }
});
