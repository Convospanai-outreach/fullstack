import { NextRequest, NextResponse } from "next/server";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { syncClerkUserToApp } from "@/lib/clerkAuth";

export const runtime = "nodejs";

type ClerkEmail = { id: string; email_address: string; verification?: { status?: string | null } | null };
type ClerkUserPayload = {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    primary_email_address_id?: string | null;
    email_addresses?: ClerkEmail[];
    unsafe_metadata?: Record<string, unknown>;
};

function getInviteToken(data: ClerkUserPayload) {
    const token = data.unsafe_metadata?.["inviteToken"];
    return typeof token === "string" && token ? token : undefined;
}

function getPrimaryEmail(data: ClerkUserPayload) {
    // Only trust addresses Clerk has actually verified - see clerkAuth.ts's primaryEmail().
    const verified = data.email_addresses?.filter((email) => email.verification?.status === "verified") ?? [];
    const primary = verified.find((email) => email.id === data.primary_email_address_id);
    return (primary?.email_address || verified[0]?.email_address || "").toLowerCase();
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
                name: getDisplayName(data),
                inviteToken: getInviteToken(data)
            });
        }
    }

    return NextResponse.json({ ok: true });
}
