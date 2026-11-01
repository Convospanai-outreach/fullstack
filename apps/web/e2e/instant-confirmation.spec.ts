import { expect, test, type Route } from "@playwright/test";

// Instant confirmation settings on the landing editor. Every API call the page makes is answered by page.route,
// so the spec needs no seeded landing page, sequence or lead. The shared global setup still signs the test user in.

const CAMPAIGN_ID = "camp-e2e-1";
const PAGE_ID = "page-e2e-1";
const SEQUENCES = [
    { id: "seq-welcome", name: "Welcome", channel: "email", status: "ACTIVE", campaignId: "camp-e2e-2" },
    { id: "seq-reminder", name: "Reminder", channel: "email", status: "DRAFT", campaignId: null },
];

function campaign(instantConfirmation: unknown = null) {
    return {
        id: CAMPAIGN_ID,
        name: "E2E landing",
        prompt: "",
        status: "DRAFT",
        assets: [],
        pages: [
            {
                id: PAGE_ID,
                title: "E2E landing",
                status: "DRAFT",
                slug: "e2e-landing",
                renderedJson: { version: 1, sections: [] },
                instantConfirmation,
                hasUnpublishedChanges: false,
            },
        ],
    };
}

async function mockEditorApi(page: import("@playwright/test").Page, options: { saveWarnings?: string[]; saved?: { body: unknown } }) {
    await page.route(`**/api/proxy/landing-agent/campaigns/${CAMPAIGN_ID}`, (route: Route) => route.fulfill({ json: campaign() }));
    await page.route("**/api/proxy/landing-agent/meta-capi-token", (route: Route) => route.fulfill({ json: { saved: false } }));
    await page.route("**/api/proxy/landing-agent/instant-confirmation/sequences", (route: Route) => route.fulfill({ json: SEQUENCES }));
    await page.route(`**/api/proxy/landing-agent/campaigns/${CAMPAIGN_ID}/pages/${PAGE_ID}/instant-confirmation`, async (route: Route) => {
        if (route.request().method() !== "PUT") return route.fallback();
        if (options.saved) options.saved.body = route.request().postDataJSON();
        return route.fulfill({ json: { ...campaign(route.request().postDataJSON()).pages[0], warnings: options.saveWarnings ?? [] } });
    });
}

test.describe("Instant confirmation settings", () => {
    test("turns it on, picks a sequence, and saves the choice", async ({ page }) => {
        const saved: { body: unknown } = { body: null };
        await mockEditorApi(page, { saved });

        await page.goto(`/landing-agent/${CAMPAIGN_ID}/editor`);
        const toggle = page.locator("#instant-confirmation-enabled");
        await expect(toggle).toBeVisible({ timeout: 60_000 });
        await toggle.check();

        await page.locator("#instant-confirmation-sequence").selectOption("seq-welcome");
        await expect(page.getByRole("link", { name: "Open this sequence" })).toHaveAttribute("href", "/campaigns/camp-e2e-2?tab=sequence");

        await page.getByRole("button", { name: "Save instant confirmation" }).click();
        await expect(page.getByText("Saved. The confirmation is sent once a lead submits the form.")).toBeVisible();
        expect(saved.body).toEqual({ enabled: true, sequenceId: "seq-welcome" });
    });

    test("shows the wording warning after a save that Jev flagged", async ({ page }) => {
        await mockEditorApi(page, { saveWarnings: ["This message sounds like a promise or a sales pitch. A confirmation works best as a plain thank-you."] });

        await page.goto(`/landing-agent/${CAMPAIGN_ID}/editor`);
        await expect(page.locator("#instant-confirmation-enabled")).toBeVisible({ timeout: 60_000 });
        await page.locator("#instant-confirmation-enabled").check();
        await page.locator("#instant-confirmation-sequence").selectOption("seq-welcome");
        await page.getByRole("button", { name: "Save instant confirmation" }).click();

        await expect(page.getByText("This message sounds like a promise or a sales pitch.")).toBeVisible();
    });
});
