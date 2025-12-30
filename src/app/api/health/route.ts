import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
    try {
        // Simple DB check
        await prisma.$queryRaw`SELECT 1`;

        return NextResponse.json({
            status: "ok",
            timestamp: new Date().toISOString(),
            database: "connected",
            version: process.env['npm_package_version'] || "1.0.0"
        });
    } catch (error) {
        return NextResponse.json({
            status: "error",
            timestamp: new Date().toISOString(),
            database: "disconnected",
            error: String(error)
        }, { status: 503 });
    }
}
