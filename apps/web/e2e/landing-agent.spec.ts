import { expect, test } from "@playwright/test";

test.describe("Landing Agent routes", () => {
    test("public landing route handles missing slug gracefully", async ({ page }) => {
        await page.goto("/p/non-existent-slug-for-test");
        await expect(page.getByText(/not found|failed to load page|page not found|loading landing page/i)).toBeVisible();
    });

    test("existing campaign wizard route remains reachable", async ({ page }) => {
        await page.goto("/campaigns/new");
        if (page.url().includes("/login")) {
            await expect(page.getByRole("heading", { name: /sign in to your workspace/i })).toBeVisible();
            return;
        }
        await expect(page.getByText(/choose where outreach starts/i)).toBeVisible();
    });
});
