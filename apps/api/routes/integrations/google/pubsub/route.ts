import { NextRequest, NextResponse } from "next/server";
import { handleGooglePubSubNotification, verifyGooglePubSubToken } from "@/modules/email-campaigner/service/googleMailboxService";
import { z } from "zod";

const PubSubPushSchema = z.object({
    message: z.object({
        messageId: z.string().optional(),
        data: z.string().optional(),
        attributes: z.record(z.string(), z.string()).optional(),
    }),
    subscription: z.string().optional(),
});

function getVerificationToken(req: NextRequest) {
    const auth = req.headers.get("authorization") || "";
    if (auth.toLowerCase().startsWith("bearer ")) {
        return auth.slice("bearer ".length).trim();
    }
    return req.nextUrl.searchParams.get("token")
        || req.headers.get("x-google-pubsub-token")
        || req.headers.get("x-goog-channel-token");
}

export async function POST(req: NextRequest) {
    if (!verifyGooglePubSubToken(getVerificationToken(req))) {
        return NextResponse.json({ error: "Invalid verification token." }, { status: 401 });
    }

    try {
        const parsed = PubSubPushSchema.safeParse(await req.json());
        if (!parsed.success) {
            return NextResponse.json({ error: "Invalid Pub/Sub payload." }, { status: 400 });
        }

        await handleGooglePubSubNotification(parsed.data.message);
        return new NextResponse(null, { status: 204 });
    } catch (error: any) {
        return NextResponse.json({ error: error?.message || "Unable to process Gmail notification." }, { status: 500 });
    }
}
