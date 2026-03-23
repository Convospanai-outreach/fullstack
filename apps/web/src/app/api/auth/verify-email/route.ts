import { NextResponse } from "next/server";
import { EmailService } from "@/lib/emailService";

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const token = searchParams.get("token");
        if (!token) {
            return NextResponse.json({ error: "Verification token is required" }, { status: 400 });
        }

        const result = await EmailService.verifyToken(token);
        if (!result.success) {
            return NextResponse.json({ error: result.error || "Invalid or expired verification link" }, { status: 400 });
        }

        return NextResponse.json({ success: true, email: result.email });
    } catch (error) {
        return NextResponse.json({ error: "Failed to verify email" }, { status: 500 });
    }
}
