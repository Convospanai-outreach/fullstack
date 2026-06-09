import { NextRequest, NextResponse } from "next/server";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { syncClerkUserToApp } from "@/lib/clerkAuth";

export const runtime = "nodejs";

type ClerkEmail = { id: string; email_address: string };
type ClerkUserPayload = {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    primary_email_address_id?: string | null;
    email_addresses?: ClerkEmail[];
};

function getPrimaryEmail(data: ClerkUserPayload) {
    const primary = data.email_addresses?.find((email) => email.id === data.primary_email_address_id);
    return (primary?.email_address || data.email_addresses?.[0]?.email_address || "").toLowerCase();
}

function getDisplayName(data: ClerkUserPayload) {
    return [data.first_name, data.last_name].filter(Boolean).join(" ").trim() || null;
}

export async function POST(req: NextRequest) {
    let event: any;
    try {
        event = await verifyWebhook(req);
    } catch (error) {
        console.error("[Clerk] Webhook verification failed:", error);
        return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
    }

    if (event.type === "user.created" || event.type === "user.updated") {
        const data = event.data as ClerkUserPayload;
        const email = getPrimaryEmail(data);

        if (data.id && email) {
            await syncClerkUserToApp({
                clerkUserId: data.id,
                email,
                name: getDisplayName(data)
            });
        }
    }

    return NextResponse.json({ ok: true });
}
