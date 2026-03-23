import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { datasetId, record } = body;
    if (!datasetId || !record) {
        return NextResponse.json({ error: "datasetId and record required" }, { status: 400 });
    }

    const created = await prisma.trainingRecord.create({
        data: {
            datasetId,
            taskType: record.task_type,
            inputText: record.input_text,
            brandRules: record.brand_rules,
            policyRules: record.policy_rules,
            expectedOutput: record.expected_output,
            rejectionConditions: record.rejection_conditions
        }
    });

    return NextResponse.json({ success: true, record: created });
}
