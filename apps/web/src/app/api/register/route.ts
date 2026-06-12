import { NextResponse } from "next/server";

export async function POST() {
    return NextResponse.json({
        error: "Password signup is disabled. Use Clerk signup so identity is managed by Clerk and synced into Postgres."
    }, { status: 410 });
}
