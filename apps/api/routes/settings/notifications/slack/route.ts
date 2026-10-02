import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { handleAPIError } from "@/lib/apiResponse";
import { parseBody } from "@/lib/validation/parseBody";

// Keep in sync with SLACK_WEBHOOK_PATTERN (slackAlert.ts); not imported so the module stays lazy-loaded.
const SlackSchema = z.object({
    url: z.string().trim().max(500).regex(/^https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9_\-/]+$/).nullable(),
});

// Whether the caller has a Slack webhook for reply alerts. The URL itself is never returned.
export async function GET(req: NextRequest) {
    try {
        const { userId } = await getCurrentContextFromRequest(req);
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { hasSlackWebhook } = await import("@/modules/inbox/slackAlert");
        return NextResponse.json({ connected: await hasSlackWebhook(userId) });
    } catch (error) {
        return handleAPIError(error);
    }
}

// Set (after a test post to the channel succeeds) or clear (url: null) the caller's webhook.
export async function PUT(req: NextRequest) {
    try {
        const { userId } = await getCurrentContextFromRequest(req);
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const parsed = await parseBody(req, SlackSchema);
        if (!parsed.ok) return parsed.response;

        const { setSlackWebhook } = await import("@/modules/inbox/slackAlert");
        if (!(await setSlackWebhook(userId, parsed.data.url))) {
            return NextResponse.json({ error: "Slack didn't accept that webhook. Check the URL and try again." }, { status: 400 });
        }
        return NextResponse.json({ connected: parsed.data.url !== null });
    } catch (error) {
        return handleAPIError(error);
    }
}
