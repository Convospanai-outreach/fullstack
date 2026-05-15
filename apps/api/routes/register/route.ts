import { NextResponse } from "next/server";

export async function POST() {
    return NextResponse.json(
        { error: "Public signup is invite-only. Please join the waiting list." },
        { status: 403 }
    );
}

