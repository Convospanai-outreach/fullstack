import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const token = req.headers.get("Authorization");
        if (!token) {
            return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        console.log("[Extension Action] Received action result:", body);

        // TODO: Log action to AuditLog if needed

        return NextResponse.json({ ok: true, message: "Action recorded" });
    } catch (error: any) {
        console.error("[Extension Action] Error:", error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
