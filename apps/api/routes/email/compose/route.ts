import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { composeNodeA, composeNodeB, composeNodeC } from "@/modules/email-campaigner/service/emailComposer";

export async function POST(req: NextRequest) {
    try {
        const ctx = await getCurrentContext();
        if (!ctx.teamId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { node, input } = body;

        if (!node || !input) {
            return NextResponse.json({ error: "Missing node or input" }, { status: 400 });
        }
        const serializedInput = JSON.stringify(input);
        if (serializedInput.length > 9000) {
            return NextResponse.json({ error: "Compose input exceeds allowed size" }, { status: 400 });
        }

        let result;
        
        if (node === "A") {
            result = await composeNodeA(input, ctx.teamId);
        } else if (node === "B") {
            result = await composeNodeB(input, ctx.teamId);
        } else if (node === "C") {
            result = await composeNodeC(input, ctx.teamId);
        } else {
            return NextResponse.json({ error: "Invalid node. Must be 'A', 'B', or 'C'." }, { status: 400 });
        }

        return NextResponse.json({ success: true, data: result });
    } catch (err: any) {
        console.error("[Email Compose API] Error:", err);
        const message = err?.message || "Email compose failed";
        if (message.includes("Insufficient credits")) {
            return NextResponse.json({ error: message }, { status: 402 });
        }
        if (message.includes("prompt") || message.includes("not allowed") || message.includes("exceeds")) {
            return NextResponse.json({ error: message }, { status: 400 });
        }
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
