import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { encryptCredential } from "@/lib/security/credentialVault";
import { auditSuperAdmin, getSuperAdminActor } from "@/lib/superadmin/actor";

// Test inboxes for the inbox placement check (apps/api inboxPlacementCheck.ts). They are WarmupSeedMailbox rows with
// status PLACEMENT holding IMAP settings and an app password encrypted with ENCRYPTION_KEY (the API decrypts it, so
// both services need the same key). The seed warmup exchange only uses status ACTIVE and never touches these.
const STATUS = "PLACEMENT";

const addSchema = z.object({
    email: z.string().trim().toLowerCase().email().max(254),
    imapHost: z.string().trim().toLowerCase().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, "Give an IMAP host such as imap.gmail.com").max(253),
    imapPort: z.number().int().min(1).max(65535).default(993),
    user: z.string().trim().max(254).optional(),
    password: z.string().min(1).max(512),
}).strict();

export async function GET() {
    const actor = await getSuperAdminActor();
    if (!actor) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const { prisma } = await import("@/lib/db");
    const inboxes = await prisma.warmupSeedMailbox.findMany({
        where: { status: STATUS },
        orderBy: { createdAt: "asc" },
        select: { id: true, email: true, host: true, port: true, user: true, createdAt: true },
    });
    return NextResponse.json({ inboxes });
}

export async function POST(req: NextRequest) {
    const actor = await getSuperAdminActor();
    if (!actor) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const parsed = addSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Give an email, IMAP host and app password" }, { status: 400 });
    }
    const { email, imapHost, imapPort, password } = parsed.data;
    const { prisma } = await import("@/lib/db");
    const existing = await prisma.warmupSeedMailbox.findUnique({ where: { email }, select: { status: true } });
    if (existing) {
        return NextResponse.json({ error: existing.status === STATUS ? "That test inbox is already added" : "That address is already used as a warmup seed" }, { status: 409 });
    }
    const inbox = await prisma.warmupSeedMailbox.create({
        data: {
            email, host: imapHost, port: imapPort, secure: imapPort === 993, user: parsed.data.user || email,
            encryptedPassword: (await encryptCredential(password)) as object, status: STATUS, dailyCapacity: 0,
        },
        select: { id: true, email: true, host: true, port: true, user: true, createdAt: true },
    });
    await auditSuperAdmin(actor, "PLACEMENT_INBOX_ADD", req, { email, imapHost });
    return NextResponse.json({ inbox }, { status: 201 });
}
