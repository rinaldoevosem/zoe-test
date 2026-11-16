import { expect, test, type Page } from "@playwright/test";

async function signInAs(page: Page, name: string) {
  await page.goto("/signin");
  await page.getByRole("button", { name: new RegExp(name) }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/signin"));
}

test("scheduler auto-fills and publishes a period; staff then see it on My schedule", async ({ page }) => {
  await signInAs(page, "Pat Rivera");
  await page.goto("/schedule");
  await page.getByRole("link", { name: /December 2026/ }).click();
  await expect(page.getByText("draft", { exact: true })).toBeVisible();

  await page.getByTestId("autofill").click();
  await expect(page.getByText(/Auto-fill added \d+ Assignments/)).toBeVisible({ timeout: 30_000 });
  await page.keyboard.press("Escape");

  await page.getByTestId("publish").click();
  await expect(page.getByText("Published — staff have been notified")).toBeVisible();

  await signInAs(page, "Riley Chen");
  await page.goto("/me?month=2026-12");
  await expect(page.getByTestId("agenda").locator("li").first()).toBeVisible();
  await page.goto("/notifications");
  await expect(page.getByText("December 2026 is published")).toBeVisible();
});

test("staff can't open the schedule builder", async ({ page }) => {
  await signInAs(page, "Riley Chen");
  await page.goto("/schedule");
  await expect(page).toHaveURL(/\/me/);
});

test("Who's On Call shows the overnight Nocturnists", async ({ page }) => {
  await signInAs(page, "Riley Chen");
  await page.goto("/on-call?at=2026-11-17T03:00:00Z");
  const now = page.getByTestId("on-call-now");
  await expect(now.getByText("Nocturnist").first()).toBeVisible();
});
