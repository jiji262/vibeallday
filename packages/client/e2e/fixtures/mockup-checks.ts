import { expect, type Frame, type Page } from "@playwright/test";

export async function checkMockup(page: Page | Frame, state: string) {
  await expect(
    page.getByRole("heading", { name: "Project review", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Sample projects" }).getByRole("listitem"),
  ).toHaveCount(16);
  await expect(page.getByRole("status")).toHaveText(
    state === "selected"
      ? "Settings selected: VibeAllDay"
      : "Choose a project to review. Changes stay in this preview.",
  );
  expect(
    await page.evaluate(async () => {
      await document.fonts.ready;
      return {
        font: [...document.fonts].some(
          (font) =>
            font.family === "VIBEALLDAY Inter" && font.status === "loaded",
        ),
        scrollable: document.documentElement.scrollHeight > innerHeight,
        overflow: document.documentElement.scrollWidth > innerWidth,
        icons: document.querySelectorAll("svg").length,
      };
    }),
    // Two per card (overflow dots, new-session plus) plus the caption pencil
    // on the 11 cards that have a caption; an empty caption is a text prompt.
  ).toEqual({ font: true, scrollable: true, overflow: false, icons: 43 });
}
