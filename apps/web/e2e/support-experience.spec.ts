import { expect, test } from "@playwright/test";

test.describe("Public support experience", () => {
    test.describe.configure({ mode: "serial" });

    test("proxy boundary keeps split API protected while local help stays public", async ({ request }) => {
        test.skip(process.env.SPLIT_API_URL === undefined, "Split API boundary check requires SPLIT_API_URL.");

        const splitApiResponse = await request.get(`${process.env.SPLIT_API_URL}/help/search`);
        expect(splitApiResponse.ok()).toBeTruthy();

        const localHelpResponse = await request.get("/api/help/search");
        expect(localHelpResponse.ok()).toBeTruthy();

        const proxiedHelpResponse = await request.get("/api/proxy/help/search");
        expect(proxiedHelpResponse.status()).toBe(401);
    });

    test("desktop marketing page shows strong visual framing and global help access", async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 1100 });
        await page.goto("/", { waitUntil: "domcontentloaded" });

        await expect(page.getByRole("heading", { name: /pipeline workflow/i })).toBeVisible();
        await expect(page.getByRole("button", { name: /open help assistant/i })).toBeVisible();

        await page.getByRole("button", { name: /open help assistant/i }).click();
        await expect(page.getByRole("heading", { name: /guidance before the handoff/i })).toBeVisible();
        await page.getByRole("button", { name: "How do I finish workspace setup?" }).click();
        await expect(page.getByText(/setup blocker/i)).toBeVisible();
    });

    test("help center search and support form work without auth", async ({ page, request }) => {
        const helpResponse = await request.get("/api/help/search?q=setup");
        expect(helpResponse.ok()).toBeTruthy();
        const helpJson = await helpResponse.json();
        expect(helpJson.results.length).toBeGreaterThan(0);

        await page.setViewportSize({ width: 1280, height: 960 });
        await page.goto("/help", { waitUntil: "domcontentloaded" });

        await expect(page.getByRole("heading", { name: /yes, you can get unstuck here/i })).toBeVisible();
        await page.getByPlaceholder(/search setup, billing, imports/i).fill("billing");
        await expect(page.getByText(/billing, credits, and plans/i).first()).toBeVisible();

        await page.getByLabel("Name").scrollIntoViewIfNeeded();
        await page.getByLabel("Name").fill("Jordan Miles");
        await page.getByLabel("Email").fill("jordan@example.com");
        await page.getByLabel("Subject").fill("Need billing help");
        await page.getByLabel("Message").fill("I am blocked on plan selection.");
        const responsePromise = page.waitForResponse((response) =>
            response.url().includes("/api/support/contact") && response.request().method() === "POST"
        );
        await page.getByRole("button", { name: /send message/i }).click();

        const supportResponse = await responsePromise;
        expect(supportResponse.ok()).toBeTruthy();
    });

    test("mobile contact flow keeps help copy visible", async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto("/contact", { waitUntil: "domcontentloaded" });

        await expect(page.getByRole("heading", { name: /yes, we are here/i })).toBeVisible();
        await expect(page.getByText(/floating help assistant anywhere in the app/i)).toBeVisible();
        await expect(page.getByRole("button", { name: /open help assistant/i })).toBeVisible();
    });

    test("mobile login page keeps auth and help entry visible", async ({ page }) => {
        await page.setViewportSize({ width: 430, height: 932 });
        await page.goto("/login", { waitUntil: "commit" });
        await page.waitForURL(/\/login/);

        await expect(page.getByRole("heading").first()).toBeVisible();
        await expect(page.getByRole("button", { name: /open help assistant/i })).toBeVisible();
        await expect(page.locator('input[type="email"]').first()).toBeVisible();
    });
});
