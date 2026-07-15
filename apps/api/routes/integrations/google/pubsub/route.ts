import { NextRequest, NextResponse } from "next/server";
import { handleGooglePubSubNotification } from "@/modules/email-campaigner/service/googleMailboxService";
import { z } from "zod";
import { OAuth2Client } from "google-auth-library";

const BASE64URL_REGEX = /^[A-Za-z0-9_-]+$/;

const PubSubPushSchema = z.object({
    message: z.object({
        messageId: z.string().optional(),
        data: z.string(),
        attributes: z.record(z.string(), z.string()).optional(),
    }),
    subscription: z.string().optional(),
});

export async function POST(req: NextRequest) {
    const audience = process.env["GMAIL_PUBSUB_AUDIENCE"];
    const serviceAccount = process.env["GMAIL_PUBSUB_SERVICE_ACCOUNT"];
    const requiredServiceAccount = "gmail-pubsub-push@helical-sanctum-496213-p8.iam.gserviceaccount.com";

    if (!audience || !serviceAccount || serviceAccount !== requiredServiceAccount) {
        return NextResponse.json({ error: "Server misconfiguration." }, { status: 503 });
    }

    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const token = authHeader.slice("Bearer ".length).trim();
    if (!token) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let payload;
    try {
        const client = new OAuth2Client();
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: audience,
        });
        payload = ticket.getPayload();
    } catch (err: any) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!payload) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const iss = payload.iss;
    if (iss !== "accounts.google.com" && iss !== "https://accounts.google.com") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (payload.email_verified !== true) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (payload.email !== serviceAccount) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let reqBody;
    try {
        reqBody = await req.json();
    } catch (e) {
        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const parsed = PubSubPushSchema.safeParse(reqBody);
    if (!parsed.success) {
        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const dataStr = parsed.data.message.data;

    if (dataStr === "") {
        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    if (/\s/.test(dataStr)) {
        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    if (dataStr.length % 4 === 1) {
        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    if (!BASE64URL_REGEX.test(dataStr)) {
        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    let decodedStr;
    try {
        const base64 = dataStr.replace(/-/g, "+").replace(/_/g, "/");
        const buffer = Buffer.from(base64, "base64");
        decodedStr = buffer.toString("utf8");
        if (decodedStr.includes("\uFFFD")) {
            throw new Error("Invalid UTF-8 sequence.");
        }
    } catch (e) {
        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    let payloadJson;
    try {
        payloadJson = JSON.parse(decodedStr);
    } catch (e) {
        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    if (!payloadJson || typeof payloadJson !== "object" || Array.isArray(payloadJson)) {
        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const emailAddress = payloadJson.emailAddress;
    const historyId = payloadJson.historyId;

    if (emailAddress === undefined || emailAddress === null) {
        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    if (typeof emailAddress !== "string" || emailAddress.trim() === "") {
        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailAddress)) {
        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    if (historyId === undefined || historyId === null) {
        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    if (typeof historyId !== "string" || historyId.trim() === "") {
        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    try {
        const result = await handleGooglePubSubNotification({
            messageId: parsed.data.message.messageId,
            data: dataStr,
        });

        if (!result.accepted) {
            if (result.reason === "UNKNOWN_MAILBOX") {
                return NextResponse.json(result, { status: 200 });
            }
            if (result.reason === "AMBIGUOUS_MAILBOX") {
                return NextResponse.json({ error: "Ambiguous mailbox owner.", reason: "AMBIGUOUS_MAILBOX" }, { status: 400 });
            }
            return NextResponse.json({ error: "Internal processing error.", reason: "PROCESSING_FAILURE" }, { status: 500 });
        }

        return NextResponse.json(result);
    } catch (error: any) {
        return NextResponse.json({ error: "Internal processing error.", reason: "PROCESSING_FAILURE" }, { status: 500 });
    }
}
