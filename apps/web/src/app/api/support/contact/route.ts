import { NextResponse } from "next/server";
import { sendViaSMTP } from "@/lib/email/smtpClient";
import { randomUUID } from "crypto";

type SupportPayload = {
    name: string;
    email: string;
    subject: string;
    message: string;
    website_url?: string;
    ga_client_id?: string;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sanitize(value: string): string {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
}

function validatePayload(payload: SupportPayload): string | null {
    if (!payload.name?.trim()) return "Name is required";
    if (!EMAIL_REGEX.test(payload.email ?? "")) return "A valid email is required";
    if (!payload.subject?.trim()) return "Subject is required";
    if (!payload.message?.trim()) return "Message is required";
    if (payload.message.trim().length > 4000) return "Message is too long";
    return null;
}

async function sendGa4MeasurementProtocolEvent(params: {
    clientId: string;
    subject: string;
    formSource?: string;
}) {
    const measurementId = process.env["NEXT_PUBLIC_GA_MEASUREMENT_ID"] || process.env["GA_MEASUREMENT_ID"];
    const apiSecret = process.env["GA_API_SECRET"];
    if (!measurementId || !apiSecret) return;

    const url = `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`;
    const body = {
        client_id: params.clientId || `server.${randomUUID()}`,
        events: [
            {
                name: "generate_lead",
                params: {
                    currency: "USD",
                    value: 49,
                    service: params.subject,
                    form_source: params.formSource || "Contact Page (Server-Side Fallback)",
                    engagement_time_msec: 1000,
                },
            },
        ],
    };

    try {
        await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
    } catch (err) {
        console.warn("GA4 Measurement Protocol dispatch failed", err);
    }
}

function getSmtpConfig() {
    const host = process.env["SMTP_HOST"];
    const user = process.env["SMTP_USER"];
    const password = process.env["SMTP_PASSWORD"];
    const fromEmail = process.env["SMTP_FROM_EMAIL"] || user;

    if (!host || !user || !password || !fromEmail) {
        return null;
    }

    const port = Number(process.env["SMTP_PORT"] || 587);
    return {
        host,
        port,
        secure: (process.env["SMTP_SECURE"] || "").toLowerCase() === "true" || port === 465,
        user,
        password,
        fromName: process.env["SMTP_FROM_NAME"] || "CraftMyFunnel Support",
        fromEmail,
    };
}

function generateTicketId(): string {
    const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
    const suffix = randomUUID().slice(0, 8).toUpperCase();
    return `SUP-${stamp}-${suffix}`;
}

export async function POST(req: Request) {
    let payload: SupportPayload;

    try {
        payload = (await req.json()) as SupportPayload;
    } catch {
        return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    // Anti-bot honeypot check: silently accept and discard bot submissions
    if (payload.website_url && payload.website_url.trim().length > 0) {
        return NextResponse.json({
            success: true,
            ticketId: "SUP-BOT-TRAPPED",
            status: "filtered",
            delivery: "filtered",
            message: "Support request processed."
        });
    }

    const validationError = validatePayload(payload);
    if (validationError) {
        return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const recipient = process.env["CONTACT_RECEIVER_EMAIL"] || "contact.us@craftmyfunnel.live";
    const ticketId = generateTicketId();
    const safeName = sanitize(payload.name.trim());
    const safeEmail = sanitize(payload.email.trim());
    const safeSubject = sanitize(payload.subject.trim());
    const safeMessage = sanitize(payload.message.trim()).replaceAll("\n", "<br/>");

    // Fire server-side GA4 Measurement Protocol conversion event if credentials configured
    sendGa4MeasurementProtocolEvent({
        clientId: payload.ga_client_id || "",
        subject: safeSubject,
    }).catch(() => {});


    const smtpConfig = getSmtpConfig();
    if (!smtpConfig) {
        console.info("Support ticket queued without SMTP delivery", {
            name: safeName,
            email: safeEmail,
            subject: safeSubject,
        });

        return NextResponse.json({
            success: true,
            ticketId,
            status: "queued",
            delivery: "queued",
            message: "Support request captured. SMTP is not configured in this environment.",
        });
    }

    const html = `
        <h2>New Support Request</h2>
        <p><strong>Name:</strong> ${safeName}</p>
        <p><strong>Email:</strong> ${safeEmail}</p>
        <p><strong>Subject:</strong> ${safeSubject}</p>
        <hr />
        <p>${safeMessage}</p>
    `;

    const result = await sendViaSMTP(smtpConfig, {
        to: recipient,
        subject: `[Support] ${payload.subject.trim()}`,
        html,
        replyTo: payload.email.trim(),
    });

    if (!result.success) {
        return NextResponse.json({ error: "Failed to deliver message", ticketId, status: "failed" }, { status: 502 });
    }

    return NextResponse.json({
        success: true,
        ticketId,
        status: "submitted",
        delivery: "sent",
        message: "Support request submitted successfully."
    });
}
