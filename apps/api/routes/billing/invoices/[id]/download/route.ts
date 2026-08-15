import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { authorizeRole, TeamRole } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { renderInvoicePdf } from "@/modules/billing/service/invoicePdfRenderer";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const { userId, teamId } = await getCurrentContext();
    if (!userId || !teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await authorizeRole(userId, teamId, TeamRole.ADMIN);

    const invoice = await prisma.invoice.findFirst({
        where: { id, teamId },
        include: { team: { select: { name: true } }, user: { select: { name: true, email: true } } }
    });

    if (!invoice) {
        return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    try {
        const pdf = await renderInvoicePdf(invoice);
        return new NextResponse(new Uint8Array(pdf), {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="${invoice.invoiceNumber}.pdf"`,
                "Cache-Control": "no-store"
            }
        });
    } catch (error: any) {
        console.error("[Billing] Failed to render invoice PDF:", error);
        return NextResponse.json({ error: "Failed to generate invoice PDF" }, { status: 500 });
    }
}
