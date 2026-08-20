import { NextResponse } from "next/server";
import { sendViaSMTP } from "@/lib/email/smtpClient";
import { randomUUID } from "crypto";

type ContactPayload = {
    name: string;
    email: string;
    subject: string;
    message: string;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sanitize(value: string): string {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
}

function validatePayload(payload: ContactPayload): string | null {
    if (!payload.name?.trim()) return "Name is required";
    if (!payload.subject?.trim()) return "Subject is required";
    if (!payload.message?.trim()) return "Message is required";
    if (!EMAIL_REGEX.test(payload.email ?? "")) return "A valid email is required";
    if (payload.message.length > 4000) return "Message is too long";
    return null;
}

function generateTicketId(): string {
    const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
    const suffix = randomUUID().slice(0, 8).toUpperCase();
    return `CONTACT-${stamp}-${suffix}`;
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
        fromName: process.env["SMTP_FROM_NAME"] || "CraftMyFunnel Contact",
        fromEmail,
    };
}

export async function POST(req: Request) {
    let payload: ContactPayload;

    try {
        payload = (await req.json()) as ContactPayload;
    } catch {
        return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
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

    const smtpConfig = getSmtpConfig();
    if (!smtpConfig) {
        // No durable storage backs this endpoint, so an unsent message would be lost
        // with no way to retry or recover it — report failure honestly instead of a
        // false "queued" success (unlike /api/support/contact, which can afford to
        // treat "queued" as best-effort since it's paired with a support ticket flow).
        return NextResponse.json({ error: "Contact service is not configured", ticketId, status: "failed" }, { status: 503 });
    }

    const html = `
        <h2>New Contact Request</h2>
        <p><strong>Name:</strong> ${safeName}</p>
        <p><strong>Email:</strong> ${safeEmail}</p>
        <p><strong>Subject:</strong> ${safeSubject}</p>
        <hr />
        <p>${safeMessage}</p>
    `;

    const result = await sendViaSMTP(
        smtpConfig,
        {
            to: recipient,
            subject: `[Contact] ${payload.subject.trim()}`,
            html,
            replyTo: payload.email.trim(),
        }
    );

    if (!result.success) {
        return NextResponse.json({ error: "Failed to deliver message", ticketId, status: "failed" }, { status: 502 });
    }

    return NextResponse.json({
        success: true,
        ticketId,
        status: "submitted",
        delivery: "sent",
        message: "Message submitted successfully.",
    });
}
