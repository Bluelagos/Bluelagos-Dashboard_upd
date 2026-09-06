import { expect, test } from "@playwright/test";

/**
 * Presentation is desktop-first, so the layout is checked at the three screen
 * sizes this will actually be shown on, in both themes. Two things break a
 * live walkthrough more than anything else: a page that scrolls sideways, and
 * text too small to read from the back of a room.
 */
const SIZES = [
  { name: "1920x1080", width: 1920, height: 1080 },
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1366x768", width: 1366, height: 768 },
];

const ROUTES = [
  ["overview", "/"],
  ["map", "/explorer"],
  ["communities", "/communities"],
  ["health", "/health"],
  ["access", "/accessibility"],
  ["environment", "/climate"],
  ["priorities", "/priorities"],
  ["shared service areas", "/priorities?view=areas&type=health"],
  ["scenarios", "/scenarios"],
  ["data quality", "/data-quality"],
  ["methodology", "/methodology"],
  ["briefing", "/briefing"],
] as const;

/** Below this, text stops being legible on a projector. */
const MIN_FONT_PX = 9.4;

test("every page holds its layout at presentation sizes in both themes", async ({ page }) => {
  test.setTimeout(900_000);
  const problems: string[] = [];

  for (const theme of ["deep", "warm"] as const) {
    await page.goto("/");
    await page.evaluate((value) => localStorage.setItem("blue-lagos-theme", value), theme);

    for (const size of SIZES) {
      await page.setViewportSize(size);
      for (const [name, route] of ROUTES) {
        await page.goto(route);
        await page.waitForTimeout(900);

        const overflow = await page.evaluate(() => ({
          scroll: document.documentElement.scrollWidth,
          client: document.documentElement.clientWidth,
        }));
        if (overflow.scroll > overflow.client + 2) {
          problems.push(
            `${theme} ${size.name} ${name}: page scrolls sideways (${overflow.scroll} > ${overflow.client})`,
          );
        }

        const tiny = await page.evaluate((min) => {
          const found: string[] = [];
          for (const element of Array.from(document.querySelectorAll("main *, .briefing *"))) {
            if (!(element instanceof HTMLElement)) continue;
            if (!element.textContent?.trim() || element.children.length) continue;
            const fontSize = parseFloat(getComputedStyle(element).fontSize);
            if (fontSize && fontSize < min) found.push(`${element.tagName}.${element.className} ${fontSize}px`);
          }
          return [...new Set(found)].slice(0, 5);
        }, MIN_FONT_PX);
        if (tiny.length) problems.push(`${theme} ${size.name} ${name}: text under ${MIN_FONT_PX}px — ${tiny.join(", ")}`);
      }
    }
  }

  expect(problems, problems.join("\n")).toEqual([]);
});
