import { expect, test } from "@playwright/test";

const publicPages = ["/", "/pricing", "/industries", "/contact", "/privacy"];

for (const path of publicPages) {
    test(`public smoke: ${path} renders and supports navigation`, async ({ page }) => {
        await page.route("**/api/proxy/billing/plans*", (route) =>
            route.fulfill({ status: 200, json: {} }),
        );

        const response = await page.goto(path);
        expect(response?.status()).toBe(200);
        await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();

        const origin = new URL(page.url()).origin;
        const legal = path === "/privacy"
            ? { path: "/terms", title: "Terms & Conditions" }
            : { path: "/privacy", title: "Privacy Policy" };

        await page.locator(`footer a[href="${legal.path}"]`).click();
        await expect(page).toHaveURL(origin + legal.path);
        await expect(page.getByRole("heading", { level: 1, name: legal.title, exact: true })).toBeVisible();

        await page.locator('nav a[href="/"]:visible').click();
        await expect(page).toHaveURL(origin + "/");
        await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    });
}
