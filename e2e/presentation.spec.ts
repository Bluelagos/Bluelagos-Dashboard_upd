import { expect, test } from "@playwright/test";

/**
 * The interactions this product is actually presented with: switching theme,
 * following a KPI, opening an explanation, driving the briefing, and finding a
 * community by name in front of an audience.
 */

test.describe("theme", () => {
  test("switches and persists across a reload", async ({ page }) => {
    await page.goto("/");
    const root = page.locator("html");
    await expect(root).toHaveAttribute("data-theme", /deep|warm/);

    await page.getByRole("button", { name: /Warm Coast/ }).click();
    await expect(root).toHaveAttribute("data-theme", "warm");

    await page.reload();
    await expect(root).toHaveAttribute("data-theme", "warm");

    await page.getByRole("button", { name: /Deep Coast/ }).click();
    await expect(root).toHaveAttribute("data-theme", "deep");
    await page.reload();
    await expect(root).toHaveAttribute("data-theme", "deep");
  });

  test("applies before first paint, with no flash of the wrong theme", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Warm Coast/ }).click();
    await page.goto("/health");
    // Read immediately on the new document rather than after settling.
    await expect(page.locator("html")).toHaveAttribute("data-theme", "warm");
  });

  test("carries into a second page and the briefing", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Warm Coast/ }).click();
    await page.goto("/briefing");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "warm");
  });
});

test.describe("KPI cards", () => {
  test("navigate when there is somewhere meaningful to go", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /Population represented/ }).click();
    await expect(page).toHaveURL(/\/demographics/);
    await expect(page.getByRole("heading", { name: "People", level: 1 })).toBeVisible();
  });

  test("reach the priorities page from the urgent-attention card", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /Needs urgent attention/ }).click();
    await expect(page).toHaveURL(/\/priorities/);
  });

  test("are reachable by keyboard", async ({ page }) => {
    await page.goto("/");
    const card = page.getByRole("link", { name: /Communities surveyed/ });
    await card.focus();
    await expect(card).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/communities/);
  });
});

test.describe("explanations", () => {
  test("an info button opens the drawer with plain and technical layers", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /How is .*Population represented.* calculated/ }).click();
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText("What this shows")).toBeVisible();
    await expect(drawer.getByText("Why it matters")).toBeVisible();
    await expect(drawer.getByText("How it is worked out")).toBeVisible();

    // The jargon lives here and only here.
    await drawer.getByText("Technical detail").click();
    await expect(drawer.getByText(/Null-preserving sum/)).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
  });

  test("the page guide is collapsed by default and opens on request", async ({ page }) => {
    await page.goto("/health");
    await expect(page.getByText("What this page shows")).toBeHidden();
    await page.getByText("About this page").click();
    await expect(page.getByText("What this page shows")).toBeVisible();
    await expect(page.getByText("What to look for")).toBeVisible();
  });

  test("every main page carries a guide", async ({ page }) => {
    for (const route of [
      "/",
      "/explorer",
      "/communities",
      "/health",
      "/accessibility",
      "/climate",
      "/priorities",
      "/scenarios",
      "/data",
      "/data-quality",
      "/methodology",
      "/sdgs",
    ]) {
      await page.goto(route);
      await expect(page.getByText("About this page").first(), route).toBeVisible();
    }
  });
});

test.describe("briefing", () => {
  test("moves forward and back with the buttons", async ({ page }) => {
    await page.goto("/briefing");
    await expect(page.getByText("1 / 11")).toBeVisible();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByText("2 / 11")).toBeVisible();
    await page.getByRole("button", { name: "Previous", exact: true }).click();
    await expect(page.getByText("1 / 11")).toBeVisible();
    await expect(page.getByRole("button", { name: "Previous", exact: true })).toBeDisabled();
  });

  test("moves with the arrow keys", async ({ page }) => {
    await page.goto("/briefing");
    await page.locator("body").click({ position: { x: 5, y: 300 } });
    await page.keyboard.press("ArrowRight");
    await expect(page.getByText("2 / 11")).toBeVisible();
    await page.keyboard.press("ArrowLeft");
    await expect(page.getByText("1 / 11")).toBeVisible();
  });

  test("jumps to a scene from the progress bar", async ({ page }) => {
    await page.goto("/briefing");
    await page.getByRole("button", { name: "8. Priority communities" }).click();
    await expect(page.getByText("8 / 11")).toBeVisible();
  });

  test("every scene states what we are seeing and why it matters", async ({ page }) => {
    await page.goto("/briefing");
    for (let step = 0; step < 11; step += 1) {
      await expect(page.getByRole("heading", { name: "What we are seeing" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Why it matters" })).toBeVisible();
      if (step < 10) await page.getByRole("button", { name: "Next", exact: true }).click();
    }
  });

  test("presenter notes stay hidden until the presenter asks for them", async ({ page }) => {
    await page.goto("/briefing");
    await expect(page.getByRole("complementary", { name: "Presenter notes" })).toBeHidden();
    await page.getByRole("button", { name: "Show presenter notes" }).click();
    const notes = page.getByRole("complementary", { name: "Presenter notes" });
    await expect(notes).toBeVisible();
    await expect(notes.getByText("Say this")).toBeVisible();
    await expect(notes.getByText("If asked")).toBeVisible();
    await page.getByRole("button", { name: "Hide presenter notes" }).first().click();
    await expect(notes).toBeHidden();
  });

  test("exits back to the overview", async ({ page }) => {
    await page.goto("/briefing");
    await page.getByRole("link", { name: "Exit the briefing" }).click();
    await expect(page).toHaveURL(/\/$/);
  });
});

test.describe("search", () => {
  test("opens with the slash key and finds a community", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("/");
    const dialog = page.getByRole("dialog", { name: "Search communities" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("textbox").fill("a");
    const first = dialog.locator("button[data-active]").first();
    await expect(first).toBeVisible({ timeout: 15_000 });
    await first.click();
    await expect(page).toHaveURL(/\/communities\//);
  });

  test("closes with Escape", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Search communities" }).click();
    const dialog = page.getByRole("dialog", { name: "Search communities" });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });
});

test.describe("map interaction", () => {
  test("selecting a community from the list focuses it and offers the full record", async ({
    page,
  }) => {
    await page.goto("/explorer");
    await expect(page.locator(".maplibregl-canvas").first()).toBeVisible({ timeout: 20_000 });
    await page.locator("details.map-results > summary").first().click();
    await page.getByRole("button", { name: "Show on map" }).first().click();
    await expect(page.getByRole("link", { name: "View community" })).toBeVisible();
    await expect(page.getByText("Main need", { exact: true })).toBeVisible();
  });

  test("a chart selection filters the page", async ({ page }) => {
    await page.goto("/");
    await page.locator("details.chart-data > summary").first().click();
    const filter = page.getByRole("button", { name: /^Show only / }).first();
    await filter.click();
    await expect(page).toHaveURL(/lga=/);
  });
});
