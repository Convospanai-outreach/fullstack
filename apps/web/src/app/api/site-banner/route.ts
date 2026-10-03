import { NextResponse } from "next/server";

// The site-wide notice for signed-in users (null when none is active). Cached in
// this process for 30 seconds: every dashboard page load asks for it.
const TTL_MS = 30_000;
let cached: { at: number; banner: { message: string; level: string } | null } | null = null;

export async function GET() {
    if (!cached || Date.now() - cached.at > TTL_MS) {
        const { prisma } = await import("@/lib/db");
        const row = await prisma.siteBanner.findUnique({ where: { id: "site" }, select: { message: true, level: true, active: true } }).catch(() => null);
        cached = { at: Date.now(), banner: row?.active ? { message: row.message, level: row.level } : null };
    }
    return NextResponse.json({ banner: cached.banner });
}
