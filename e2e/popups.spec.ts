import { expect, test, type Locator } from "@playwright/test";

const fixtures = JSON.parse(process.env.TEST_APP_FIXTURES ?? "null") as {
  authors: Array<{ name: string; cookie: string; courseIds: string[] }>;
} | null;
if (!fixtures || !process.env.TEST_APP_ORIGIN) throw new Error("Run with npm run test:e2e to use an isolated application and database.");
const author = fixtures.authors[0];
// Existing course-card dates use the runtime locale. Match the server so this
// interaction check does not fail on a host/browser date-format mismatch.
const runtimeFormat = Intl.DateTimeFormat().resolvedOptions();
test.use({ locale: runtimeFormat.locale, timezoneId: runtimeFormat.timeZone });

test("general dialogs fade out before removal across close, cancel, Escape and backdrop actions", async ({ page, context }) => {
  const [name, value] = author.cookie.split("=");
  await context.addCookies([{ name, value, url: process.env.TEST_APP_ORIGIN!, httpOnly: true, sameSite: "Lax" }]);
  await page.goto("/dashboard");

  async function closeWithFade(dialog: Locator, action: () => Promise<unknown>) {
    await expect(dialog).toBeVisible();
    const titleId = await dialog.getAttribute("aria-labelledby");
    const surface = page.locator(`[data-modal-panel][aria-labelledby="${titleId}"]`);
    const native = await surface.evaluate((element) => element.tagName === "DIALOG");
    const motion = native ? surface : surface.locator("..");
    expect(await motion.evaluate((element) => getComputedStyle(element).animationName)).toBe("ui-modal-fade-in");
    await action();
    await expect(surface).toHaveAttribute("data-state", "closed");
    expect(await motion.evaluate((element) => getComputedStyle(element).animationName)).toBe("ui-modal-fade-out");
    await expect(surface).toBeHidden();
  }

  for (const action of ["close", "cancel", "Escape", "backdrop"] as const) {
    await page.getByRole("button", { name: "Create folder", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Create a folder", exact: true });
    await closeWithFade(dialog, () => action === "Escape" ? page.keyboard.press("Escape") : action === "backdrop" ? page.mouse.click(1, 400) : dialog.getByRole("button", { name: action === "close" ? "Close dialog" : "Cancel", exact: true }).click());
  }
  await page.getByRole("button", { name: "Create team workspace", exact: true }).click();
  const workspace = page.getByRole("dialog", { name: "Create a team workspace", exact: true });
  await closeWithFade(workspace, () => workspace.getByRole("button", { name: "Close workspace dialog", exact: true }).click());

  await page.getByRole("button", { name: "Publish course", exact: true }).first().click();
  await page.getByRole("menuitem", { name: "Share link", exact: true }).click();
  const share = page.getByRole("dialog", { name: "Share course", exact: true });
  await expect(share.getByRole("button", { name: "Close dialog", exact: true })).toBeEnabled();
  await closeWithFade(share, () => share.getByRole("button", { name: "Close dialog", exact: true }).click());

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Create folder", exact: true }).click();
  const reduced = page.getByRole("dialog", { name: "Create a folder", exact: true });
  expect(await reduced.locator("..").evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
  await reduced.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(reduced).toHaveCount(0);
});

test("dashboard and editor settings share fades, mouse dismissal, keyboard focus and nested media behavior", async ({ page, context }, testInfo) => {
  const [name, value] = author.cookie.split("=");
  await context.addCookies([{ name, value, url: process.env.TEST_APP_ORIGIN!, httpOnly: true, sameSite: "Lax" }]);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/dashboard");

  async function checkPopup(trigger: Locator, label: string) {
    await trigger.click();
    const popup = page.locator('[data-ui-popover][data-state="open"]');
    await expect(popup).toBeVisible();
    const popupId = await popup.getAttribute("id");
    const ownPopup = page.locator(`[data-ui-popover][id="${popupId}"]`);
    expect(await popup.evaluate((element) => getComputedStyle(element).animationDuration)).toBe("0.15s");
    await popup.hover();
    await page.screenshot({ path: testInfo.outputPath(`${label}.png`) });
    await page.mouse.move(1, 1);
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(ownPopup).toHaveCount(0);
    await trigger.click();
    await expect(popup).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    await expect(ownPopup).toHaveCount(0);
  }

  await checkPopup(page.getByRole("button", { name: `Open profile menu for ${author.name}`, exact: true }), "profile");
  await checkPopup(page.getByRole("button", { name: "Manage Training", exact: true }), "folder");
  await checkPopup(page.getByRole("button", { name: "Manage Test Course 1", exact: true }), "course");
  await checkPopup(page.getByRole("button", { name: "Publish course", exact: true }).first(), "publishing");

  await page.goto(`/courses/${author.courseIds[0]}/edit`);
  await checkPopup(page.getByRole("button", { name: "Author options", exact: true }), "author-options");
  await checkPopup(page.getByRole("button", { name: "Section actions for Learn", exact: true }), "section-actions");
  await checkPopup(page.getByRole("button", { name: "Content actions for Lesson 1", exact: true }), "content-actions");
  await checkPopup(page.getByRole("button", { name: "Add content", exact: true }).first(), "add-content");
  const themeTrigger = page.getByRole("button", { name: "Course theme settings", exact: true });
  await checkPopup(themeTrigger, "theme");
  await checkPopup(page.getByRole("button", { name: "Navigation and progress settings", exact: true }), "navigation");

  await themeTrigger.click();
  const theme = page.getByRole("dialog", { name: "Course theme", exact: true });
  await theme.getByRole("button", { name: "Use Image cover", exact: true }).click();
  await theme.getByRole("button", { name: "Choose cover image", exact: true }).click();
  const library = page.getByRole("dialog", { name: "Media library", exact: true });
  await expect(library).toBeVisible();
  await library.getByRole("searchbox").fill("No matching media");
  await expect(theme).toHaveAttribute("data-state", "open");
  await library.getByRole("button", { name: "Close media library", exact: true }).click();
  await expect(theme).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-ui-popover]")).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await themeTrigger.click();
  await expect(theme).toBeVisible();
  expect(await theme.evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-ui-popover]")).toHaveCount(0);

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(`/courses/${author.courseIds[0]}/edit`);
  await page.getByRole("button", { name: "Edit Content", exact: true }).first().click();
  await checkPopup(page.getByRole("button", { name: "Open content settings", exact: true }).first(), "content-settings");
  await checkPopup(page.getByRole("button", { name: "Format block", exact: true }).first(), "block-format");

  await page.goto(`/courses/${author.courseIds[0]}/edit`);
  await page.getByRole("button", { name: "Add content", exact: true }).first().click();
  await page.getByRole("menuitem", { name: "Add quiz", exact: true }).click();
  await page.getByRole("button", { name: "Content actions for New quiz", exact: true }).locator("..").getByRole("button", { name: "Edit Content", exact: true }).click();
  await page.getByRole("button", { name: "Add question", exact: true }).first().click();
  await checkPopup(page.getByRole("button", { name: "Question 1 actions", exact: true }), "question-actions");
  expect(errors).toEqual([]);
});
