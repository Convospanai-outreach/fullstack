import { NextResponse } from "next/server";

export async function POST(req: Request) {
    return NextResponse.json(
        { error: "This endpoint is deprecated. Please use /api/team/members instead." },
        { status: 410 }
    );
}
