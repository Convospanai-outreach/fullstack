import { NextResponse } from "next/server";

export async function POST() {
    return NextResponse.json({
        error: "Password signup is disabled. Use Google signup so identity is managed by NextAuth and synced into Postgres."
    }, { status: 410 });
}
