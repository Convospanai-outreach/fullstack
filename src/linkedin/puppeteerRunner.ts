import puppeteer, { Page } from "puppeteer";

import { RateLimitService } from "@/lib/rateLimitService";

// Helper for random delays
const delay = (min: number, max: number) => new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * (max - min + 1)) + min));

// Human-like mouse movement (Bezier curves)
async function humanMove(page: Page) {
  const width = 1920;
  const height = 1080;

  // Start point (current mouse position)
  // We can't easily get current pos without tracking, so we assume a random start or center
  // But page.mouse.move moves FROM current.

  const targetX = Math.random() * width;
  const targetY = Math.random() * height;

  // Move in steps to simulate curve
  await page.mouse.move(targetX, targetY, { steps: 25 + Math.floor(Math.random() * 25) });

  // Random small jitter
  await page.mouse.move(targetX + (Math.random() * 10 - 5), targetY + (Math.random() * 10 - 5), { steps: 5 });
}

// Check daily limits
async function checkDailyLimit(actionType: string): Promise<boolean> {
  return await RateLimitService.checkLimit(actionType);
}

export async function runLinkedInAction(action: any) {
  if (!await checkDailyLimit(action.type)) {
    return { ok: false, error: "Daily limit reached for " + action.type };
  }

  // Guardrail: Validate URL to prevent visiting malicious sites
  try {
    const urlObj = new URL(action.url);
    if (!urlObj.hostname.endsWith("linkedin.com")) {
      return { ok: false, error: "Security Block: Attempted to visit non-LinkedIn URL: " + action.url };
    }
  } catch (e) {
    return { ok: false, error: "Invalid URL provided" };
  }

  console.log(`Starting Puppeteer for action: ${action.type}`);

  const browser = await puppeteer.launch({
    headless: false, // Keep false for debugging/demo, set to true or "new" for prod
    args: ["--disable-notifications", "--start-maximized", "--no-sandbox"],
    defaultViewport: null
  });

  try {
    const page = await browser.newPage();

    // Set user agent to avoid detection
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    await page.goto(action.url, { waitUntil: "networkidle2" });
    await delay(2000, 5000); // Random start delay

    await humanMove(page);

    if (action.type === "SCRAPE") {
      // Wait for profile to load
      await page.waitForSelector(".pv-top-card", { timeout: 10000 }).catch(() => console.log("Profile top card not found"));

      const data = await page.evaluate(() => {
        const getText = (sel: string) => document.querySelector(sel)?.textContent?.trim() || "";

        return {
          name: getText(".pv-text-details__left-panel h1"),
          headline: getText(".pv-text-details__left-panel .text-body-medium"),
          location: getText(".pv-text-details__left-panel .text-body-small"),
          about: getText("#about ~ .display-flex .inline-show-more-text"),
          url: window.location.href
        };
      });

      await browser.close();
      await RateLimitService.incrementUsage("SCRAPE", { url: action.url });
      return { ok: true, data };
    }

    if (action.type === "CONNECT") {
      const connectBtn = await page.$("button[aria-label*='Connect']");
      if (connectBtn) {
        await connectBtn.click();
        await delay(1000, 2000);
        // Handle "Add a note" modal if it appears
        const sendNowBtn = await page.$("button[aria-label='Send now']");
        if (sendNowBtn) {
          await sendNowBtn.click();
        }
      } else {
        // Check for "More" button -> Connect
        console.log("Connect button not found directly, checking 'More'...");
      }
    }

    if (action.type === "INMAIL") {
      await page.click("button[aria-label*='Message']");
      await delay(1000, 3000);

      // Type message human-like
      const msgBox = "div.msg-form__contenteditable";
      await page.waitForSelector(msgBox);
      await page.type(msgBox, action.message, { delay: 50 }); // 50ms per char

      await delay(1000, 2000);
      await page.click("button.msg-form__send-button");
    }

    if (action.type === "SCRAPE_POST") {
      // Wait for post content to load
      await page.waitForSelector("article", { timeout: 10000 }).catch(() => console.log("No article tag found"));

      // Try to find the main post text
      // Selectors vary, but common ones: .feed-shared-update-v2__description, .update-components-text
      const text = await page.evaluate(() => {
        const selectors = [
          ".feed-shared-update-v2__description",
          ".update-components-text",
          "article p",
          ".feed-shared-text"
        ];
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el && el.textContent && el.textContent.trim().length > 0) {
            return el.textContent.trim();
          }
        }
        return "";
      });

      if (!text) {
        throw new Error("Could not extract post content");
      }

      await browser.close();
      await RateLimitService.incrementUsage("SCRAPE", { url: action.url }); // Count as a scrape
      return { ok: true, text };
    }

    await delay(2000, 4000); // Post-action delay

    await browser.close();

    // Log success
    await RateLimitService.incrementUsage(action.type, { url: action.url });

    return { ok: true, action };

  } catch (error: any) {
    console.error("Puppeteer Error:", error);
    await browser.close();
    return { ok: false, error: error.message };
  }
}
