import { expect, test } from "@playwright/test";

test("overview opens", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Overview", level: 1 })).toBeVisible();
});

test("live data loads", async ({ page }) => {
  await page.goto("/data-quality");
  await expect(
    page.getByText(/The database reports|did not report a total/).first(),
  ).toBeVisible();
});

test("local government filter works", async ({ page }) => {
  await page.goto("/communities");
  await page.getByLabel("Local government area").selectOption({ index: 1 });
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page).toHaveURL(/lga=/);
});

test("secondary filters live behind More filters", async ({ page }) => {
  await page.goto("/communities");
  await expect(page.getByLabel("Senatorial district")).toBeHidden();
  await page.getByText("More filters").click();
  await page.getByLabel("Senatorial district").selectOption("Lagos East");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page).toHaveURL(/district=Lagos\+East/);
});

test("active filters appear as removable chips", async ({ page }) => {
  await page.goto("/communities?lga=Epe&need=Healthcare");
  await expect(page.getByRole("link", { name: "Remove filter Epe" })).toBeVisible();
  await page.getByRole("link", { name: "Remove filter Epe" }).click();
  await expect(page).not.toHaveURL(/lga=Epe/);
  await expect(page).toHaveURL(/need=Healthcare/);
  await page.getByRole("link", { name: "Clear all" }).click();
  await expect(page).not.toHaveURL(/need=/);
});

test("empty result set explains itself and offers a way out", async ({ page }) => {
  await page.goto("/communities?q=zzzzzznotacommunity");
  await expect(page.getByText("No communities match these filters")).toBeVisible();
  await page.getByRole("link", { name: "Clear filters" }).click();
  await expect(page).toHaveURL(/\/communities$/);
});

test("community table sorts", async ({ page }) => {
  await page.goto("/communities");
  const header = page.getByRole("button", { name: /^Community/ });
  await header.click();
  await expect(page.getByRole("columnheader", { name: /Community/ })).toHaveAttribute(
    "aria-sort",
    "ascending",
  );
});

test("community page opens", async ({ page }) => {
  await page.goto("/communities");
  const name = await page.locator("tbody a").first().textContent();
  await page.locator("tbody a").first().click();
  await expect(page.getByRole("heading", { level: 1, name: name!.trim() })).toBeVisible();
  await expect(page.getByRole("heading", { name: "What this community asked for" })).toBeVisible();
});

test("community map page opens and renders", async ({ page }) => {
  await page.goto("/explorer");
  await expect(page.getByRole("heading", { name: "Community Map", level: 1 })).toBeVisible();
  await expect(page.locator(".maplibregl-canvas").first()).toBeVisible({ timeout: 20_000 });
});

test("map page keeps boundary reconciliation and distance sections", async ({ page }) => {
  await page.goto("/explorer");
  await expect(
    page.getByRole("heading", { name: /local government match the boundary/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "How far communities sit from services" }),
  ).toBeVisible();
});

test("optional map layers are offered in plain language and load on demand", async ({ page }) => {
  await page.goto("/explorer");
  await expect(page.locator(".maplibregl-canvas").first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Health facilities", { exact: true })).toBeVisible();
  await expect(page.getByText("Community concentration", { exact: true })).toBeVisible();

  // The heavy layers must not be in the page payload; they are fetched only
  // when the viewer switches them on.
  const request = page.waitForRequest(/\/api\/layers\/osm-health/, { timeout: 20_000 });
  await page.getByRole("checkbox", { name: "Health facilities" }).check();
  await request;
});

test("data catalogue lists reviewed OpenStreetMap layers", async ({ page }) => {
  await page.goto("/data");
  await expect(page.getByText("OpenStreetMap mapped health facilities").first()).toBeVisible();
  await expect(page.getByText("OpenStreetMap mapped marine access points").first()).toBeVisible();
});

test("data quality keeps the boundary checks", async ({ page }) => {
  await page.goto("/data-quality");
  await expect(page.getByRole("heading", { name: "Boundary checks" })).toBeVisible();
  await expect(page.getByText(/Boundary layer:/)).toBeVisible();
});

test("repeated scenario changes do not crash the map", async ({ page }) => {
  await page.goto("/scenarios");
  const range = page.getByRole("slider");
  for (const value of [2, 10, 4, 15, 5]) await range.fill(String(value));
  await expect(page.locator(".maplibregl-canvas").first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Communities inside this reach" })).toBeVisible();
});

test("priorities page opens", async ({ page }) => {
  await page.goto("/priorities");
  await expect(page.getByRole("heading", { name: "Priorities", level: 1 })).toBeVisible();
});

test("shared service areas produce a land-screened candidate", async ({ page }) => {
  await page.goto("/priorities?view=areas&type=health");
  await expect(
    page.getByRole("region", { name: "Shared service area planning map" }),
  ).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Why here?" })).toBeVisible();
  await expect(page.getByText("people within reach").first()).toBeVisible();
});

test("a shared candidate carries into a scenario", async ({ page }) => {
  await page.goto("/priorities?view=areas&type=health");
  await page.getByRole("link", { name: "Test this location" }).click();
  await expect(page).toHaveURL(/\/scenarios\?type=health&lat=/);
  await expect(page.getByText("Location check", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: /Scenario map/ })).toBeVisible({ timeout: 20_000 });
});

test("SDG page loads", async ({ page }) => {
  await page.goto("/sdgs");
  await expect(page.getByRole("heading", { name: "SDGs", level: 1 })).toBeVisible();
});

test("environment page switches between flood and erosion", async ({ page }) => {
  await page.goto("/climate");
  await expect(
    page.getByText("Rated flooding at the top of the scale", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Erosion", exact: true }).click();
  await expect(page).toHaveURL(/view=erosion/);
  await expect(
    page.getByText("Erosion severe enough to displace people", { exact: true }).first(),
  ).toBeVisible();
});

test("malformed query URL does not crash", async ({ page }) => {
  await page.goto("/?q=a&q=b&risk=garbage&district=north&need=invalid");
  await expect(page.getByRole("heading", { name: "Overview", level: 1 })).toBeVisible();
});

test("no technical jargon leaks into primary page copy", async ({ page }) => {
  // Level 1 of the interface must stay readable. These terms are allowed only
  // inside an info drawer, a details element or the Methodology page.
  const banned = ["Haversine", "GeoJSON", "MCDA", "DBSCAN", "Euclidean", "point-in-polygon"];
  for (const route of ["/", "/health", "/accessibility", "/climate", "/priorities"]) {
    await page.goto(route);
    const visible = await page.locator("main").innerText();
    for (const term of banned) {
      expect(visible, `${term} should not be visible on ${route}`).not.toContain(term);
    }
  }
});
