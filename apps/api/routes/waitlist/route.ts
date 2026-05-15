import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

function clean(value: unknown, max = 500) {
    return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

    const name = clean(body.name, 120);
    const email = clean(body.email, 180).toLowerCase();
    const companyName = clean(body.companyName, 180);
    const phone = clean(body.phone, 80) || null;
    const useCase = clean(body.useCase, 2000) || null;

    if (!name || !email || !companyName) {
        return NextResponse.json({ error: "Name, business email, and company name are required." }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ error: "Please use a valid business email." }, { status: 400 });
    }

    await (prisma as any).waitlistRequest.upsert({
        where: { email },
        update: { name, companyName, phone, useCase, status: "PENDING" },
        create: { name, email, companyName, phone, useCase },
    });

    return NextResponse.json({
        message: "Thank you. Your request has been received. Our team will review and contact you.",
    });
}

