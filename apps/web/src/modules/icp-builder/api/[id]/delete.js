import { NextResponse } from "next/server";
import { icpService } from "../../service/icpService";
export async function DELETE(_req, { params }) {
    try {
        await icpService.delete(params.id);
        return NextResponse.json({ ok: true });
    }
    catch (err) {
        return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
    }
}
