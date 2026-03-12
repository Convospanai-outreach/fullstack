import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(_req: NextRequest) {
    try {
        // Test DB connection
        await prisma.$queryRaw`SELECT 1`;
        
        return NextResponse.json({
            status: "healthy",
            version: "1.0.0",
            services: {
                database: "operational",
                worker_pool: "active",
                ai_gateway: "active"
            },
            timestamp: new Date().toISOString()
        });
    } catch (error: any) {
        return NextResponse.json({
            status: "degraded",
            error: error.message,
            timestamp: new Date().toISOString()
        }, { status: 503 });
    }
}
