import { NextRequest, NextResponse } from "next/server";

function getString(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}

function isValidLinkedInUrl(value: string) {
    try {
        const url = new URL(value);
        return url.protocol === "https:" && /(^|\.)linkedin\.com$/i.test(url.hostname);
    } catch {
        return false;
    }
}

export async function POST(req: NextRequest) {
    const { prisma } = await import("@/lib/db");
    const body = await req.json().catch(() => null);
    const name = getString(body?.name);
    const email = getString(body?.email).toLowerCase();
    const company = getString(body?.company ?? body?.companyName);
    const linkedinUrl = getString(body?.linkedin_url ?? body?.linkedInProfileUrl);
    const useCase = getString(body?.use_case ?? body?.primaryUseCase);

    if (!name || !email || !company || !linkedinUrl || !useCase) {
        return NextResponse.json({ error: "All invite request fields are required." }, { status: 400 });
    }

    if (!email.includes("@")) {
        return NextResponse.json({ error: "A valid work email is required." }, { status: 400 });
    }

    if (!isValidLinkedInUrl(linkedinUrl)) {
        return NextResponse.json({ error: "A valid LinkedIn profile URL is required." }, { status: 400 });
    }

    const existing = await prisma.inviteRequest.findFirst({
        where: {
            email,
            status: { in: ["WAITLISTED", "APPROVED", "ACTIVE"] }
        },
        select: { id: true, status: true }
    });

    if (existing) {
        return NextResponse.json({ ok: true, status: existing.status });
    }

    const request = await prisma.inviteRequest.create({
        data: {
            name,
            email,
            company,
            linkedinUrl,
            useCase,
            status: "WAITLISTED"
        },
        select: { id: true, status: true }
    });

    return NextResponse.json({ ok: true, status: request.status }, { status: 201 });
}
